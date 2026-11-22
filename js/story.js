// 残光 ZANKO — conversations (placeholder text and names, to be replaced).
// Two kinds:
//   scenes: the game stops, the view dims and blurs, big portraits, text box (ADV style). For the beats of the story.
//   comms : a small window with a face while the game keeps running; lines advance by themselves. Keep each line short.
// Portraits are files in assets/portrait/: <img>.png for the base, <img>_<face>.png for an expression (same size, same position).
// A missing file is fine: the base is used for a missing expression, and a drawn stand-in for a missing base.
window.ZankoStory = {
  cast: {
    hero: { name: '主人公（仮）', img: 'hero', side: 'L', color: '#7fe3ff', faceBox: [0.586, 0.159, 0.552] },   // faceBox: centre x, centre y, width of the face in the portrait (printed by tools/portrait.py); the comm window shows that part            // color: the frame of her comm window (cyan = the player's side; amber stays reserved for enemies)
    op: { name: 'オペレーター（仮）', img: 'op', side: 'R', color: '#bcd7ff', faceBox: [0.528, 0.175, 0.706] },   // drawn facing screen-left, so no mirroring (flip: true would mirror art drawn facing right, and with it one-sided things such as the headset)
  },
  faces: ['smile', 'serious', 'worry', 'surprise', 'talk'],
  scenes: {
    intro: [
      { who: 'op', text: '接続を確認。聞こえる？　ここは訓練区画。まずは体を慣らして。' },
      { who: 'hero', face: 'serious', text: '聞こえてる。……久しぶりだな、この感覚。' },
      { who: 'op', face: 'serious', text: '奥の隔壁の先まで行ければ合格。途中の標的は、斬っても避けてもいい。' },
      { who: 'hero', face: 'smile', text: '斬るほうが早い。' },
      { who: 'op', face: 'smile', text: '言うと思った。記録を始めるよ。' },
    ],
    outro: [
      { who: 'op', face: 'smile', text: '到達を確認。お疲れさま。' },
      { who: 'hero', face: 'smile', text: '体は鈍ってない。次を出してくれ。' },
      { who: 'op', face: 'worry', text: '少しは休んで。結果を出すね。' },
    ],
  },
  // col: the level column (16 units each) at which the lines start, once per run
  comms: [
    { col: 12, who: 'op', lines: ['前方に標的。', '攻撃を続けて押すと、三段になる。'] },
    { col: 80, who: 'op', face: 'worry', lines: ['その先、床に棘。', 'ダッシュしてから跳べば越えられる。'] },
    { col: 132, who: 'op', lines: ['隔壁が閉じてる。', '近くの制御盤を動かして。'] },
  ],
};
