// Nhạc nền: tự tổng hợp bằng Web Audio (không cần tải file nhạc). Mỗi bài là một vòng hợp âm cùng kiểu đệm và
// một giai điệu ngẫu nhiên có kiểm soát, nên nghe không lặp lại y hệt. Hết một bài thì tự chuyển sang bài kế.
(function () {
  'use strict';
  var BARS_PER_TRACK = 48;

  // Nốt viết theo số MIDI (60 = Đô giữa). chordBars: số ô nhịp cho mỗi hợp âm.
  var TRACKS = [
    { style: 'piano', bpm: 68, chordBars: 1, // Suy tư — Am F C G
      chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
      scale: [69, 71, 72, 74, 76, 77, 79, 81] },
    { style: 'jazz', bpm: 84, chordBars: 1, // Khai cuộc — Cmaj7 Am7 Dm7 G7
      chords: [[48, 52, 55, 59], [45, 52, 55, 60], [50, 53, 57, 60], [43, 53, 55, 59]],
      scale: [72, 74, 76, 79, 81, 84, 86] },
    { style: 'pad', bpm: 58, chordBars: 2, // Tàn cuộc — Dm Bb Gm A
      chords: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]],
      scale: [74, 76, 77, 79, 81, 82, 84, 86] },
    { style: 'lofi', bpm: 76, chordBars: 1, // Mưa đêm — Fmaj7 Em7 Dm7 Cmaj7
      chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]],
      scale: [72, 74, 76, 77, 79, 81, 84] },
    { style: 'baroque', bpm: 92, chordBars: 0.5, // Ván cờ hoàng gia — D A Bm F#m G D G A
      chords: [[50, 54, 57], [45, 49, 52], [47, 50, 54], [42, 45, 49], [43, 47, 50], [50, 54, 57], [43, 47, 50], [45, 49, 52]],
      scale: [74, 76, 78, 79, 81, 83, 85, 86] }
  ];

  var ctx = null, out = null, reverb = null, bus = null;
  var state = { on: false, track: 0, vol: 50 };
  var timer = null, step = 0, nextT = 0, mel = 0, rnd = Math.random, onChange = null;

  function getCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }
  function freq(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function gainOf(v) { return Math.pow(v / 100, 2) * 0.6; }

  function setup() {
    if (out) return;
    out = ctx.createGain();
    out.gain.value = gainOf(state.vol);
    out.connect(ctx.destination);
    // hồi âm nhân tạo: nhiễu trắng tắt dần
    reverb = ctx.createConvolver();
    var len = ctx.sampleRate * 2.6, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = ir.getChannelData(ch);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    reverb.buffer = ir;
    var wet = ctx.createGain();
    wet.gain.value = 0.35;
    reverb.connect(wet); wet.connect(out);
  }
  function newBus() {
    var g = ctx.createGain();
    g.gain.value = 1;
    g.connect(out); g.connect(reverb);
    return g;
  }

  // ---------- nhạc cụ ----------
  function env(t, peak, attack, decay) {
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(bus);
    return g;
  }
  function osc(type, f, t, dur, dest, detune) {
    var o = ctx.createOscillator();
    o.type = type; o.frequency.value = f;
    if (detune) o.detune.value = detune;
    o.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }
  function piano(m, t, vel, len) {
    var d = len || 1.6, g = env(t, 0.16 * vel, 0.006, d);
    var lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(3200, t); lp.frequency.exponentialRampToValueAtTime(700, t + d);
    lp.connect(g);
    osc('triangle', freq(m), t, d, lp);
    osc('sine', freq(m + 12), t, d * 0.5, lp);
  }
  function epiano(m, t, vel, len) {
    var d = len || 1.4, g = env(t, 0.13 * vel, 0.01, d);
    osc('sine', freq(m), t, d, g);
    var g2 = env(t, 0.03 * vel, 0.004, 0.25);
    osc('sine', freq(m) * 4, t, 0.3, g2);
  }
  function pad(ms, t, dur) {
    var g = ctx.createGain(), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.05, t + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.8);
    lp.connect(g); g.connect(bus);
    ms.forEach(function (m) { osc('sawtooth', freq(m), t, dur + 0.8, lp, -7); osc('sawtooth', freq(m), t, dur + 0.8, lp, 7); });
  }
  function bass(m, t, vel, len) {
    var g = env(t, 0.22 * vel, 0.01, len || 0.9);
    osc('sine', freq(m), t, len || 0.9, g);
  }
  function pluck(m, t, vel) {
    var g = env(t, 0.09 * vel, 0.003, 0.45), lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.setValueAtTime(4000, t); lp.frequency.exponentialRampToValueAtTime(600, t + 0.4);
    lp.connect(g);
    osc('sawtooth', freq(m), t, 0.45, lp);
  }
  var noiseBuf = null;
  function hat(t, vel) {
    if (!noiseBuf) {
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    var s = ctx.createBufferSource(), hp = ctx.createBiquadFilter(), g = env(t, 0.03 * vel, 0.002, 0.05);
    hp.type = 'highpass'; hp.frequency.value = 7000;
    s.buffer = noiseBuf; s.connect(hp); hp.connect(g); s.start(t); s.stop(t + 0.1);
  }
  function kick(t) {
    var g = env(t, 0.25, 0.003, 0.25), o = ctx.createOscillator();
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(45, t + 0.2);
    o.connect(g); o.start(t); o.stop(t + 0.3);
  }

  // Giai điệu: đi dần từng bậc trong thang âm, thỉnh thoảng nhảy về nốt của hợp âm
  function melody(tr, chord, t, prob, play, vel) {
    if (rnd() > prob) return;
    var sc = tr.scale;
    if (rnd() < 0.3) {
      var target = chord[Math.floor(rnd() * chord.length)] + 24, best = 0;
      sc.forEach(function (n, i) { if (Math.abs(n - target) < Math.abs(sc[best] - target)) best = i; });
      mel = best;
    } else mel = Math.max(0, Math.min(sc.length - 1, mel + Math.floor(rnd() * 5) - 2));
    play(sc[mel], t, vel);
  }

  // Một nốt móc đơn (8 bước mỗi ô nhịp 4/4)
  function playStep(tr, s, t, e) {
    var per = Math.round(8 * tr.chordBars), ch = tr.chords[Math.floor(s / per) % tr.chords.length];
    var i = s % 8, first = s % per === 0, top = ch.concat(ch[0] + 12);
    switch (tr.style) {
      case 'piano':
        if (i === 0) bass(ch[0] - 12, t, 0.9, e * 7);
        piano(top[[0, 1, 2, 1, 3, 2, 1, 2][i]] + 12, t, i === 0 ? 0.9 : 0.6, e * 4);
        if (i % 3 === 0) melody(tr, ch, t, 0.5, piano, 0.8);
        break;
      case 'jazz':
        if (i === 0 || i === 4) bass(ch[0] - (i ? 5 : 12), t, 0.8, e * 3.5);
        if (i === 0 || i === 3) ch.forEach(function (m) { epiano(m + 12, t, i ? 0.45 : 0.6, e * (i ? 2 : 3)); });
        hat(t + (i % 2 ? e * 0.15 : 0), i % 2 ? 0.6 : 1);
        if (i !== 0) melody(tr, ch, t, 0.32, epiano, 0.9);
        break;
      case 'pad':
        if (first) { pad(ch.map(function (m) { return m + 12; }), t, e * per); bass(ch[0] - 12, t, 0.9, e * per * 0.9); }
        if (i === 0 || i === 4) melody(tr, ch, t, 0.45, piano, 0.7);
        break;
      case 'lofi':
        if (i === 0) { ch.forEach(function (m) { epiano(m + 12, t, 0.5, e * 7); }); bass(ch[0] - 12, t, 0.8, e * 3); }
        if (i === 0 || i === 5) kick(t);
        hat(t + (i % 2 ? e * 0.2 : 0), i % 2 ? 0.5 : 0.8);
        melody(tr, ch, t + (i % 2 ? e * 0.2 : 0), 0.28, piano, 0.6);
        break;
      case 'baroque':
        if (i % 4 === 0) bass(ch[0] - 12, t, 0.8, e * 3.5);
        pluck(top[[0, 2, 1, 2][i % 4]] + 12, t, 0.7);
        melody(tr, ch, t, 0.55, pluck, 1);
        break;
    }
  }

  function tick() {
    var tr = TRACKS[state.track], e = 30 / tr.bpm, ahead = document.hidden ? 1.5 : 0.25;
    while (nextT < ctx.currentTime + ahead) {
      playStep(tr, step, nextT, e);
      nextT += e;
      step++;
      if (step >= BARS_PER_TRACK * 8) { setTrack((state.track + 1) % TRACKS.length); return; }
    }
  }

  function stopBus(fade) {
    if (!bus) return;
    var b = bus, t = ctx.currentTime;
    b.gain.cancelScheduledValues(t);
    b.gain.setValueAtTime(b.gain.value, t);
    b.gain.linearRampToValueAtTime(0, t + fade);
    setTimeout(function () { b.disconnect(); }, fade * 1000 + 3000);
    bus = null;
  }
  function start() {
    if (!getCtx()) return;
    setup();
    stopBus(0.4);
    clearInterval(timer);
    bus = newBus();
    step = 0; mel = 3; nextT = ctx.currentTime + 0.15;
    timer = setInterval(tick, 60);
    tick();
  }
  function stop() {
    clearInterval(timer); timer = null;
    if (ctx) stopBus(0.6);
  }

  function save() {
    try { localStorage.setItem('rf.music', JSON.stringify(state)); } catch (e) { /* bỏ qua */ }
    if (onChange) onChange(state);
  }
  function setOn(on) {
    state.on = !!on;
    if (state.on) start(); else stop();
    save();
  }
  function setTrack(i) {
    state.track = (i + TRACKS.length) % TRACKS.length;
    if (state.on) start();
    save();
  }
  function setVolume(v) {
    state.vol = Math.max(0, Math.min(100, +v));
    if (out) out.gain.setTargetAtTime(gainOf(state.vol), ctx.currentTime, 0.05);
    save();
  }

  try {
    var saved = JSON.parse(localStorage.getItem('rf.music'));
    if (saved) for (var k in state) if (k in saved) state[k] = saved[k];
    state.track = Math.max(0, Math.min(TRACKS.length - 1, state.track | 0));
  } catch (e) { /* dùng mặc định */ }

  // Trình duyệt chỉ cho phát âm thanh sau thao tác đầu tiên của người dùng
  if (state.on) {
    var resume = function () {
      document.removeEventListener('pointerdown', resume, true);
      document.removeEventListener('keydown', resume, true);
      if (state.on && !timer) start();
    };
    document.addEventListener('pointerdown', resume, true);
    document.addEventListener('keydown', resume, true);
  }

  window.Music = {
    ctx: getCtx, count: TRACKS.length, state: function () { return state; },
    setOn: setOn, setTrack: setTrack, setVolume: setVolume,
    onChange: function (fn) { onChange = fn; }
  };
})();
