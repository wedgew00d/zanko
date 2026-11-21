// A fake gamepad (navigator.getGamepads replaced) to check the text panel and menus.
const {chromium}=require('/opt/npm-tools/node_modules/playwright');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const c=await b.newContext({viewport:{width:1280,height:720}});const p=await c.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{window.__pad={buttons:Array.from({length:17},()=>({pressed:false})),axes:[0,0,0,0]};navigator.getGamepads=()=>[window.__pad];});
 await p.goto('http://localhost:8770/');await sleep(300);
 const mode=()=>p.evaluate('document.getElementById("frame").dataset.mode');
 const btn=async(i,ms=80)=>{await p.evaluate(i=>{__pad.buttons[i].pressed=true},i);await sleep(ms);await p.evaluate(i=>{__pad.buttons[i].pressed=false},i);await sleep(80);};
 await btn(0);console.log('title, cross ->',await mode());await sleep(300);
 await p.evaluate('__zanko.sim.p.x=11*16');await sleep(200);
 await p.evaluate('__pad.buttons[3].pressed=true');await sleep(700);console.log('triangle held ->',await mode(),JSON.stringify(await p.evaluate('talkText.textContent.length')));
 await sleep(600);console.log(' still holding: page',await p.evaluate('talkMore.textContent'));await p.evaluate('__pad.buttons[3].pressed=false');await sleep(100);
 await btn(0);console.log('cross ->',await p.evaluate('talkMore.textContent+" / "+talkText.textContent.slice(0,8)'));await btn(2);await p.evaluate('__pad.buttons[0].pressed=true');await sleep(250);console.log('square, then cross held ->',await mode(),'airborne',await p.evaluate('!__zanko.sim.p.ground'));await p.evaluate('__pad.buttons[0].pressed=false');await sleep(100);await btn(0,60);await sleep(60);console.log(' a fresh cross press jumps:',await p.evaluate('!__zanko.sim.p.ground'));await sleep(700);
 await sleep(200);console.log(' after closing: attacking',await p.evaluate('!!__zanko.sim.p.atk'),'airborne',await p.evaluate('!__zanko.sim.p.ground'));
 await btn(9);console.log('options ->',await mode());await btn(9);console.log('options ->',await mode());
 console.log('errors',errs);await b.close();})();
