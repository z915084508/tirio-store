import { random, digest, hmac, equal, signed, readSigned, validToken, escape, verifyProxy, validateConfig, fail, Failure } from './security.mjs';
import { transaction, purge } from './store.mjs';
const cookieName = config => config.localTest ? 'tirio_link_test' : '__Host-tirio_link';
const page = (body, status = 200, extra = {}) => new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>TIRIO · HISPAFLY</title><link rel="stylesheet" href="/style.css"><main><p class="brand">TIRIO / HISPAFLY</p>${body}</main></html>`, {status, headers: {'Content-Type':'text/html; charset=utf-8', ...extra}});
const link = (url, label) => `<a class="button" href="${escape(url)}">${escape(label)}</a>`;
const buttonForm = (path, csrf, label, extra = '') => `<form method="post" action="${path}"><input type="hidden" name="csrf" value="${csrf}">${extra}<button>${escape(label)}</button></form>`;
export function createApp(configInput, db, clock = Date.now) {
  const config = validateConfig(configInput);
  const origin = config.origin;
  const cookie = token => `${cookieName(config)}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=1200${config.localTest ? '' : '; Secure'}`;
  const csrf = token => hmac(config.sessionSecret, `csrf:${token}`);
  const audit = (action, customer) => db.prepare('INSERT INTO audit(action,subject_hash,at) VALUES(?,?,?)').run(action, hmac(config.sessionSecret, `${config.shop}:${customer}`), clock());
  function getSession(request, required = false) {
    const values = (request.headers.get('cookie') || '').split(';').map(v => v.trim()).filter(v => v.startsWith(`${cookieName(config)}=`));
    const token = values.length === 1 ? values[0].slice(cookieName(config).length + 1) : '';
    const row = validToken(token) ? db.prepare('SELECT * FROM sessions WHERE id=? AND expires>?').get(digest(token), clock()) : null;
    if (required && (!row || !row.customer)) fail(401, 'Vuelve a verificar tu cuenta TIRIO.');
    return {token, row};
  }
  async function post(request) {
    if (request.headers.get('origin') !== origin) fail(403, 'Origen inválido.');
    if (!(request.headers.get('content-type') || '').startsWith('application/x-www-form-urlencoded')) fail(415, 'Formato inválido.');
    const body = await request.text(); if (body.length > 8192) fail(413, 'Solicitud demasiado grande.');
    const form = new URLSearchParams(body);
    for (const k of form.keys()) if (form.getAll(k).length !== 1) fail(400, 'Parámetro duplicado.');
    const session = getSession(request, true);
    if (!equal(form.get('csrf'), csrf(session.token))) fail(403, 'Recarga la página y vuelve a intentarlo.');
    return {...session, form};
  }
  async function route(request) {
    const url = new URL(request.url); const now = clock();
    if (config.enabled !== true) return page('<h1>Próximamente</h1><p>La vinculación de cuentas todavía no está habilitada.</p>', 503);
    for (const key of url.searchParams.keys()) if (url.searchParams.getAll(key).length !== 1) fail(400, 'Parámetro duplicado.');
    purge(db, now);
    if (request.method === 'GET' && url.pathname === '/style.css') return new Response(`:root{color-scheme:light dark;--bg:#faf9f6;--ink:#191c20;--line:#ddd}@media(prefers-color-scheme:dark){:root{--bg:#131619;--ink:#f3f3ef;--line:#49515b}}*{box-sizing:border-box}body{background:var(--bg);color:var(--ink);font:16px/1.6 Arial;margin:0}main{max-width:660px;margin:8vh auto;padding:28px}.brand{font-weight:bold;letter-spacing:.15em;font-size:13px}h1{line-height:1.15;font-size:32px}button,.button{display:inline-block;font:inherit;background:#f6c544;color:#171a1d;border:0;padding:12px 20px;text-decoration:none;cursor:pointer;margin-block:12px}a{color:inherit}input{font:inherit}label{display:block;margin-block:18px}code{overflow-wrap:anywhere}form{border-top:1px solid var(--line);padding-top:12px}:focus-visible{outline:3px solid #c94429;outline-offset:4px}`, {headers:{'Content-Type':'text/css'}});
    if (request.method === 'GET' && url.pathname === '/') {
      const session = getSession(request);
      if (!session.row?.customer) return page(`<h1>Vincula tu cuenta HISPAFLY</h1><p>Primero verificaremos tu cuenta TIRIO. No se comparten contraseñas, direcciones ni pedidos.</p>${link('/shopify/start','Verificar cuenta TIRIO')}<p>${link(`${config.storefront}/account/login`,'Iniciar sesión en TIRIO')}</p>`);
      const existing = db.prepare('SELECT * FROM links WHERE shop=? AND customer=?').get(config.shop, session.row.customer);
      return page(`<h1>${existing ? 'Cuenta vinculada' : 'Vincular HISPAFLY'}</h1><p>Cuenta TIRIO verificada: <code>${escape(session.row.customer)}</code></p>${existing ? `<p>Tu cuenta está vinculada a HISPAFLY. La vinculación no activa descuentos automáticamente.</p>${buttonForm('/unlink',csrf(session.token),'Desvincular cuenta')}` : `<p>Solo se guardarán los identificadores de ambas cuentas y la fecha de vinculación. HISPAFLY comprobará que tu cuenta está activa al autorizar.</p><p>La vinculación es opcional y no implica aceptar publicidad ni realizar un pedido.</p><p>Consulta ${link(`${config.storefront}/policies/privacy-policy`,'Privacidad de TIRIO')} y ${link(`${config.providerOrigin}/privacy`,'Privacidad de HISPAFLY')}.</p>${buttonForm('/link',csrf(session.token),'Continuar en HISPAFLY','<label><input type="checkbox" name="consent" value="yes" required> Quiero vincular mis cuentas y autorizo la comprobación de mi identidad de miembro.</label>')}`}${buttonForm('/logout',csrf(session.token),'Cerrar sesión de vinculación')}<p>${link(config.storefront,'Volver a TIRIO')}</p>`);
    }
    if (request.method === 'GET' && url.pathname === '/shopify/start') {
      const token = random(), state = random();
      db.prepare('INSERT INTO sessions(id,expires,auth_state,auth_expires) VALUES(?,?,?,?)').run(digest(token),now+1200_000,state,now+300_000);
      const destination = new URL(config.proxyPath,config.storefront); destination.searchParams.set('state',state);
      return page(`<h1>Verificar TIRIO</h1><p>Continúa para comprobar tu sesión Shopify. Si no has iniciado sesión, accede primero a TIRIO y vuelve aquí.</p>${link(destination.href,'Continuar con TIRIO')}`,200,{'Set-Cookie':cookie(token)});
    }
    if (request.method === 'GET' && url.pathname === '/proxy') {
      const customer = verifyProxy(url,config,now); const state = url.searchParams.get('state');
      if (!validToken(state)) fail(400,'Solicitud inválida.');
      const code = random();
      transaction(db,()=>{
        const session = db.prepare('SELECT * FROM sessions WHERE auth_state=? AND auth_expires>? AND auth_code IS NULL').get(state,now);
        if (!session) fail(403,'La verificación ya se usó o ha caducado.');
        db.prepare('UPDATE sessions SET pending_customer=?,auth_code=? WHERE id=?').run(customer,digest(code),session.id);
      });
      // HTML link rather than Set-Cookie/redirect: Shopify strips proxy cookies.
      const destination = new URL('/shopify/callback',origin); destination.searchParams.set('state',state); destination.searchParams.set('code',code);
      return page(`<h1>Cuenta TIRIO comprobada</h1>${link(destination.href,'Continuar de forma segura')}`);
    }
    if (request.method === 'GET' && url.pathname === '/shopify/callback') {
      const {row} = getSession(request); const state = url.searchParams.get('state'), code = url.searchParams.get('code'); const nextToken = random();
      transaction(db,()=>{
        if (!row || !validToken(code) || row.auth_expires<=now || !equal(row.auth_state,state) || !equal(row.auth_code,digest(code))) fail(403,'Verificación inválida o de otro navegador.');
        db.prepare('DELETE FROM sessions WHERE id=?').run(row.id);
        db.prepare('INSERT INTO sessions(id,expires,customer) VALUES(?,?,?)').run(digest(nextToken),now+1200_000,row.pending_customer);
      });
      return page(`<h1>TIRIO verificado</h1>${link('/','Continuar')}`,200,{'Set-Cookie':cookie(nextToken)});
    }
    if (request.method === 'POST' && url.pathname === '/link') {
      const {row, form} = await post(request);
      if (form.get('consent')!=='yes') fail(400,'Confirma que quieres vincular las cuentas.');
      if (db.prepare('SELECT 1 FROM links WHERE shop=? AND customer=?').get(config.shop,row.customer)) fail(409,'Esta cuenta ya está vinculada.');
      const flow = random();
      transaction(db,()=>{
        db.prepare('DELETE FROM flows WHERE session_id=?').run(row.id);
        db.prepare('INSERT INTO flows(id,session_id,expires,status) VALUES(?,?,?,?)').run(flow,row.id,now+300_000,'pending');
      });
      const destination = new URL('/api/integrations/tirio/authorize',config.providerOrigin);
      destination.searchParams.set('request',signed(config.providerSecret,{aud:'tirio-link',origin,flow,exp:now+300_000}));
      return page(`<h1>Autorizar en HISPAFLY</h1><p>Inicia sesión y confirma en HISPAFLY. Después volverás para revisar la vinculación.</p>${link(destination.href,'Ir a HISPAFLY')}`);
    }
    if (request.method === 'POST' && url.pathname === '/internal/hispafly/grant') {
      const token = request.headers.get('authorization');
      if (!token?.startsWith('Bearer ')) fail(403,'No autorizado.');
      const payload = readSigned(config.providerSecret,token.slice(7),now);
      if (payload.aud!=='tirio-grant' || !validToken(payload.flow) || typeof payload.member!=='string' || !/^[A-Za-z0-9_-]{1,128}$/.test(payload.member) || payload.eligible!==true) fail(403,'Identidad no válida.');
      const code=random();
      transaction(db,()=>{
        const flow=db.prepare('SELECT * FROM flows WHERE id=? AND expires>? AND status=?').get(payload.flow,now,'pending');
        if (!flow) fail(403,'Solicitud usada o caducada.');
        db.prepare('UPDATE flows SET member=?,code=?,code_expires=?,status=? WHERE id=?').run(payload.member,digest(code),now+60_000,'issued',flow.id);
      });
      return Response.json({code});
    }
    if (request.method === 'GET' && url.pathname === '/hispafly/callback') {
      const {row,token}=getSession(request,true); const state=url.searchParams.get('state'),code=url.searchParams.get('code');
      if (!validToken(state)||!validToken(code)) fail(400,'Solicitud inválida.');
      let flow;
      transaction(db,()=>{
        flow=db.prepare('SELECT * FROM flows WHERE id=? AND session_id=? AND status=? AND expires>? AND code_expires>?').get(state,row.id,'issued',now,now);
        if(!flow||!equal(flow.code,digest(code))) fail(403,'Autorización inválida, usada o de otro navegador.');
        db.prepare('UPDATE flows SET status=?,code=NULL WHERE id=?').run('review',flow.id);
      });
      return page(`<h1>Confirma la vinculación</h1><p>Cuenta TIRIO: <code>${escape(row.customer)}</code></p><p>Cuenta HISPAFLY: <code>${escape(flow.member)}</code></p><p>Comprueba que ambas cuentas son tuyas.</p>${buttonForm('/confirm',csrf(token),'Confirmar vinculación',`<input type="hidden" name="flow" value="${flow.id}">`)}${link('/','Cancelar')}`);
    }
    if (request.method === 'POST' && url.pathname === '/confirm') {
      const {row,form}=await post(request); const flowId=form.get('flow');
      transaction(db,()=>{
        const flow=db.prepare('SELECT * FROM flows WHERE id=? AND session_id=? AND status=? AND expires>?').get(flowId,row.id,'review',now);
        if (!flow) fail(403,'Solicitud inválida o caducada.');
        if (db.prepare('SELECT 1 FROM links WHERE shop=? AND (customer=? OR member=?)').get(config.shop,row.customer,flow.member)) fail(409,'Una de las cuentas ya está vinculada. Desvincúlala antes de continuar.');
        db.prepare('INSERT INTO links(shop,customer,member,created) VALUES(?,?,?,?)').run(config.shop,row.customer,flow.member,now);
        db.prepare('DELETE FROM flows WHERE id=?').run(flow.id); audit('linked',row.customer);
      });
      return page(`<h1>Cuenta vinculada</h1><p>La vinculación se ha guardado. No se ha creado ningún pedido.</p>${link('/','Gestionar vinculación')}`);
    }
    if (request.method === 'POST' && url.pathname === '/logout') {
      const {row}=await post(request);
      transaction(db,()=>{ db.prepare('DELETE FROM flows WHERE session_id=?').run(row.id); db.prepare('DELETE FROM sessions WHERE id=?').run(row.id); });
      return page(`<h1>Sesión cerrada</h1>${link('/','Volver')}`,200,{'Set-Cookie':`${cookieName(config)}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${config.localTest ? '' : '; Secure'}`});
    }
    if (request.method === 'POST' && url.pathname === '/unlink') {
      const {row}=await post(request);
      transaction(db,()=>{
        db.prepare('DELETE FROM links WHERE shop=? AND customer=?').run(config.shop,row.customer);
        db.prepare('DELETE FROM flows WHERE session_id IN (SELECT id FROM sessions WHERE customer=?)').run(row.customer); audit('unlinked',row.customer);
      });
      return page(`<h1>Cuenta desvinculada</h1><p>No se han eliminado tus cuentas de Shopify o HISPAFLY.</p>${link('/','Volver')}`);
    }
    fail(404,'Página no encontrada.');
  }
  return async request => {
    let response;
    try { response=await route(request); } catch(error) { response=page(`<h1>No se ha completado la solicitud</h1><p>${escape(error instanceof Failure ? error.message : 'Error temporal. Vuelve a intentarlo.')}</p>${link('/','Volver')}`,error instanceof Failure ? error.status : 500); }
    for(const [key,value] of Object.entries({'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Content-Security-Policy':"default-src 'none'; style-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",'X-Robots-Tag':'noindex, nofollow'})) response.headers.set(key,value);
    return response;
  };
}
