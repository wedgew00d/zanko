const {chromium}=require('/opt/npm-tools/node_modules/playwright');const sleep=ms=>new Promise(r=>setTimeout(r,ms));const S='/home/claude/shots/z/';
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const errs=[];
 {const c=await b.newContext({viewport:{width:1280,height:720}});const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8770/');await sleep(300);await p.click('#startBtn');await sleep(300);
  const st=()=>p.evaluate('(()=>{const s=__zanko.sim,q=s.p;return {mode:document.getElementById("frame").dataset.mode,x:Math.round(q.x),hp:q.hp,near:s.near&&s.near.type,act:!!q.act,prompt:document.getElementById("prompt").classList.contains("show")}})()');
  await p.evaluate('__zanko.sim.p.x=11*16');await sleep(200);console.log('at terminal',JSON.stringify(await st()));await p.screenshot({path:S+'u_prompt.png'});
  await p.keyboard.press('KeyW');await sleep(120);await p.screenshot({path:S+'u_reach.png'});await sleep(500);console.log('W ->',JSON.stringify(await st()),JSON.stringify(await p.evaluate('talkText.textContent')));await p.screenshot({path:S+'u_talk.png'});
  await p.keyboard.press('KeyW');await sleep(100);await p.keyboard.press('KeyW');await sleep(900);console.log('next page ->',JSON.stringify(await p.evaluate('talkText.textContent+" | "+talkMore.textContent')));
  await p.mouse.click(600,300);await sleep(100);console.log('click closes ->',JSON.stringify(await st()));
  await p.evaluate('(()=>{const s=__zanko.sim;s.enemies.length=0;s.p.x=64*16+4;s.p.hp=5})()');await sleep(200);await p.screenshot({path:S+'u_heal0.png'});await p.keyboard.press('KeyE');await sleep(350);console.log('heal ->',JSON.stringify(await st()));await p.screenshot({path:S+'u_heal.png'});
  await p.evaluate('(()=>{const s=__zanko.sim;s.p.x=139*16+2;s.p.y=10*16})()');await sleep(900);await p.screenshot({path:S+'u_gate0.png'});await p.keyboard.press('ArrowUp');await sleep(450);await p.screenshot({path:S+'u_gate1.png'});await sleep(600);await p.screenshot({path:S+'u_gate2.png'});console.log('switch ->',JSON.stringify(await st()),'gate open',await p.evaluate('__zanko.sim.L.gates[0].open'));
  await c.close();}
 for(const [n,w,h] of [['um_land',844,390],['um_port',390,844]]){const c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,hasTouch:true,isMobile:true});const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8770/');await sleep(300);await p.tap('#startBtn');await sleep(300);await p.evaluate('__zanko.sim.p.x=11*16');await sleep(300);await p.screenshot({path:S+n+'_prompt.png'});
  await p.tap('#prompt');await sleep(900);await p.screenshot({path:S+n+'_talk.png'});console.log(n,'tap prompt ->',await p.evaluate('document.getElementById("frame").dataset.mode'));
  await p.touchscreen.tap(w/2,h*0.3);await sleep(100);await p.touchscreen.tap(w/2,h*0.3);await sleep(100);await p.touchscreen.tap(w/2,h*0.3);await sleep(100);await p.touchscreen.tap(w/2,h*0.3);await sleep(150);console.log(' taps ->',await p.evaluate('document.getElementById("frame").dataset.mode'));await c.close();}
 console.log('errors',errs);await b.close();})();
