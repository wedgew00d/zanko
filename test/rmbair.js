const {chromium}=require('/opt/npm-tools/node_modules/playwright');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});const errs=[];
 const c=await b.newContext({viewport:{width:1280,height:720}});const p=await c.newPage();p.on('pageerror',e=>errs.push(e.message));
 await p.goto('http://localhost:8770/');await sleep(300);await p.click('#startBtn');await sleep(300);await p.mouse.move(700,300);const R={button:'right'};
 const st=()=>p.evaluate('(()=>{const q=__zanko.sim.p;return {x:Math.round(q.x),y:Math.round(q.y),vy:+q.vy.toFixed(1),g:q.ground,air:q.airDashT,ok:q.airDashOK,wall:q.wall}})()');
 await p.evaluate('__zanko.sim.enemies.length=0');await p.keyboard.down('KeyD');
 await p.mouse.down(R);await sleep(230);await p.mouse.up(R);await sleep(30);console.log('jumped (right held 230ms)   ',JSON.stringify(await st()));
 await p.mouse.down(R);await sleep(50);console.log('right again in the air      ',JSON.stringify(await st()),'(expect: air > 0)');await p.mouse.up(R);
 await sleep(120);await p.mouse.down(R);await sleep(50);console.log('third press, same jump      ',JSON.stringify(await st()),'(expect: no new air dash)');await p.mouse.up(R);await sleep(900);
 console.log('landed                      ',JSON.stringify(await st()));
 // Space jump then right click: also air dash
 await p.keyboard.down('Space');await sleep(200);await p.mouse.down(R);await sleep(50);console.log('Space jump + right in the air',JSON.stringify(await st()),'(expect: air > 0)');await p.mouse.up(R);await p.keyboard.up('Space');await sleep(900);
 // at a wall: still a wall kick
 await p.evaluate('(()=>{const q=__zanko.sim.p;q.x=64*16;q.y=26*16})()');await sleep(100);await p.mouse.down(R);await sleep(60);await p.mouse.up(R);await sleep(420);const a=await st();
 await p.mouse.down(R);await sleep(50);const k=await st();console.log('right at a wall             ',JSON.stringify(a),'->',JSON.stringify(k),'(expect: kicked up, air 0)');await p.mouse.up(R);await p.keyboard.up('KeyD');
 console.log('errors',errs);await b.close();})();
