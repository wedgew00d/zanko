const {chromium}=require('/opt/npm-tools/node_modules/playwright');
const S='/home/claude/shots/z/';const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const errs=[];
 // desktop keyboard
 {const c=await b.newContext({viewport:{width:1280,height:720}});const p=await c.newPage();p.on('pageerror',e=>errs.push('PAGE '+e.message));p.on('console',m=>{if(m.type()==='error')errs.push('CON '+m.text());});
  await p.goto('http://localhost:8770/#debug');await sleep(300);await p.screenshot({path:S+'d_title.png'});
  await p.click('#startBtn');await sleep(300);
  const st=()=>p.evaluate('(()=>{const s=__zanko.sim,q=s.p;return {x:Math.round(q.x),y:Math.round(q.y),vx:q.vx,g:q.ground,atk:q.atk&&q.atk.id,hp:q.hp,t:s.time,kind:__zanko.R.pose.kind}})()');
  await p.keyboard.down('KeyD');await sleep(500);let a=await st();console.log('run',JSON.stringify(a));await p.screenshot({path:S+'d_run.png'});
  await p.keyboard.down('KeyL');await sleep(250);a=await st();console.log('dash',JSON.stringify(a));await p.screenshot({path:S+'d_dash.png'});
  await p.keyboard.down('KeyK');await sleep(200);a=await st();console.log('dashjump',JSON.stringify(a));await p.screenshot({path:S+'d_jump.png'});
  await p.keyboard.up('KeyK');await p.keyboard.up('KeyL');await p.keyboard.up('KeyD');await sleep(600);
  // go to dummy and combo
  await p.evaluate('__zanko.sim.p.x=__zanko.sim.enemies[0].x-24;__zanko.sim.p.face=1');await sleep(200);
  for(let i=0;i<3;i++){await p.keyboard.down('KeyJ');await sleep(40);await p.keyboard.up('KeyJ');await sleep(110);if(i===0)await p.screenshot({path:S+'d_s1.png'});if(i===1)await p.screenshot({path:S+'d_s2.png'});}
  await sleep(60);await p.screenshot({path:S+'d_s3.png'});a=await st();console.log('combo',JSON.stringify(a),'dummy hp',await p.evaluate('__zanko.sim.enemies[0].hp'));
  await sleep(700);await p.keyboard.down('KeyJ');await sleep(900);await p.screenshot({path:S+'d_charging.png'});await p.keyboard.up('KeyJ');await sleep(200);await p.screenshot({path:S+'d_charge.png'});
  // double tap dash
  await sleep(500);await p.keyboard.press('KeyA',{delay:40});await sleep(60);await p.keyboard.down('KeyA');await sleep(150);a=await st();console.log('double-tap',JSON.stringify(a));await p.keyboard.up('KeyA');
  // wall slide at plateau
  await p.evaluate('(()=>{const q=__zanko.sim.p;q.x=66*16;q.y=22*16;q.vy=0;q.ground=false})()');await p.keyboard.down('KeyD');await sleep(350);await p.screenshot({path:S+'d_slide.png'});a=await st();console.log('slide',JSON.stringify(a));
  await p.keyboard.down('KeyJ');await sleep(60);await p.keyboard.up('KeyJ');await sleep(80);await p.screenshot({path:S+'d_wallslash.png'});await p.keyboard.up('KeyD');
  // enemies area
  await p.evaluate('(()=>{const q=__zanko.sim.p;q.x=74*16;q.y=17*16;})()');await sleep(1500);await p.screenshot({path:S+'d_turret.png'});
  await p.keyboard.press('Escape');await sleep(200);await p.screenshot({path:S+'d_pause.png'});
  await c.close();}
 // phone landscape + portrait
 for(const [n,w,h] of [['m_land',844,390],['m_port',390,844],['m_small',568,320]]){const c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2.6,hasTouch:true,isMobile:true});const p=await c.newPage();p.on('pageerror',e=>errs.push(n+' PAGE '+e.message));
  await p.goto('http://localhost:8770/');await sleep(300);await p.screenshot({path:S+n+'_title.png'});await p.tap('#startBtn');await sleep(300);
  const cdp=await c.newCDPSession(p);const T=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(([x,y,id])=>({x,y,id}))});
  const bt=async s=>{const r=await p.locator(s).boundingBox();return [r.x+r.width/2,r.y+r.height/2]};
  const J=await bt('.tbtn.jump'),D=await bt('.tbtn.dash'),A=await bt('.tbtn.attack');
  const st=()=>p.evaluate('(()=>{const s=__zanko.sim,q=s.p;return {x:Math.round(q.x),vx:q.vx,vy:+q.vy.toFixed(1),g:q.ground,fast:q.airFast,atk:q.atk&&q.atk.id}})()');
  await T('touchStart',[[120,h-110,1]]);await T('touchMove',[[160,h-110,1]]);await sleep(300);console.log(n,'stick',JSON.stringify(await st()));
  await T('touchStart',[[160,h-110,1],[D[0],D[1],2]]);await sleep(150);console.log(' dash',JSON.stringify(await st()));
  await T('touchMove',[[160,h-110,1],[(D[0]+J[0])/2,(D[1]+J[1])/2,2]]);await T('touchMove',[[160,h-110,1],[J[0],J[1],2]]);await sleep(120);console.log(' slide to jump',JSON.stringify(await st()));await p.screenshot({path:S+n+'_play.png'});
  await T('touchEnd',[[160,h-110,1]]);await T('touchEnd',[]);await sleep(700);
  await T('touchStart',[[A[0],A[1],3]]);await T('touchEnd',[]);await sleep(60);console.log(' quick tap attack',JSON.stringify(await st()));
  console.log(' canvas',await p.evaluate('game.width+"x"+game.height+" view "+Math.round(__zanko.R.VW)'));
  await c.close();}
 console.log('errors',errs);await b.close();})().catch(e=>{console.error('FAIL',e);process.exit(1)});
