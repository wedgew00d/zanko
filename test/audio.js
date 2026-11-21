// Renders the music and every effect in an OfflineAudioContext (headless Chromium) and prints their levels.
// Nobody can listen here; this only shows "not far too loud, not far too quiet, no heavy sub bass".
//   python3 -m http.server 8770 &   then   node test/audio.js
const { chromium } = require('/opt/npm-tools/node_modules/playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
  const p = await b.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto('http://localhost:8770/'); await p.waitForTimeout(500);
  const out = await p.evaluate(async () => {
    const AU = ZankoAudio, sr = 44100, db = v => (20 * Math.log10(Math.max(v, 1e-9))).toFixed(1);
    const stat = (buf, from, to) => { const d = buf.getChannelData(0), a = Math.floor(from * sr), z = Math.min(d.length, Math.floor(to * sr)); let s = 0, pk = 0; for (let i = a; i < z; i++) { s += d[i] * d[i]; pk = Math.max(pk, Math.abs(d[i])); } return [Math.sqrt(s / (z - a)), pk]; };
    const res = { music: {}, se: {} };
    for (const [name, drive] of [['play', 1], ['menu', 0]]) {
      const len = 32 * 16 * AU.S16 + 1, c = new OfflineAudioContext(1, Math.ceil(sr * len), sr), g = AU.build(c); g.drive.gain.value = drive; AU.music(g, 0, len - 1);
      const buf = await c.startRendering(), half = 16 * 16 * AU.S16;
      // share of the energy below 80 Hz, from four one-pole low-passes at 80 Hz in a row (a single one lets too much of 110-150 Hz through)
      const d = buf.getChannelData(0); let lo = 0, tot = 0; const y = [0, 0, 0, 0], k = 1 - Math.exp(-2 * Math.PI * 80 / sr); for (let i = 0; i < d.length; i++) { let v = d[i]; for (let q = 0; q < 4; q++) { y[q] += k * (v - y[q]); v = y[q]; } lo += v * v; tot += d[i] * d[i]; }
      res.music[name] = { all: db(stat(buf, 1, len - 1)[0]), firstHalf: db(stat(buf, 1, half)[0]), secondHalf: db(stat(buf, half, len - 1)[0]), peak: db(stat(buf, 0, len)[1]), below80Hz: (lo / tot * 100).toFixed(1) + '%' };
    }
    const evs = [['slash s1', { t: 'slash', id: 's1' }], ['slash s2', { t: 'slash', id: 's2' }], ['slash s3', { t: 'slash', id: 's3' }], ['slash charge', { t: 'slash', id: 'charge' }], ['hit', { t: 'hit' }], ['hit heavy', { t: 'hit', heavy: true }], ['kill', { t: 'kill' }], ['cut', { t: 'cut' }], ['jump', { t: 'jump' }], ['kick', { t: 'kick' }], ['dash', { t: 'dash' }], ['airdash', { t: 'airdash' }], ['land', { t: 'land' }], ['hurt', { t: 'hurt' }], ['die', { t: 'die' }], ['charged', { t: 'charged' }], ['check', { t: 'check' }], ['shot', { t: 'shot' }], ['talk', { t: 'talk' }], ['heal', { t: 'heal' }], ['switch', { t: 'switch' }], ['clear', { t: 'clear' }], ['respawn', { t: 'respawn' }]];
    for (const [name, e] of evs) { const c = new OfflineAudioContext(1, sr * 2.5, sr), g = AU.build(c); AU.sfx(g, e, 0.05); const buf = await c.startRendering(), [r, pk] = stat(buf, 0, 2.5), d = buf.getChannelData(0); let end = 0; for (let i = d.length - 1; i > 0; i--) if (Math.abs(d[i]) > pk * 0.05) { end = i; break; } res.se[name] = 'peak ' + db(pk) + ' dB, to 5% in ' + (end / sr - 0.05).toFixed(2) + ' s'; }
    return res;
  });
  console.log(JSON.stringify(out, null, 1)); console.log('errors', errs); await b.close(); process.exit(errs.length ? 1 : 0);
})();
