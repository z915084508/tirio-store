import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.mjs';
import { openStore } from '../src/store.mjs';
import { random, digest, hmac, signed, readSigned, verifyProxy, validateConfig } from '../src/security.mjs';
const config={enabled:true,origin:'https://link.example.test',storefront:'https://store.example.test',providerOrigin:'https://aoc.example.test',shop:'example-test.myshopify.com',proxyPath:'/apps/hispafly-link',shopifySecret:'s'.repeat(40),providerSecret:'p'.repeat(40),sessionSecret:'t'.repeat(40)};
function fixture(){const db=openStore(':memory:');let now=1_800_000_000_000;return{db,now:()=>now,advance:delta=>{now+=delta;},app:createApp(config,db,()=>now)};}
const tokenFrom=response=>response.headers.get('set-cookie').split(';')[0];
const csrfFrom=html=>html.match(/name="csrf" value="([a-f0-9]+)"/)[1];
const hrefFrom=(html,path)=>html.match(new RegExp(`href="([^"]*${path}[^\"]*)"`))[1].replaceAll('&amp;','&');
function proxyQuery(now,state,customer='101',extra={}){const p=new URLSearchParams({state,shop:config.shop,logged_in_customer_id:customer,path_prefix:config.proxyPath,timestamp:String(Math.floor(now/1000)),...extra});p.set('signature',hmac(config.shopifySecret,[...p.entries()].sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>`${k}=${v}`).join('')));return p;}
function request(app,path,opts={}){return app(new Request(new URL(path,config.origin),opts));}
function post(f,path,cookie,form,origin=config.origin){return request(f.app,path,{method:'POST',headers:{cookie,origin,'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams(form)});}
async function authenticate(f,customer='101'){
 const start=await request(f.app,'/shopify/start');const cookie=tokenFrom(start);const state=f.db.prepare('SELECT auth_state FROM sessions WHERE id=?').get(digest(cookie.split('=')[1])).auth_state;
 const proxy=await request(f.app,`/proxy?${proxyQuery(f.now(),state,customer)}`);assert.equal(proxy.status,200);
 const callback=hrefFrom(await proxy.text(),'/shopify/callback');
 const verified=await request(f.app,callback,{headers:{cookie}});assert.equal(verified.status,200);
 const fresh=tokenFrom(verified);assert.notEqual(cookie,fresh,'session token rotates after proof');
 const home=await request(f.app,'/',{headers:{cookie:fresh}});const html=await home.text();return{cookie:fresh,csrf:csrfFrom(html),callback};
}
async function startLink(f,session){const r=await post(f,'/link',session.cookie,{csrf:session.csrf,consent:'yes'});assert.equal(r.status,200);const u=new URL(hrefFrom(await r.text(),'/api/integrations/tirio/authorize'));return readSigned(config.providerSecret,u.searchParams.get('request'),f.now());}
async function grant(f,flow,member='member-1',eligible=true){return request(f.app,'/internal/hispafly/grant',{method:'POST',headers:{authorization:`Bearer ${signed(config.providerSecret,{aud:'tirio-grant',flow,member,eligible,exp:f.now()+60_000})}`}});}
async function review(f,s,flow,member='member-1'){const r=await grant(f,flow,member);assert.equal(r.status,200);const {code}=await r.json();const path=`/hispafly/callback?state=${flow}&code=${code}`;const result=await request(f.app,path,{headers:{cookie:s.cookie}});assert.equal(result.status,200);return path;}

test('real handler end-to-end: Shopify proof -> provider grant -> explicit confirm -> persistence -> unlink',async()=>{
 const f=fixture();try{const s=await authenticate(f);const p=await startLink(f,s);await review(f,s,p.flow);
 assert.equal(f.db.prepare('SELECT count(*) AS n FROM links').get().n,0,'callback alone never links');
 const done=await post(f,'/confirm',s.cookie,{csrf:s.csrf,flow:p.flow});assert.equal(done.status,200);
 assert.deepEqual({...f.db.prepare('SELECT shop,customer,member FROM links').get()},{shop:config.shop,customer:'101',member:'member-1'});
 assert.equal((await post(f,'/confirm',s.cookie,{csrf:s.csrf,flow:p.flow})).status,403,'confirmation cannot replay');
 assert.equal((await post(f,'/unlink',s.cookie,{csrf:s.csrf})).status,200);assert.equal(f.db.prepare('SELECT count(*) AS n FROM links').get().n,0);
 assert.equal(f.db.prepare('SELECT count(*) AS n FROM audit').get().n,2);
 }finally{f.db.close();}
});
test('proxy signature, trusted shop, freshness, customer identity and duplicates are required',()=>{
 const f=fixture();try{for(const p of [proxyQuery(f.now(),random(),'101',{shop:'other.myshopify.com'}),proxyQuery(f.now()-61_000,random()),proxyQuery(f.now(),random(),''),proxyQuery(f.now(),random(),'not-a-number')])assert.throws(()=>verifyProxy(new URL(`/proxy?${p}`,config.origin),config,f.now()));
 const p=proxyQuery(f.now(),random());p.set('logged_in_customer_id','999');assert.throws(()=>verifyProxy(new URL(`/proxy?${p}`,config.origin),config,f.now()));
 const duplicate=proxyQuery(f.now(),random());duplicate.append('state',random());assert.throws(()=>verifyProxy(new URL(`/proxy?${duplicate}`,config.origin),config,f.now()));
 }finally{f.db.close();}
});
test('pending Shopify identity does not authorize any broker action; callback is browser-bound and one-use',async()=>{
 const f=fixture();try{const r=await request(f.app,'/shopify/start');const cookie=tokenFrom(r);const row=f.db.prepare('SELECT * FROM sessions').get();
 const proxy=await request(f.app,`/proxy?${proxyQuery(f.now(),row.auth_state)}`);const callback=hrefFrom(await proxy.text(),'/shopify/callback');
 assert.equal((await post(f,'/link',cookie,{csrf:hmac(config.sessionSecret,`csrf:${cookie.split('=')[1]}`),consent:'yes'})).status,401);
 assert.equal((await request(f.app,callback)).status,403);
 const ok=await request(f.app,callback,{headers:{cookie}});assert.equal(ok.status,200);
 assert.equal((await request(f.app,callback,{headers:{cookie}})).status,403);
 assert.equal((await request(f.app,`/proxy?${proxyQuery(f.now(),row.auth_state)}`)).status,403);
 }finally{f.db.close();}
});
test('CSRF, origin, consent and request methods protect mutation',async()=>{
 const f=fixture();try{const s=await authenticate(f);
 assert.equal((await post(f,'/link',s.cookie,{csrf:s.csrf,consent:'yes'},'https://evil.example')).status,403);
 assert.equal((await post(f,'/link',s.cookie,{csrf:'bad',consent:'yes'})).status,403);
 assert.equal((await post(f,'/link',s.cookie,{csrf:s.csrf})).status,400);
 assert.equal((await request(f.app,'/unlink',{headers:{cookie:s.cookie}})).status,404);
 assert.equal((await post(f,'/unlink',s.cookie,{csrf:'bad'})).status,403);
 assert.equal(f.db.prepare('SELECT count(*) AS n FROM flows').get().n,0);
 }finally{f.db.close();}
});
test('provider signature/audience/eligibility, grant replay, cross-browser callback, code replay and expiry',async()=>{
 const f=fixture();try{const s=await authenticate(f),p=await startLink(f,s);
 assert.equal((await request(f.app,'/internal/hispafly/grant',{method:'POST',headers:{authorization:'Bearer fake'}})).status,403);
 assert.equal((await grant(f,p.flow,'member-1',false)).status,403);
 const r=await grant(f,p.flow);const {code}=await r.json();assert.equal((await grant(f,p.flow)).status,403);
 const path=`/hispafly/callback?state=${p.flow}&code=${code}`;
 assert.equal((await request(f.app,path)).status,401);
 const stranger=await authenticate(f,'202');assert.equal((await request(f.app,path,{headers:{cookie:stranger.cookie}})).status,403);
 assert.equal((await request(f.app,path,{headers:{cookie:s.cookie}})).status,200);
 assert.equal((await request(f.app,path,{headers:{cookie:s.cookie}})).status,403);
 f.advance(301_000);assert.equal((await post(f,'/confirm',s.cookie,{csrf:s.csrf,flow:p.flow})).status,403);
 }finally{f.db.close();}
});
test('one-to-one linking refuses silent reassignment; unlink affects only the current customer',async()=>{
 const f=fixture();try{const a=await authenticate(f,'101'),b=await authenticate(f,'202');
 const p=await startLink(f,a);await review(f,a,p.flow);assert.equal((await post(f,'/confirm',a.cookie,{csrf:a.csrf,flow:p.flow})).status,200);
 const q=await startLink(f,b);await review(f,b,q.flow);assert.equal((await post(f,'/confirm',b.cookie,{csrf:b.csrf,flow:q.flow})).status,409);
 await post(f,'/unlink',b.cookie,{csrf:b.csrf});assert.equal(f.db.prepare('SELECT customer FROM links').get().customer,'101');
 assert.equal((await post(f,'/link',a.cookie,{csrf:a.csrf,consent:'yes'})).status,409);
 }finally{f.db.close();}
});
test('disabled service, secure configuration, cookie flags, no-cache and logout',async()=>{
 const f=fixture();try{assert.throws(()=>validateConfig({...config,origin:'http://example.com'}));assert.throws(()=>validateConfig({...config,providerSecret:config.shopifySecret}));
 const disabled=createApp({...config,enabled:false},f.db,f.now);assert.equal((await request(disabled,'/')).status,503);assert.equal(f.db.prepare('SELECT count(*) AS n FROM sessions').get().n,0);
 const start=await request(f.app,'/shopify/start');assert.match(start.headers.get('set-cookie'),/Secure/);assert.match(start.headers.get('set-cookie'),/HttpOnly/);assert.match(start.headers.get('set-cookie'),/SameSite=Lax/);assert.equal(start.headers.get('cache-control'),'no-store');assert.equal(start.headers.get('referrer-policy'),'no-referrer');
 const s=await authenticate(f);assert.equal((await post(f,'/logout',s.cookie,{csrf:s.csrf})).status,200);assert.equal((await post(f,'/link',s.cookie,{csrf:s.csrf,consent:'yes'})).status,401);
 }finally{f.db.close();}
});

test('database restart preserves links; session/code storage contains hashes, not raw bearer tokens',async()=>{
 const {mkdtempSync,rmSync}=await import('node:fs');const {tmpdir}=await import('node:os');const {join}=await import('node:path');
 const dir=mkdtempSync(join(tmpdir(),'tirio-link-test-'));const file=join(dir,'link.sqlite');let db=openStore(file);
 try{const now=Date.now;const f={db,now,app:createApp(config,db,now)};const s=await authenticate(f);const raw=s.cookie.split('=')[1];
 assert.notEqual(db.prepare('SELECT id FROM sessions WHERE customer=?').get('101').id,raw);
 const p=await startLink(f,s);await review(f,s,p.flow);await post(f,'/confirm',s.cookie,{csrf:s.csrf,flow:p.flow});db.close();db=openStore(file);
 assert.equal(db.prepare('SELECT customer FROM links WHERE member=?').get('member-1').customer,'101');
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test('unlink also invalidates previously authorized pending links from another session of the same customer',async()=>{
 const f=fixture();try{const a=await authenticate(f,'101'),b=await authenticate(f,'101');
 const p=await startLink(f,a),q=await startLink(f,b);await review(f,a,p.flow,'member-1');await review(f,b,q.flow,'member-2');
 assert.equal((await post(f,'/confirm',a.cookie,{csrf:a.csrf,flow:p.flow})).status,200);
 assert.equal((await post(f,'/unlink',a.cookie,{csrf:a.csrf})).status,200);
 assert.equal((await post(f,'/confirm',b.cookie,{csrf:b.csrf,flow:q.flow})).status,403);
 assert.equal(f.db.prepare('SELECT count(*) AS n FROM links').get().n,0);
 }finally{f.db.close();}
});
