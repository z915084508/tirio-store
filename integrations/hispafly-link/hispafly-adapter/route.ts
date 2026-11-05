/** Proposed adapter ONLY. Not installed in the HISPAFLY repository by this task.
 * Intended destination: src/app/api/integrations/tirio/authorize/route.ts
 * Reuses existing native identity; never handles a password or legacy vAMSYS.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { currentAuthUser } from '@/lib/auth/session';
export const runtime = 'nodejs';
const mac=(key:string,value:string)=>createHmac('sha256',key).update(value).digest('hex');
const same=(a:string,b:string)=>Buffer.byteLength(a)===Buffer.byteLength(b)&&timingSafeEqual(Buffer.from(a),Buffer.from(b));
const esc=(s:string)=>s.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
const headers={'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Frame-Options':'DENY','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'"};
const html=(body:string,status=200)=>new Response(`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>HISPAFLY · Vincular TIRIO</title><main>${body}</main></html>`,{status,headers});
function config(){
  const key=process.env.TIRIO_LINK_SECRET,origin=process.env.TIRIO_LINK_ORIGIN,hf=process.env.HISPAFLY_PUBLIC_ORIGIN;
  if(process.env.TIRIO_LINK_ENABLED!=='true'||!key||key.length<32||key.includes('REPLACE')||!origin||!hf)throw Error('disabled');
  for(const x of [origin,hf]){const u=new URL(x);if(u.protocol!=='https:'||u.origin!==x||u.username||u.password)throw Error('config');}
  return{key,origin,hf};
}
function payload(key:string,token:string,origin:string){
  if(token.length>4096)throw Error('token');
  const [body,signature,extra]=token.split('.');
  if(extra||!signature||!same(signature,mac(key,body||'')))throw Error('signature');
  const p=JSON.parse(Buffer.from(body,'base64url').toString()) as {aud?:string;origin?:string;flow?:string;exp?:number};
  if(p.aud!=='tirio-link'||p.origin!==origin||typeof p.flow!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(p.flow)||typeof p.exp!=='number'||!Number.isSafeInteger(p.exp)||p.exp<=Date.now()||p.exp>Date.now()+300_000)throw Error('expired');
  return p as {aud:string;origin:string;flow:string;exp:number};
}
function eligible(user:Awaited<ReturnType<typeof currentAuthUser>>){return Boolean(user&&user.status==='ACTIVE'&&user.emailVerifiedAt&&user.pilot?.status==='active'&&user.roles.some(x=>x.role.code==='PILOT'));}
export async function GET(request:Request){
  try{
    const c=config(),url=new URL(request.url);
    if(url.searchParams.getAll('request').length!==1)return html('<h1>Solicitud inválida</h1>',400);
    const token=url.searchParams.get('request')||'';payload(c.key,token,c.origin);
    const user=await currentAuthUser();
    if(!eligible(user))return html('<h1>Accede con tu cuenta de piloto activa</h1><p>Inicia sesión en HISPAFLY en otra pestaña y después recarga esta página. La cuenta debe tener el correo verificado.</p><a href="/login" target="_blank" rel="noopener">Iniciar sesión</a>',401);
    // CSRF is bound to the current authenticated user AND this exact signed request.
    const csrf=mac(c.key,`consent:${user!.id}:${token}`);
    return html(`<h1>Vincular con TIRIO</h1><p>Cuenta HISPAFLY: ${esc(user!.displayName)}</p><p>Se comunicará tu identificador de miembro y se comprobará que tu cuenta de piloto está activa. No se comparten contraseñas, vuelos, saldo ni pedidos. Esta acción no autoriza publicidad.</p><p>Consulta la <a href="/privacy">privacidad de HISPAFLY</a> y la <a href="https://tirio.hispafly.es/policies/privacy-policy">privacidad de TIRIO</a>.</p><form method="post"><input type="hidden" name="request" value="${esc(token)}"><input type="hidden" name="csrf" value="${csrf}"><label><input type="checkbox" name="consent" value="yes" required> Autorizo esta vinculación</label><button type="submit">Autorizar y volver a TIRIO</button></form><a href="${esc(c.origin)}">Cancelar</a>`);
  }catch{return html('<h1>Vinculación no disponible o solicitud caducada</h1>',403);}
}
export async function POST(request:Request){
  try{
    const c=config();
    if(request.headers.get('origin')!==c.hf)return html('<h1>Origen inválido</h1>',403);
    if(!(request.headers.get('content-type')||'').startsWith('application/x-www-form-urlencoded'))return html('<h1>Formato inválido</h1>',415);
    const raw=await request.text();if(raw.length>8192)return html('<h1>Solicitud demasiado grande</h1>',413);
    const form=new URLSearchParams(raw);for(const key of form.keys())if(form.getAll(key).length!==1)return html('<h1>Solicitud inválida</h1>',400);
    const token=form.get('request')||'',p=payload(c.key,token,c.origin),user=await currentAuthUser();
    if(!eligible(user)||form.get('consent')!=='yes'||!same(form.get('csrf')||'',mac(c.key,`consent:${user!.id}:${token}`)))return html('<h1>Autorización inválida</h1>',403);
    const body=Buffer.from(JSON.stringify({aud:'tirio-grant',flow:p.flow,member:user!.id,eligible:true,exp:Date.now()+60_000})).toString('base64url');
    const reply=await fetch(`${c.origin}/internal/hispafly/grant`,{method:'POST',headers:{Authorization:`Bearer ${body}.${mac(c.key,body)}`},redirect:'error',signal:AbortSignal.timeout(5000)});
    if(!reply.ok)return html('<h1>Solicitud usada o caducada</h1>',403);
    const result=await reply.json() as {code?:string};if(!result.code||!/^[A-Za-z0-9_-]{43}$/.test(result.code))throw Error('response');
    const destination=new URL('/hispafly/callback',c.origin);destination.searchParams.set('state',p.flow);destination.searchParams.set('code',result.code);
    return new Response(null,{status:303,headers:{...headers,Location:destination.href}});
  }catch{return html('<h1>No se ha podido autorizar la vinculación</h1>',403);}
}
