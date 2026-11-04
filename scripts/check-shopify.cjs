const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.join(__dirname, '../shopify');
const files = fs.readdirSync(root, { recursive: true }).filter(p => fs.statSync(path.join(root, p)).isFile());
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  if (file.endsWith('.json')) JSON.parse(source);
  if (file.endsWith('.liquid')) {
    const schema = source.match(/{% schema %}([\s\S]*?){% endschema %}/);
    if (schema) {
      const data = JSON.parse(schema[1]);
      assert.ok(data.name.length <= 25, file);
      const ids = data.settings.map(setting => setting.id).filter(Boolean);
      assert.equal(new Set(ids).size, ids.length, file);
    }
    for (const match of source.matchAll(/{% render '([^']+)'/g)) assert.ok(fs.existsSync(path.join(root, 'snippets', match[1]+'.liquid')), file);
  }
}
for (const folder of ['templates', 'sections']) {
  for (const name of fs.readdirSync(path.join(root, folder)).filter(p => p.endsWith('.json'))) {
    const data = JSON.parse(fs.readFileSync(path.join(root, folder, name)));
    for (const id of data.order) assert.ok(data.sections[id], name);
    for (const section of Object.values(data.sections)) assert.ok(fs.existsSync(path.join(root, 'sections', section.type+'.liquid')), name);
  }
}
const es = JSON.parse(fs.readFileSync(path.join(root, 'locales/es.default.json')));
const en = JSON.parse(fs.readFileSync(path.join(root, 'locales/en.json')));
for (const file of files.filter(p => p.endsWith('.liquid'))) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  for (const [,key] of source.matchAll(/'([^']+)' \| t/g)) for (const locale of [es,en]) assert.equal(typeof key.split('.').reduce((obj,k)=>obj?.[k],locale), 'string', key);
}
const script = fs.readFileSync(path.join(root, 'assets/theme-mode.js'), 'utf8');
function browser(saved, denied=false) {
  const events = {}, select = {value:'', matches: s=>s==='[data-theme-select]'};
  const storage = {value:saved};
  const document = {documentElement:{dataset:{}},querySelectorAll:()=>[select],addEventListener:(key,fn)=>events[key]=fn};
  const window = {addEventListener:(key,fn)=>events[key]=fn};
  const localStorage = {getItem:()=>{if(denied)throw Error();return storage.value;},setItem:(_key,value)=>{if(denied)throw Error();storage.value=value;}};
  vm.runInNewContext(script,{document,window,localStorage});
  events.DOMContentLoaded();
  return {events,select,storage,document};
}
for (const saved of ['light','dark','system','invalid',null]) {
  const b = browser(saved);
  assert.equal(b.select.value,['light','dark','system'].includes(saved)?saved:'system');
  b.select.value='dark'; b.events.change({target:b.select});
  assert.equal(b.storage.value,'dark'); assert.equal(b.document.documentElement.dataset.theme,'dark');
  b.events.storage({key:'tirio-theme',newValue:'light'}); assert.equal(b.select.value,'light');
  b.events.storage({key:'tirio-theme',newValue:null}); assert.equal(b.select.value,'system');
  b.events['shopify:section:load'](); assert.equal(b.select.value,'system');
}
const denied=browser('dark',true); denied.select.value='light'; denied.events.change({target:denied.select});
assert.equal(denied.document.documentElement.dataset.theme,'light');
assert.equal(JSON.parse(fs.readFileSync(path.join(root,'config/settings_data.json'))).current.catalog_mode,true);
console.log('PASS: theme JSON, schemas, section/snippet references, translations, catalog default and theme preference behavior (including denied storage).');
