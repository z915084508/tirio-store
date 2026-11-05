import http from 'node:http';
import { mkdirSync, chmodSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createApp } from './app.mjs';
import { openStore } from './store.mjs';
const env=process.env;
const config={enabled:env.LINK_ENABLED==='true',origin:env.LINK_ORIGIN,storefront:env.SHOPIFY_STOREFRONT,providerOrigin:env.HISPAFLY_ORIGIN,shop:env.SHOPIFY_SHOP,proxyPath:env.SHOPIFY_PROXY_PATH||'/apps/hispafly-link',shopifySecret:env.SHOPIFY_APP_SECRET,providerSecret:env.HISPAFLY_LINK_SECRET,sessionSecret:env.LINK_SESSION_SECRET};
process.umask(0o077);
const filename=resolve(env.LINK_DB_PATH||'./data/links.sqlite');
mkdirSync(dirname(filename),{recursive:true,mode:0o700});
const db=openStore(filename);chmodSync(filename,0o600);
const app=createApp(config,db);
const buckets=new Map();
const server=http.createServer(async(req,res)=>{
  // Trust no forwarded host, origin or customer identity headers.
  const now=Date.now(),ip=req.socket.remoteAddress||'unknown';
  if(buckets.size>10_000) for(const [key,value] of buckets) if(value.reset<now)buckets.delete(key);
  let bucket=buckets.get(ip);if(!bucket||bucket.reset<now){bucket={count:0,reset:now+60_000};buckets.set(ip,bucket);}
  if(++bucket.count>300||buckets.size>20_000){res.writeHead(429,{'Retry-After':'60'});res.end();return;}
  try{
    let size=0;const chunks=[];
    for await(const chunk of req){size+=chunk.length;if(size>8192){res.writeHead(413);res.end();return;}chunks.push(chunk);}
    const headers=new Headers();
    for(const [key,value] of Object.entries(req.headers)) if(value!==undefined) headers.set(key,Array.isArray(value)?value.join(','):value);
    const request=new Request(new URL(req.url,config.origin),{method:req.method,headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});
    const response=await app(request);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{res.writeHead(500,{'Content-Type':'text/plain','Cache-Control':'no-store'});res.end('Error temporal.');}
});
server.requestTimeout=15_000;server.headersTimeout=10_000;server.keepAliveTimeout=5_000;
server.listen(Number(env.LINK_PORT||8787),'127.0.0.1',()=>console.log('TIRIO linking service listening on loopback.'));
for(const signal of ['SIGTERM','SIGINT']) process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
