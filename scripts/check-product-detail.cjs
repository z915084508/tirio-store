// Development-only: npm install --prefix /tmp/tirio-validation liquidjs jsdom
// NODE_PATH=/tmp/tirio-validation/node_modules node scripts/check-product-detail.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Liquid } = require('liquidjs');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const es = JSON.parse(fs.readFileSync(path.join(root, 'locales/es.default.json')));
const engine = new Liquid();
engine.registerFilter('t', (key, ...args) => {
  let value = key.split('.').reduce((obj, part) => obj[part], es);
  for (const [name, replacement] of args) value = value.replace(`{{ ${name} }}`, replacement);
  return value;
});
engine.registerFilter('money', value => `${(value/100).toFixed(2)} €`);
engine.registerFilter('image_url', image => image.src);
engine.registerFilter('image_tag', src => `<img src="${src}" width="800" height="800" alt="Fixture">`);
engine.registerFilter('asset_url', file => `/assets/${file}`);
engine.registerFilter('default_errors', value => value || '');
// Shopify's form/image/CDN filters are not implemented by LiquidJS. Represent
// the form wrapper locally; official Theme Check validates its Shopify syntax.
const source = fs.readFileSync(path.join(root, 'sections/main-product.liquid'), 'utf8')
  .replace(/{% schema %}[\s\S]*?{% endschema %}/, '')
  .replace(/{% form 'product', product, class: 'product-form' %}/, '<form class="product-form">')
  .replace(/{% endform %}/, '</form>');
const fixture = {title:'Fixture <safe>', vendor:'Example', description:'<p>Actual description</p>', price:4321, price_min:4321, available:true, has_only_default_variant:true, images:[{src:'/one.png'},{src:'/two.png'}], variants:[{id:1,title:'Default',price:4321,available:true}], selected_or_first_available_variant:{id:1}};
async function render(overrides={}, options={}) {
  const {catalog=true, design=false, specifications={}, blocks=[]}=options;
  return engine.parseAndRender(source, {product:{...fixture,...overrides},settings:{catalog_mode:catalog},request:{design_mode:design},section:{id:'fixture',settings:specifications,blocks},routes:{root_url:'/',all_products_collection_url:'/collections/all'}});
}
(async () => {
  const html = await render();
  assert.match(html,/Fixture &lt;safe&gt;/); assert.match(html,/43.21 €/); assert.match(html,/Disponible/); assert.match(html,/Actual description/);
  assert.doesNotMatch(html,/<form|name="quantity"|Ficha del producto|Añade los datos/);
  const dom = new JSDOM(html,{runScripts:'outside-only'});
  const gallery=dom.window.document.querySelector('tirio-product-gallery');
  assert.equal([...gallery.querySelectorAll('[data-product-image]')].filter(x=>!x.hidden).length,2,'all images visible without JS');
  assert.equal(gallery.querySelector('[data-gallery-controls]').hidden,true);
  const script=fs.readFileSync(path.join(root,'assets/product-gallery.js'),'utf8');
  dom.window.eval(script);
  const pictures=[...gallery.querySelectorAll('[data-product-image]')];
  const buttons=[...gallery.querySelectorAll('[data-gallery-index]')];
  assert.equal(pictures[0].hidden,false);assert.equal(pictures[1].hidden,true);
  assert.equal(gallery.querySelector('[data-gallery-controls]').hidden,false);
  buttons[1].querySelector('img').click();
  assert.equal(pictures[0].hidden,true);assert.equal(pictures[1].hidden,false);
  assert.equal(buttons[1].getAttribute('aria-pressed'),'true');assert.equal(buttons[0].getAttribute('aria-pressed'),'false');
  gallery.remove();dom.window.document.body.append(gallery);buttons[1].click();
  assert.equal(pictures[1].hidden,false,'works after editor reconnect');
  dom.window.eval(script); // repeat section asset load must not redefine element
  assert.equal(dom.window.document.querySelectorAll('form').length,0);
  const empty = await render({images:[],available:false,description:''});
  assert.match(empty,/Imagen no disponible/);assert.match(empty,/Agotado/);assert.doesNotMatch(empty,/data-gallery-controls|product-description/);
  const single = await render({images:[{src:'/one.png'}]});assert.doesNotMatch(single,/data-gallery-controls/);
  const configured = await render({}, {specifications:{material:'Fixture & material',dimensions:'',package_contents:''}});
  assert.match(configured,/Fixture &amp; material/);assert.doesNotMatch(configured,/<dt>Dimensiones|<dt>Contenido del paquete/);
  assert.match(await render({}, {design:true}),/Añade los datos confirmados/);
  const variants = await render({has_only_default_variant:false,price_varies:true,variants:[...fixture.variants,{id:2,title:'Second',price:5000,available:false}]});
  assert.match(variants,/Desde 43.21/);assert.match(variants,/Second/);assert.match(variants,/Agotado/);assert.doesNotMatch(variants,/<form/);
  const commerce = await render({available:false},{catalog:false});
  assert.match(commerce,/<form/);assert.match(commerce,/<button[^>]*disabled/);
  const blocks = await render({}, {blocks:[{type:'details',settings:{heading:'Confirmed info',text:'<p>Confirmed copy</p>'}},{type:'details',settings:{heading:'Empty info',text:''}}]});
  assert.match(blocks,/Confirmed copy/);assert.doesNotMatch(blocks,/Empty info/);
  console.log('PASS: catalog form suppression, dynamic product data, escaping, 0/1/2 images, gallery selection/reconnect/reload/no-JS, missing/confirmed specifications, variants/sold-out and details blocks.');
})().catch(error=>{console.error(error);process.exitCode=1;});
