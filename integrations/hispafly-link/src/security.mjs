import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
export class Failure extends Error { constructor(status, message) { super(message); this.status = status; } }
export const fail = (status, message) => { throw new Failure(status, message); };
export const random = () => randomBytes(32).toString('base64url');
export const digest = value => createHash('sha256').update(value).digest('hex');
export const hmac = (secret, value) => createHmac('sha256', secret).update(value).digest('hex');
export function equal(a, b) { return typeof a === 'string' && typeof b === 'string' && Buffer.byteLength(a) === Buffer.byteLength(b) && timingSafeEqual(Buffer.from(a), Buffer.from(b)); }
export const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const validToken = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
export function signed(secret, payload) { const body = Buffer.from(JSON.stringify(payload)).toString('base64url'); return `${body}.${hmac(secret, body)}`; }
export function readSigned(secret, token, now = Date.now()) {
  if (typeof token !== 'string' || token.length > 4096) fail(400, 'Solicitud inválida.');
  const [body, signature, extra] = token.split('.');
  if (extra || !equal(signature, hmac(secret, body || ''))) fail(403, 'Solicitud no válida.');
  let p; try { p = JSON.parse(Buffer.from(body, 'base64url').toString()); } catch { fail(400, 'Solicitud inválida.'); }
  if (!Number.isSafeInteger(p.exp) || p.exp <= now || p.exp > now + 300_000) fail(403, 'La solicitud ha caducado.');
  return p;
}
export function verifyProxy(url, config, now = Date.now()) {
  const params = url.searchParams;
  for (const key of params.keys()) if (params.getAll(key).length !== 1) fail(400, 'Parámetro duplicado.');
  const expected = [...params.entries()].filter(([key]) => key !== 'signature').sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${value}`).join('');
  if (!equal(params.get('signature'), hmac(config.shopifySecret, expected))) fail(403, 'Firma Shopify inválida.');
  if (params.get('shop') !== config.shop) fail(403, 'Tienda no autorizada.');
  const timestamp = Number(params.get('timestamp'));
  if (!Number.isSafeInteger(timestamp) || Math.abs(now / 1000 - timestamp) > 60) fail(403, 'Solicitud caducada.');
  const customer = params.get('logged_in_customer_id');
  if (!customer || !/^[1-9][0-9]{0,24}$/.test(customer)) fail(401, 'Inicia sesión en TIRIO y vuelve a intentarlo.');
  return customer;
}
export function validateConfig(config) {
  for (const key of ['shopifySecret', 'providerSecret', 'sessionSecret']) if (typeof config[key] !== 'string' || config[key].length < 32 || config[key].includes('REPLACE')) fail(503, `Configuración incompleta: ${key}`);
  if (new Set([config.shopifySecret, config.providerSecret, config.sessionSecret]).size !== 3) fail(503, 'Usa secretos distintos.');
  for (const key of ['origin','storefront','providerOrigin']) {
    let u; try { u = new URL(config[key]); } catch { fail(503, `URL inválida: ${key}`); }
    const local = config.localTest === true && ['127.0.0.1','localhost'].includes(u.hostname);
    if ((!local && u.protocol !== 'https:') || u.origin !== config[key] || u.username || u.password) fail(503, `Origen inválido: ${key}`);
  }
  if (!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(config.shop || '')) fail(503, 'Tienda inválida.');
  if (!/^\/apps\/[a-z0-9-]+$/.test(config.proxyPath || '')) fail(503, 'Ruta proxy inválida.');
  return config;
}
