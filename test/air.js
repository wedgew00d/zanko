const {chromium}=require('/opt/npm-tools/node_modules/playwright');const sleep=ms=>new Promise(r=>setTimeout(r,ms));const S='/home/claude/shots/z/';
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const errs=[];
 {const c=await b.newContext({viewport:{width:1280,height:720}});const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8770/');await sleep(300);await p.click('#startBtn');await sleep(300);await p.evaluate('__zanko.sim.enemies.length=0');
  await p.keyboard.down('KeyD');await p.keyboard.down('KeyK');await sleep(230);await p.keyboard.down('KeyL');await sleep(130);await p.screenshot({path:S+'air.png',clip:{x:200,y:300,width:640,height:330}});
  console.log('key: air dash',JSON.stringify(await p.evaluate('(()=>{const q=__zanko.sim.p;return {air:q.airDashT,vy:q.vy,kind:__zanko.R.pose.kind}})()')));
  await p.keyboard.up('KeyL');await p.keyboard.up('KeyK');await p.keyboard.up('KeyD');await sleep(900);
  // double-tap in the air
  await p.keyboard.down('Space');await sleep(200);await p.keyboard.press('KeyD',{delay:30});await sleep(40);await p.keyboard.down('KeyD');await sleep(60);
  console.log('key: double-tap in the air',JSON.stringify(await p.evaluate('(()=>{const q=__zanko.sim.p;return {air:q.airDashT,g:q.ground}})()')));await p.keyboard.up('KeyD');await p.keyboard.up('Space');
  await p.keyboard.press('Escape');await sleep(200);await p.screenshot({path:S+'pause5.png'});await c.close();}
 for(const [n,w,h] of [['b_land',844,390],['b_small',568,320],['b_port',390,844]]){const c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,hasTouch:true,isMobile:true});const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));
  await p.goto('http://localhost:8770/');await sleep(300);await p.tap('#startBtn');await sleep(400);await p.screenshot({path:S+n+'.png'});
  const boxes=await p.evaluate(`(()=>{const q=s=>{const r=document.querySelector(s).getBoundingClientRect();return [Math.round(r.left),Math.round(r.top),Math.round(r.right),Math.round(r.bottom)]};return {stick:q('#stick'),dash:q('.tbtn.dash'),atk:q('.tbtn.attack'),jump:q('.tbtn.jump'),hud:q('.hud-right')}})()`);
  console.log(n,JSON.stringify(boxes));
  if(n==='b_land'){const cdp=await c.newCDPSession(p);const T=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(([x,y,id])=>({x,y,id}))});
   // touches in the gaps between and just outside the buttons
   const pts={'between attack and jump':[(boxes.atk[2]+boxes.jump[0])/2,(boxes.atk[1]+boxes.jump[3])/2],'between dash and jump':[(boxes.dash[0]+boxes.dash[2])/2,(boxes.dash[3]+boxes.jump[1])/2],'12px left of attack':[boxes.atk[0]-12,(boxes.atk[1]+boxes.atk[3])/2],'12px above dash':[(boxes.dash[0]+boxes.dash[2])/2,boxes.dash[1]-12]};
   for(const k in pts){await T('touchStart',[[pts[k][0],pts[k][1],1]]);await sleep(40);const on=await p.evaluate('__zanko.input().pointers');await T('touchEnd',[[pts[k][0],pts[k][1],1]]);await sleep(300);console.log('  touch',k,'->',JSON.stringify(on));}
   const J=[(boxes.jump[0]+boxes.jump[2])/2,(boxes.jump[1]+boxes.jump[3])/2],D=[(boxes.dash[0]+boxes.dash[2])/2,(boxes.dash[1]+boxes.dash[3])/2];
   await p.evaluate('__zanko.sim.enemies.length=0');await T('touchStart',[[J[0],J[1],1]]);await sleep(220);await T('touchStart',[[J[0],J[1],1],[D[0],D[1],2]]);await sleep(80);console.log('  touch: DASH in the air ->',JSON.stringify(await p.evaluate('(()=>{const q=__zanko.sim.p;return {air:q.airDashT,g:q.ground}})()')));await T('touchEnd',[[J[0],J[1],1]]);await T('touchEnd',[[D[0],D[1],2]]);}
  await c.close();}
 console.log('errors',errs);await b.close();})();
