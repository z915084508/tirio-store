import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { createApp } from '../src/app.mjs';
import { openStore } from '../src/store.mjs';
import { random, digest, hmac, signed, readSigned } from '../src/security.mjs';
const config={enabled:true,origin:'https://link.example.test',storefront:'https://store.example.test',providerOrigin:'https://aoc.example.test',shop:'example-test.myshopify.com',proxyPath:'/apps/hispafly-link',shopifySecret:'s'.repeat(40),providerSecret:'p'.repeat(40),sessionSecret:'t'.repeat(40)};
const source=readFileSync(new URL('../hispafly-adapter/route.ts',import.meta.url),'utf8').replace("import { currentAuthUser } from '@/lib/auth/session';",'const currentAuthUser = async () => globalThis.__tirioAuthFixture;');
const adapter=await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(source,{mode:'strip'})).toString('base64')}`);
const cookieFrom=r=>r.headers.get('set-cookie').split(';')[0];
const csrfFrom=s=>s.match(/name="csrf" value="([a-f0-9]+)"/)[1];
const hrefFrom=(s,path)=>s.match(new RegExp(`href="([^"]*${path}[^\"]*)"`))[1].replaceAll('&amp;','&');
const active=()=>({id:'hf-user-1',displayName:'Fixture <Pilot>',status:'ACTIVE',emailVerifiedAt:new Date(),pilot:{status:'active'},roles:[{role:{code:'PILOT'}}]});

test('proposed HISPAFLY adapter and real broker complete consent and linking, rejecting invalid identity/CSRF/origin',async()=>{
 const originalFetch=globalThis.fetch,originalUser=globalThis.__tirioAuthFixture;
 const keys=['TIRIO_LINK_SECRET','TIRIO_LINK_ORIGIN','TIRIO_LINK_ENABLED','HISPAFLY_PUBLIC_ORIGIN'];const original=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 const db=openStore(':memory:');const app=createApp(config,db);
 const send=(path,opts={})=>app(new Request(new URL(path,config.origin),opts));
 try{
  Object.assign(process.env,{TIRIO_LINK_SECRET:config.providerSecret,TIRIO_LINK_ORIGIN:config.origin,TIRIO_LINK_ENABLED:'true',HISPAFLY_PUBLIC_ORIGIN:config.providerOrigin});
  // In-memory transport only. No external service, credentials or accounts used.
  globalThis.fetch=async(url,opts)=>{assert.equal(url,`${config.origin}/internal/hispafly/grant`);return send(url,opts);};
  const start=await send('/shopify/start'),cookie=cookieFrom(start),state=db.prepare('SELECT auth_state FROM sessions').get().auth_state;
  const params=new URLSearchParams({state,shop:config.shop,logged_in_customer_id:'101',path_prefix:config.proxyPath,timestamp:String(Math.floor(Date.now()/1000))});
  params.set('signature',hmac(config.shopifySecret,[...params.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('')));
  const proxy=await send(`/proxy?${params}`),callback=hrefFrom(await proxy.text(),'/shopify/callback');
  const auth=await send(callback,{headers:{cookie}}),verifiedCookie=cookieFrom(auth);
  const home=await send('/',{headers:{cookie:verifiedCookie}}),csrf=csrfFrom(await home.text());
  const linked=await send('/link',{method:'POST',headers:{cookie:verifiedCookie,origin:config.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,consent:'yes'})});
  const providerUrl=hrefFrom(await linked.text(),'/api/integrations/tirio/authorize');
  const rawToken=new URL(providerUrl).searchParams.get('request');const flow=readSigned(config.providerSecret,rawToken).flow;
  globalThis.__tirioAuthFixture=null;assert.equal((await adapter.GET(new Request(providerUrl))).status,401);
  for(const override of [{status:'DISABLED'},{emailVerifiedAt:null},{pilot:null},{roles:[{role:{code:'ADMIN'}}]}]){
   globalThis.__tirioAuthFixture={...active(),...override};assert.equal((await adapter.GET(new Request(providerUrl))).status,401);
  }
  globalThis.__tirioAuthFixture=active();
  const consent=await adapter.GET(new Request(providerUrl));assert.equal(consent.status,200);const html=await consent.text();assert.match(html,/Fixture &lt;Pilot&gt;/);
  const consentCsrf=csrfFrom(html);
  const form={request:rawToken,csrf:consentCsrf,consent:'yes'};
  const submit=(body=form,origin=config.providerOrigin)=>adapter.POST(new Request(providerUrl,{method:'POST',headers:{origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(body)}));
  assert.equal((await submit({...form,csrf:'bad'})).status,403);
  assert.equal((await submit({...form,consent:'no'})).status,403);
  assert.equal((await submit(form,'https://evil.example')).status,403);
  globalThis.__tirioAuthFixture={...active(),id:'different-user'};assert.equal((await submit()).status,403);
  globalThis.__tirioAuthFixture=active();
  const approved=await submit();assert.equal(approved.status,303);assert.equal((await submit()).status,403,'same approval cannot issue a second grant');
  const review=await send(approved.headers.get('location'),{headers:{cookie:verifiedCookie}});assert.equal(review.status,200);
  const done=await send('/confirm',{method:'POST',headers:{cookie:verifiedCookie,origin:config.origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({csrf,flow})});assert.equal(done.status,200);
  assert.equal(db.prepare('SELECT member FROM links').get().member,'hf-user-1');
  const tampered=new URL(providerUrl);tampered.searchParams.set('request',rawToken+'x');assert.equal((await adapter.GET(new Request(tampered))).status,403);
  const expired=new URL(providerUrl);expired.searchParams.set('request',signed(config.providerSecret,{aud:'tirio-link',origin:config.origin,flow:random(),exp:Date.now()-1000}));assert.equal((await adapter.GET(new Request(expired))).status,403);
  const wrong=new URL(providerUrl);wrong.searchParams.set('request',signed(config.providerSecret,{aud:'tirio-link',origin:'https://evil.example',flow:random(),exp:Date.now()+60_000}));assert.equal((await adapter.GET(new Request(wrong))).status,403);
  process.env.TIRIO_LINK_ENABLED='false';assert.equal((await adapter.GET(new Request(providerUrl))).status,403);
 }finally{
  globalThis.fetch=originalFetch;globalThis.__tirioAuthFixture=originalUser;
  for(const key of keys) if(original[key]===undefined)delete process.env[key];else process.env[key]=original[key];
  db.close();
 }
});
