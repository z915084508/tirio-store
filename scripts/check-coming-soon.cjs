// Local validation only: npm install --prefix .validation --no-save liquidjs jsdom
// NODE_PATH=.validation/node_modules node scripts/check-coming-soon.cjs
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { Liquid } = require('liquidjs');
const { JSDOM } = require('jsdom');
const root = path.join(__dirname, '..');
const engine = new Liquid({root:path.join(root,'snippets'),extname:'.liquid'});
const locale = JSON.parse(fs.readFileSync(path.join(root,'locales/es.default.json')));
engine.registerFilter('t',key=>key.split('.').reduce((o,k)=>o[k],locale));
engine.registerFilter('money',n=>`${(n/100).toFixed(2)} €`);
engine.registerFilter('image_url',image=>image.src);
engine.registerFilter('image_tag',src=>`<img src="${src}" alt="Fixture">`);
engine.registerFilter('asset_url',file=>`/assets/${file}`);
engine.registerFilter('default_errors',()=> '');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
// Emulate Shopify-only wrappers, keeping all actual Liquid conditions/rendered
// snippets. Platform pagination and form endpoints still require Shopify QA.
const source=p=>read(p).replace(/{% schema %}[\s\S]*?{% endschema %}/g,'')
  .replace(/{% form 'product', product, class: 'product-form' %}/g,'<form action="/cart/add" class="product-form">')
  .replace(/{% form 'cart', cart %}/g,'<form action="/cart/update">')
  .replace(/{% endform %}/g,'</form>')
  .replace(/{% paginate [\s\S]*? %}|{% endpaginate %}/g,'');
const product={object_type:'product',id:12,title:'TOAM <test>',url:'/products/toam',tags:[],available:true,description:'<p>Design description</p>',price:2500,price_min:2500,images:[{src:'/design.png'}],featured_image:{src:'/design.png'},has_only_default_variant:false,variants:[{id:11,title:'A',price:2500,available:true},{id:22,title:'B',price:3000,available:true}],selected_or_first_available_variant:{id:11}};
const render=async(p,prod,extra={})=>engine.parseAndRender(source(p),{product:prod,card_product:prod,settings:{catalog_mode:false},section:{id:'fixture',settings:{},blocks:[]},request:{},routes:{root_url:'/',all_products_collection_url:'/collections/all',search_url:'/search'},...extra});
const doc=html=>new JSDOM(html).window.document;
(async()=>{
  for(const catalog of [true,false]) for(const available of [true,false]) for(const selected of product.variants){
    const tagged={...product,tags:['tirio-coming-soon'],available,selected_or_first_available_variant:selected};
    const html=await render('sections/main-product.liquid',tagged,{settings:{catalog_mode:catalog}}),d=doc(html);
    assert.equal(d.querySelector('.coming-soon-badge').textContent,'PRÓXIMAMENTE');
    assert.equal(d.querySelectorAll('form,[name="id"],[name="quantity"],.shopify-payment-button').length,0);
    assert.match(html,/Design description/);assert.match(html,/25.00 €/);assert.match(html,/design.png/);
    assert.match(html,/Producto en desarrollo. Próximamente disponible en TIRIO Aviation & Collectibles./);
    assert.match(html,/Las imágenes son representaciones del diseño y el producto final puede variar./);
    assert.equal(d.querySelector('.product-status'),null);
    assert.equal(d.querySelector('[data-coming-soon-notice] button'),null);
  }
  for(const tags of [[],['tirio-coming-soon-extra'],['other']]){
    const d=doc(await render('sections/main-product.liquid',{...product,tags}));
    assert.equal(d.querySelectorAll('form[action="/cart/add"]').length,1);
    assert.equal(d.querySelectorAll('select[name="id"] option').length,2);
    assert.ok(d.querySelector('[name="quantity"]'));assert.equal(d.querySelector('button[type="submit"]').disabled,false);
    assert.equal(d.querySelector('.coming-soon-badge'),null);
  }
  const sold=doc(await render('sections/main-product.liquid',{...product,available:false}));
  assert.equal(sold.querySelector('button[type="submit"]').disabled,true);
  const tagged={...product,tags:['tirio-coming-soon']};
  const cart=doc(await render('sections/main-cart.liquid',tagged,{cart:{items:[{index:0,product:tagged,variant:{title:'A'},quantity:2,url:product.url,url_to_remove:'/cart/change?line=1&quantity=0'},{index:1,product,variant:{title:'B'},quantity:3,url:product.url,url_to_remove:'/cart/change?line=2&quantity=0'}]}}));
  assert.deepEqual([...cart.querySelectorAll('[name="updates[]"]')].map(el=>[el.type,el.value]),[['hidden','0'],['number','3']]);
  assert.equal(cart.querySelectorAll('a[href*="quantity=0"]').length,2);
  const contexts=[
    ['snippets/product-card.liquid',{}],
    ['sections/featured-collection.liquid',{section:{id:'featured',settings:{collection:{products:[tagged,product]},limit:4}}}],
    ['sections/main-collection.liquid',{collection:{title:'Collection',products:[tagged,product],sort_options:[]}}],
    ['sections/main-search.liquid',{search:{performed:true,terms:'TOAM',results:[tagged,product,{object_type:'page',title:'Story',url:'/pages/story'}]}}]
  ];
  for(const [file,extra] of contexts){
    const d=doc(await render(file,tagged,extra));
    assert.equal(d.querySelectorAll('.coming-soon-badge').length,1,file);
    assert.equal(d.querySelector('a.card').getAttribute('href'),product.url,file);
    assert.equal(d.querySelectorAll('form[action="/cart/add"],button[name="add"],.shopify-payment-button').length,0,file);
    if(file!=='snippets/product-card.liquid')assert.equal(d.querySelectorAll('.card-availability').length,1,file);
  }
  // No AJAX add or quick-buy path exists in this theme. Fail if one is added
  // without extending this test and introducing tag-aware authorization.
  for(const name of fs.readdirSync(path.join(root,'assets')).filter(n=>n.endsWith('.js')))
    assert.doesNotMatch(read('assets/'+name),/cart\/add|XMLHttpRequest|\bfetch\s*\(/,name);
  // Compare normal products against the actual pre-task theme, including both
  // catalog states and sold-out behavior. Ignore only formatting whitespace.
  const {execFileSync}=require('node:child_process');
  for(const file of ['sections/main-product.liquid','snippets/product-card.liquid']){
    const original=execFileSync('git',['show',`b672488:${file}`],{cwd:root,encoding:'utf8'})
      .replace(/{% schema %}[\s\S]*?{% endschema %}/g,'')
      .replace(/{% form 'product', product, class: 'product-form' %}/g,'<form action="/cart/add" class="product-form">').replace(/{% endform %}/g,'</form>');
    for(const catalog of [true,false]) for(const available of [true,false]){
      const prod={...product,available},extra={settings:{catalog_mode:catalog}};
      const current=await render(file,prod,extra);
      const prior=await engine.parseAndRender(original,{product:prod,card_product:prod,section:{id:'fixture',settings:{},blocks:[]},request:{},routes:{root_url:'/',all_products_collection_url:'/collections/all'},...extra});
      const normalize=html=>html.replace(/\r\n/g,'\n').replace(/>\s+</g,'><').trim();
      assert.equal(normalize(current),normalize(prior),`normal product unchanged: ${file}/${catalog}/${available}`);
    }
  }
  if(process.env.TIRIO_VISUAL_FIXTURES){
    const dir=path.join(root,'.validation/fixtures');fs.mkdirSync(dir,{recursive:true});
    const svg='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="600"><rect width="600" height="600" fill="#dde1e4"/><path d="M100 310l150-30 80-150 30 0-30 150 150 20-150 20 30 150-30 0-80-150Z" fill="#495766"/></svg>');
    const visualProduct={...tagged,images:[{src:svg}],featured_image:{src:svg}};
    for(const [name,markup] of [['product',await render('sections/main-product.liquid',visualProduct)],['cards',await render('sections/featured-collection.liquid',visualProduct,{section:{id:'visual',settings:{heading:'Colección TIRIO',collection:{products:[visualProduct,{...visualProduct,tags:[],title:'Producto disponible'}]},limit:4}}})]]){
      fs.writeFileSync(path.join(dir,name+'.html'),`<!doctype html><html lang="es" data-theme="light"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${read('assets/theme.css')}</style><body>${markup}</body></html>`);
    }
  }
  console.log('PASS: tagged product (catalog on/off, available/sold-out, every selected variant), normal product exact rendered regression, stale cart lines, clickable cards, homepage/collection/search rendering and no theme AJAX/quick-buy paths.');
})().catch(error=>{console.error(error);process.exitCode=1;});
