// Local rendering regression checks. Requires liquidjs in the validation environment.
const { Liquid } = require('liquidjs');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '../shopify');
const es = JSON.parse(fs.readFileSync(path.join(root, 'locales/es.default.json')));
const engine = new Liquid({ root: path.join(root, 'snippets'), extname: '.liquid' });
engine.registerFilter('t', key => key.split('.').reduce((v, k) => v[k], es));
engine.registerFilter('money', value => `${(value / 100).toFixed(2)} €`);
// Shopify image filters are represented locally; CDN/runtime behavior needs store QA.
engine.registerFilter('image_url', image => image.src);
engine.registerFilter('image_tag', src => `<img src="${src}" alt="Test image" width="700" height="700">`);
const source = fs.readFileSync(path.join(root, 'sections/featured-collection.liquid'), 'utf8').replace(/{% schema %}[\s\S]*?{% endschema %}/, '');
const product = { title: 'Fixture collectible <safe>', url: '/products/fixture', price: 4321, available: true, featured_image: { src: '/fixture.png' } };
async function render(collection, settings = {}, design = false) {
  return engine.parseAndRender(source, {section: {id: 'test', settings: {heading: 'Collection <safe>', collection, limit: 4, show_view_all: true, view_all_label: 'Ver colección', ...settings}}, request: {design_mode: design}});
}
(async () => {
  assert.equal((await render(null)).trim(), '');
  const editor = await render(null, {}, true);
  assert.match(editor, /Selecciona una colección/); assert.doesNotMatch(editor, /class="card"/);
  const empty = await render({url:'/collections/empty', products:[]});
  assert.match(empty, /No hay productos/); assert.doesNotMatch(empty, /class="card"/);
  const collection = {url:'/collections/fixture', products: Array.from({length: 14}, () => product)};
  for (const limit of [4, 7, 12]) {
    const html = await render(collection, {limit});
    assert.equal((html.match(/class="card"/g) || []).length, limit);
    for (const value of ['/fixture.png', '/products/fixture', '43.21 €', 'Disponible', '/collections/fixture', 'Ver colección', 'Fixture collectible &lt;safe&gt;']) assert.ok(html.includes(value), value);
    assert.doesNotMatch(html, /Concepto|próximamente|product-1/);
  }
  const soldOut = await render({products:[{...product, available:false, price_varies:true, featured_image:null}]}, {show_view_all:false});
  assert.match(soldOut, /Agotado/); assert.match(soldOut, /Desde/); assert.match(soldOut, /Imagen no disponible/);
  assert.doesNotMatch(soldOut, /class="button"|Disponible|<img/);
  assert.equal((await engine.renderFile('product-card', {card_product:null})).trim(), '');
  console.log('PASS: collection selection/editor visibility, empty collection, product limit 4/7/12, escaped titles, image/link/price/availability, sold-out, varying prices, missing images and View All toggle.');
})().catch(error => {console.error(error); process.exitCode = 1;});
