const {chromium}=require('/opt/npm-tools/node_modules/playwright');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const c=await b.newContext({viewport:{width:1280,height:720}});const p=await c.newPage();
 await p.goto('http://localhost:8770/');await sleep(300);await p.click('#startBtn');await sleep(300);await p.evaluate('__zanko.sim.p.x=11*16');await sleep(200);
 await p.keyboard.press('KeyE');await sleep(900);await p.mouse.click(600,300);await sleep(900);await p.mouse.click(600,300);await sleep(50);await p.mouse.click(600,300);await sleep(80);
 console.log('after closing by click: mode',await p.evaluate('document.getElementById("frame").dataset.mode'),'attacking:',await p.evaluate('!!__zanko.sim.p.atk'));
 await sleep(400);await p.mouse.click(600,300);await sleep(60);console.log('a later click slashes:',await p.evaluate('!!__zanko.sim.p.atk'));await b.close();})();
