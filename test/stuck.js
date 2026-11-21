const {chromium}=require('/opt/npm-tools/node_modules/playwright');const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{const b=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
 const w=844,h=390;const c=await b.newContext({viewport:{width:w,height:h},deviceScaleFactor:2,hasTouch:true,isMobile:true});const p=await c.newPage();
 await p.goto('http://localhost:8770/');await sleep(300);await p.tap('#startBtn');await sleep(400);await p.evaluate('__zanko.sim.enemies.length=0');
 const cdp=await c.newCDPSession(p);const T=(type,pts)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pts.map(([x,y,id])=>({x,y,id}))});
 const bt=async s=>{const r=await p.locator(s).boundingBox();return [r.x+r.width/2,r.y+r.height/2]};const J=await bt('.tbtn.jump'),D=await bt('.tbtn.dash'),A=await bt('.tbtn.attack');
 const inp=async l=>console.log(l.padEnd(46),JSON.stringify(await p.evaluate('__zanko.input()')),'vx',await p.evaluate('__zanko.sim.p.vx'));
 await p.evaluate('window.__ev=[];for(const t of ["pointerdown","pointerup","pointercancel","mousedown","mouseup","touchstart","touchend"])addEventListener(t,e=>__ev.push(t+(e.pointerId!==undefined?"#"+e.pointerId+e.pointerType[0]:"")),true)');
 const S=[150,h-110,1];
 await T('touchStart',[[110,h-110,1]]);await T('touchMove',[S]);await sleep(150);await inp('stick right');
 await T('touchStart',[S,[D[0],D[1],2]]);await sleep(60);await inp('+ DASH down');
 await T('touchEnd',[[D[0],D[1],2]]);await sleep(120);await inp('DASH lifted (stick still down)');
 await sleep(700);await inp('0.7s later');
 await T('touchStart',[S,[J[0],J[1],2]]);await sleep(60);await T('touchEnd',[[J[0],J[1],2]]);await sleep(500);await inp('JUMP tapped and lifted');
 await T('touchEnd',[S]);await sleep(200);await inp('stick lifted');
 console.log(await p.evaluate('__ev.join(" ")'));await p.evaluate('__ev.length=0');
 // quick taps on each button with no stick
 for(const [n,B] of [['DASH',D],['JUMP',J],['ATK',A]]){await T('touchStart',[[B[0],B[1],5]]);await sleep(30);await T('touchEnd',[[B[0],B[1],5]]);await sleep(150);await inp('tap '+n+' -> after');}
 // button finger down first, then stick, lift in the other order
 await T('touchStart',[[D[0],D[1],7]]);await sleep(40);await T('touchStart',[[D[0],D[1],7],[110,h-110,8]]);await T('touchMove',[[D[0],D[1],7],[150,h-110,8]]);await sleep(100);await T('touchEnd',[[150,h-110,8]]);await sleep(100);await inp('DASH held, stick tapped and lifted');await T('touchEnd',[[D[0],D[1],7]]);await sleep(100);await inp('DASH lifted');
 const end=await p.evaluate('__zanko.input()');const left=end.stick!==null||end.pointers.length||end.on.length;console.log(left?'FAIL: input left held '+JSON.stringify(end):'OK: nothing left held');
 await b.close();if(left)process.exit(1);})();
