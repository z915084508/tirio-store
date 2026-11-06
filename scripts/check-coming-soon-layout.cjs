// Run check-coming-soon.cjs with TIRIO_VISUAL_FIXTURES=1 first.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  try{
    for(const width of [375,1440])for(const mode of ['light','dark'])for(const fixture of ['product','cards']){
      const page=await browser.newPage({viewport:{width,height:1000}});
      await page.setContent(fs.readFileSync(path.join(__dirname,'../.validation/fixtures',fixture+'.html'),'utf8'));
      await page.evaluate(mode=>document.documentElement.dataset.theme=mode,mode);
      const result=await page.evaluate(()=>{
        const badge=document.querySelector('.coming-soon-badge'),style=getComputedStyle(badge),rect=badge.getBoundingClientRect();
        return {overflow:document.documentElement.scrollWidth>innerWidth,bg:style.backgroundColor,color:style.color,left:rect.left,right:rect.right,body:getComputedStyle(document.body).backgroundColor};
      });
      assert.equal(result.overflow,false,`${fixture}/${width}/${mode} overflow`);
      assert.equal(result.bg,'rgb(246, 197, 68)');assert.equal(result.color,'rgb(23, 26, 29)');
      assert.ok(result.left>=0&&result.right<=width);
      assert.equal(result.body,mode==='dark'?'rgb(19, 22, 25)':'rgb(250, 249, 246)');
      await page.keyboard.press('Tab');
      assert.equal(await page.evaluate(()=>document.activeElement.tagName),'A','card/gallery link keyboard reachable');
      await page.screenshot({path:path.join(__dirname,'../.validation',`${fixture}-${width}-${mode}.png`),fullPage:true});
      await page.close();
    }
    console.log('PASS: product/cards at 375/1440px in Light/Dark, no horizontal overflow, badge colors and bounds, keyboard link access; 8 screenshots saved locally.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
