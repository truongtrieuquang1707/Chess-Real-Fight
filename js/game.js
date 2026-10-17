// Cờ vua chiến binh: cảnh 3D, điều khiển, diễn biến ván cờ, hoạt ảnh di chuyển / chiến đấu, hiệu ứng và âm thanh.
(function () {
  'use strict';
  var T3 = window.THREE, Ch = window.Characters, C = window.Chess, Game = C.Game;
  var $ = function (id) { return document.getElementById(id); };
  var KIND = ' PNBRQK';
  var NAME = { P: 'Lính', N: 'Hiệp sĩ', B: 'Giáo sĩ', R: 'Vệ binh', Q: 'Nữ hoàng', K: 'Nhà vua' };
  var GLYPH = ['', '♟', '♞', '♝', '♜', '♛', '♚'];

  // ---------- trạng thái ----------
  var prefs = { opp: 'ai', side: '0', elo: 1000, cam: true, speed: 1 };
  try { var sv = JSON.parse(localStorage.getItem('rf.prefs')); if (sv) for (var k in prefs) if (k in sv) prefs[k] = sv[k]; } catch (e) { /* mặc định */ }
  function savePrefs() { try { localStorage.setItem('rf.prefs', JSON.stringify(prefs)); } catch (e) { /* bỏ qua */ } }
  var S = { game: new Game(), hist: [], keys: {}, actors: {}, sel: -1, targets: [], busy: false, over: null,
    opp: 'ai', human: 0, elo: 1000, gameId: 0, thinking: false, sound: true };

  // ---------- cảnh 3D ----------
  var wrap = $('stage');
  var renderer = new T3.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T3.PCFSoftShadowMap;
  renderer.outputEncoding = T3.sRGBEncoding;
  renderer.toneMapping = T3.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  wrap.appendChild(renderer.domElement);
  var scene = new T3.Scene();
  scene.background = new T3.Color(0x1a2131).convertSRGBToLinear();
  scene.fog = new T3.Fog(scene.background.getHex(), 20, 46);
  // bản đồ môi trường cho kim loại phản chiếu: bầu trời chiều chuyển màu + vài mảng sáng
  (function () {
    var env = new T3.Scene(), n = 32, geoS = new T3.SphereGeometry(10, n, n / 2), cols = [];
    var top = new T3.Color(0x9bb4e8), mid = new T3.Color(0xf3d2a2), bot = new T3.Color(0x3a2c22), pos = geoS.attributes.position;
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i) / 10, cc = y > 0 ? mid.clone().lerp(top, Math.pow(y, 0.6)) : mid.clone().lerp(bot, Math.pow(-y, 0.4));
      cols.push(cc.r, cc.g, cc.b);
    }
    geoS.setAttribute('color', new T3.Float32BufferAttribute(cols, 3));
    env.add(new T3.Mesh(geoS, new T3.MeshBasicMaterial({ vertexColors: true, side: T3.BackSide })));
    [[6, 5, 3, 4], [-7, 3, -2, 2.5], [0, 8, -6, 3]].forEach(function (p) {
      var pl = new T3.Mesh(new T3.PlaneGeometry(p[3], p[3] * 0.6), new T3.MeshBasicMaterial({ color: 0xffffff, side: T3.DoubleSide }));
      pl.position.set(p[0], p[1], p[2]); pl.lookAt(0, 0, 0); env.add(pl);
    });
    var pm = new T3.PMREMGenerator(renderer);
    scene.environment = pm.fromScene(env, 0.02).texture;
  })();
  var camera = new T3.PerspectiveCamera(42, 1, 0.1, 120);

  scene.add(new T3.HemisphereLight(0xbcd0ff, 0x3b2c1e, 0.6));
  var sun = new T3.DirectionalLight(0xffe0b5, 2.4);
  sun.position.set(6, 13, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  var sc = sun.shadow.camera;
  sc.left = -8; sc.right = 8; sc.top = 8; sc.bottom = -8; sc.near = 1; sc.far = 40;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  var moon = new T3.DirectionalLight(0x6f86c9, 0.6);
  moon.position.set(-8, 6, -6);
  scene.add(moon);

  var mat = Ch.mat, G = Ch.G, mesh = Ch.mesh, group = Ch.group;
  // mặt đất và bàn cờ
  var ground = mesh(new T3.CircleGeometry(40, 48), mat(0x2c3a22, { rough: 1 }), scene, 0, -0.62, 0);
  ground.rotation.x = -Math.PI / 2;
  ground.castShadow = false;
  var dirt = mesh(new T3.CircleGeometry(8.5, 40), mat(0x4a3c2a, { rough: 1 }), scene, 0, -0.6, 0);
  dirt.rotation.x = -Math.PI / 2;
  dirt.castShadow = false;
  mesh(G.box(10.2, 0.5, 10.2), mat(0x51463c, { rough: 0.9 }), scene, 0, -0.4, 0);
  mesh(G.box(9.3, 0.18, 9.3), mat(0x5a3a22, { rough: 0.8 }), scene, 0, -0.1, 0);
  [[0, 4.62, 9.4, 0.07], [0, -4.62, 9.4, 0.07], [4.62, 0, 0.07, 9.4], [-4.62, 0, 0.07, 9.4]].forEach(function (b) {
    mesh(G.box(b[2], 0.05, b[3]), mat(0xd4a93c, { metal: 0.7, rough: 0.35 }), scene, b[0], 0.0, b[1]);
  });
  var squares = [];
  for (var sq = 0; sq < 64; sq++) {
    var light = ((sq >> 3) + (sq & 7)) % 2 === 0, v = (Math.random() - 0.5) * 0.06;
    var col = new T3.Color(light ? 0xb9a684 : 0x4c3c2e).offsetHSL(0, 0, v).convertSRGBToLinear();
    var m = new T3.MeshStandardMaterial({ color: col, roughness: light ? 0.5 : 0.6 });
    m.envMapIntensity = 0.5;
    var s = mesh(G.box(0.98, 0.12, 0.98), m, scene, (sq & 7) - 3.5, -0.06, (sq >> 3) - 3.5);
    s.castShadow = false;
    s.userData.sq = sq;
    squares.push(s);
  }
  // chữ tọa độ
  function label(text, x, z) {
    var cv = document.createElement('canvas');
    cv.width = cv.height = 64;
    var c2 = cv.getContext('2d');
    c2.fillStyle = '#e9c560';
    c2.font = 'bold 44px Georgia, serif';
    c2.textAlign = 'center'; c2.textBaseline = 'middle';
    c2.fillText(text, 32, 34);
    var tx = new T3.CanvasTexture(cv);
    var p = new T3.Mesh(new T3.PlaneGeometry(0.34, 0.34), new T3.MeshBasicMaterial({ map: tx, transparent: true }));
    p.rotation.x = -Math.PI / 2;
    p.position.set(x, 0.005, z);
    scene.add(p);
    return p;
  }
  var labels = [];
  for (var i = 0; i < 8; i++) {
    labels.push(label('abcdefgh'[i], i - 3.5, 4.32), label('abcdefgh'[i], i - 3.5, -4.32));
    labels.push(label(String(8 - i), -4.32, i - 3.5), label(String(8 - i), 4.32, i - 3.5));
  }
  // tháp canh bốn góc, mỗi tháp có một ngọn đuốc
  var flames = [];
  [[-1, 1, 0], [1, 1, 0], [-1, -1, 1], [1, -1, 1]].forEach(function (p) {
    var g = group(scene, p[0] * 5.0, -0.15, p[1] * 5.0), team = Ch.TEAM[p[2]];
    mesh(G.cyl(0.55, 0.62, 1.9, 10), mat(0x7d746a, { rough: 0.95 }), g, 0, 0.95, 0);
    for (var j = 0; j < 8; j++) {
      var a = j / 8 * Math.PI * 2;
      mesh(G.box(0.2, 0.22, 0.2), mat(0x8a8178, { rough: 0.95 }), g, Math.cos(a) * 0.5, 2.0, Math.sin(a) * 0.5);
    }
    mesh(G.cone(0.5, 0.9, 10), mat(team.cloth, { rough: 0.6 }), g, 0, 2.55, 0);
    mesh(G.cyl(0.015, 0.015, 0.5, 5), mat(0x5b3b22), g, 0, 3.2, 0);
    var fl = mesh(G.box(0.3, 0.18, 0.01), mat(team.cloth), g, 0.16, 3.35, 0);
    var torch = group(g, -p[0] * 0.62, 1.3, -p[1] * 0.62);
    mesh(G.cyl(0.035, 0.025, 0.3, 6), mat(0x4a2f1b), torch, 0, 0, 0);
    var fire = mesh(G.cone(0.08, 0.2, 7), new T3.MeshBasicMaterial({ color: 0xffa640 }), torch, 0, 0.24, 0);
    fire.castShadow = false;
    var pl = new T3.PointLight(0xff9440, 1.6, 7, 2);
    pl.position.set(0, 0.35, 0);
    torch.add(pl);
    flames.push({ fire: fire, light: pl, flag: fl, ph: Math.random() * 10 });
  });

  // ---------- camera quỹ đạo ----------
  var cam = { theta: 0, phi: 0.92, radius: 12.5, target: new T3.Vector3(0, 0, 0.3) };
  var camGoal = { theta: 0, phi: 0.92, radius: 12.5, target: new T3.Vector3(0, 0, 0.3) };
  var shake = 0;
  function sideTheta(side) { return side ? Math.PI : 0; }
  function updateCamera(dt) {
    var f = 1 - Math.exp(-dt * 4);
    var dTh = camGoal.theta - cam.theta;
    cam.theta += dTh * f;
    cam.phi += (camGoal.phi - cam.phi) * f;
    cam.radius += (camGoal.radius - cam.radius) * f;
    cam.target.lerp(camGoal.target, f);
    var sp = Math.sin(cam.phi);
    camera.position.set(cam.target.x + cam.radius * sp * Math.sin(cam.theta), cam.target.y + cam.radius * Math.cos(cam.phi),
      cam.target.z + cam.radius * sp * Math.cos(cam.theta));
    if (shake > 0) {
      camera.position.x += (Math.random() - 0.5) * shake;
      camera.position.y += (Math.random() - 0.5) * shake;
      shake = Math.max(0, shake - dt * 0.6);
    }
    camera.lookAt(cam.target);
  }
  var userCam = { theta: 0, phi: 0.92, radius: 12.5 };
  function camHome() {
    camGoal.theta = userCam.theta; camGoal.phi = userCam.phi; camGoal.radius = userCam.radius;
    camGoal.target.set(0, 0, 0);
  }
  function camFocus(p, facing) {
    if (!prefs.cam) return;
    camGoal.target.set(p.x, 0.35, p.z);
    camGoal.radius = 4.6;
    camGoal.phi = 1.05;
    // nhìn ngang trận đánh, lệch một chút về phía người chơi
    var base = userCam.theta, a = facing + Math.PI / 2;
    var cands = [a, a + Math.PI];
    var best = cands.reduce(function (x, y) {
      return Math.abs(angDiff(x, base)) < Math.abs(angDiff(y, base)) ? x : y;
    });
    camGoal.theta = cam.theta + angDiff(best, cam.theta);
  }
  function angDiff(a, b) { var d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; }

  function resize() {
    var w = wrap.clientWidth, h = wrap.clientHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    // màn hình dọc: lùi camera xa hơn để thấy trọn bàn cờ
    camera.fov = w / h < 0.8 ? 58 : 42;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);

  // ---------- tween / hẹn giờ theo khung hình ----------
  var tweens = [];
  function tween(dur, fn) {
    return new Promise(function (res) { tweens.push({ t: 0, dur: Math.max(0.001, dur), fn: fn, res: res }); });
  }
  function wait(sec) { return tween(sec, function () {}); }
  function ease(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
  function easeOut(k) { return 1 - Math.pow(1 - k, 3); }
  function easeIn(k) { return k * k * k; }
  function lerp(a, b, k) { return a + (b - a) * k; }

  // ---------- hiệu ứng ----------
  var fx = [];
  var sparkGeo = new T3.BoxGeometry(0.035, 0.035, 0.035), puffGeo = new T3.SphereGeometry(0.08, 6, 5), orbGeo = new T3.SphereGeometry(0.07, 10, 8);
  function sparks(p, color, n, speed) {
    var m = new T3.MeshBasicMaterial({ color: color, transparent: true, blending: T3.AdditiveBlending, depthWrite: false });
    for (var i = 0; i < (n || 16); i++) {
      var s = new T3.Mesh(sparkGeo, m);
      s.position.copy(p);
      scene.add(s);
      var a = Math.random() * Math.PI * 2, up = Math.random();
      fx.push({ obj: s, mat: m, life: 0.55, age: 0, g: 6,
        v: new T3.Vector3(Math.cos(a) * (1 - up * 0.5), up * 1.4 + 0.4, Math.sin(a) * (1 - up * 0.5)).multiplyScalar((speed || 2.2) * (0.5 + Math.random())) });
    }
  }
  function dust(p, n, color) {
    for (var i = 0; i < (n || 10); i++) {
      var m = new T3.MeshStandardMaterial({ color: color || 0x9b8f7e, transparent: true, opacity: 0.7, roughness: 1, depthWrite: false });
      var s = new T3.Mesh(puffGeo, m);
      s.position.set(p.x + (Math.random() - 0.5) * 0.4, p.y + 0.05, p.z + (Math.random() - 0.5) * 0.4);
      scene.add(s);
      var a = Math.random() * Math.PI * 2;
      fx.push({ obj: s, mat: m, life: 0.9 + Math.random() * 0.4, age: 0, g: -0.3, grow: 2.2, fade: 0.7,
        v: new T3.Vector3(Math.cos(a) * 0.6, 0.25 + Math.random() * 0.3, Math.sin(a) * 0.6) });
    }
  }
  function flash(p, color, power) {
    var l = new T3.PointLight(color, power || 3, 5, 2);
    l.position.copy(p);
    scene.add(l);
    fx.push({ obj: l, light: true, life: 0.35, age: 0, p0: power || 3 });
  }
  // quả cầu năng lượng bay từ a tới b
  function projectile(a, b, color, dur, curve) {
    var m = new T3.MeshBasicMaterial({ color: color });
    var o = new T3.Mesh(orbGeo, m);
    var l = new T3.PointLight(color, 1.6, 3, 2);
    o.add(l);
    scene.add(o);
    var mid = a.clone().lerp(b, 0.5);
    mid.y += 0.6 + (curve || 0) * 0.3;
    var side = new T3.Vector3(b.z - a.z, 0, a.x - b.x).normalize().multiplyScalar((curve || 0) * 0.5);
    mid.add(side);
    var last = 0;
    return tween(dur, function (k) {
      var u = 1 - k;
      o.position.set(u * u * a.x + 2 * u * k * mid.x + k * k * b.x, u * u * a.y + 2 * u * k * mid.y + k * k * b.y, u * u * a.z + 2 * u * k * mid.z + k * k * b.z);
      if (k - last > 0.08) { last = k; sparks(o.position, color, 2, 0.4); }
      if (k >= 1) scene.remove(o);
    });
  }
  function updateFx(dt) {
    for (var i = fx.length - 1; i >= 0; i--) {
      var f = fx[i];
      f.age += dt;
      var k = f.age / f.life;
      if (k >= 1) {
        scene.remove(f.obj);
        if (f.mat) f.mat.dispose();
        fx.splice(i, 1);
        continue;
      }
      if (f.light) { f.obj.intensity = f.p0 * (1 - k); continue; }
      f.v.y -= f.g * dt;
      f.obj.position.addScaledVector(f.v, dt);
      if (f.grow) f.obj.scale.setScalar(1 + k * f.grow);
      f.mat.opacity = (f.fade || 1) * (1 - k);
    }
  }

  // ---------- âm thanh tổng hợp ----------
  var sfxVol = 0.8;
  function actx() { try { return window.Music.ctx(); } catch (e) { return null; } }
  function noiseBuf(a, len) {
    var b = a.createBuffer(1, Math.floor(a.sampleRate * len), a.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  var NB = null;
  function noise(a, t, dur, type, f, q, gain) {
    NB = NB || noiseBuf(a, 1);
    var s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
    s.buffer = NB; fl.type = type; fl.frequency.value = f; fl.Q.value = q || 1;
    g.gain.setValueAtTime(gain * sfxVol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    s.connect(fl); fl.connect(g); g.connect(a.destination);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }
  function tone(a, t, f1, f2, dur, type, gain) {
    var o = a.createOscillator(), g = a.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f1, t);
    if (f2 !== f1) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(gain * sfxVol, t);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(g); g.connect(a.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function sfx(kind) {
    if (!S.sound) return;
    var a = actx();
    if (!a) return;
    var t = a.currentTime;
    try {
      if (kind === 'step') noise(a, t, 0.07, 'lowpass', 380, 0.7, 0.35);
      else if (kind === 'hoof') { noise(a, t, 0.05, 'bandpass', 900, 3, 0.5); tone(a, t, 200, 120, 0.05, 'sine', 0.15); }
      else if (kind === 'clash') {
        noise(a, t, 0.18, 'highpass', 2500, 0.8, 0.5);
        tone(a, t, 1870, 1840, 0.6, 'sine', 0.12); tone(a, t, 2790, 2760, 0.45, 'sine', 0.07); tone(a, t, 3520, 3500, 0.3, 'sine', 0.04);
      } else if (kind === 'thrust') { noise(a, t, 0.12, 'bandpass', 1500, 2, 0.35); tone(a, t, 900, 700, 0.15, 'triangle', 0.08); }
      else if (kind === 'smash') { tone(a, t, 110, 40, 0.5, 'sine', 0.7); noise(a, t, 0.45, 'lowpass', 600, 0.7, 0.7); }
      else if (kind === 'swing') noise(a, t, 0.22, 'bandpass', 700, 1.5, 0.25);
      else if (kind === 'magic') { tone(a, t, 380, 1500, 0.45, 'sine', 0.15); tone(a, t + 0.05, 570, 2200, 0.4, 'triangle', 0.06); }
      else if (kind === 'boom') { tone(a, t, 260, 60, 0.4, 'sine', 0.35); noise(a, t, 0.35, 'lowpass', 1800, 0.7, 0.35); }
      else if (kind === 'neigh') { tone(a, t, 700, 1100, 0.18, 'sawtooth', 0.04); tone(a, t + 0.17, 1050, 600, 0.35, 'sawtooth', 0.04); }
      else if (kind === 'fall') { noise(a, t, 0.3, 'lowpass', 250, 0.7, 0.6); tone(a, t, 90, 50, 0.3, 'sine', 0.3); }
      else if (kind === 'select') tone(a, t, 660, 660, 0.08, 'triangle', 0.08);
      else if (kind === 'check') { tone(a, t, 233, 233, 0.22, 'sawtooth', 0.07); tone(a, t + 0.22, 311, 311, 0.4, 'sawtooth', 0.07); }
      else if (kind === 'fanfare') {
        [392, 494, 587, 784].forEach(function (f, i) { tone(a, t + i * 0.16, f, f, i === 3 ? 0.8 : 0.2, 'triangle', 0.12); });
      } else if (kind === 'promote') { [523, 659, 784, 1047].forEach(function (f, i) { tone(a, t + i * 0.07, f, f, 0.35, 'sine', 0.1); }); }
    } catch (e) { /* bỏ qua lỗi âm thanh */ }
  }

  // ---------- nhân vật trên bàn ----------
  function sqPos(sq) { return new T3.Vector3((sq & 7) - 3.5, 0, (sq >> 3) - 3.5); }
  function forwardAngle(color) { return color === 0 ? Math.PI : 0; }
  function spawn(code, sq) {
    var rig = Ch.create(KIND[code & 7], code >> 3);
    rig.code = code;
    rig.sq = sq;
    rig.state = 'idle';
    rig.root.position.copy(sqPos(sq));
    rig.root.rotation.y = forwardAngle(code >> 3);
    scene.add(rig.root);
    return rig;
  }
  function clearActors() {
    Object.keys(S.actors).forEach(function (k) { scene.remove(S.actors[k].root); });
    S.actors = {};
  }
  function syncActors() {
    clearActors();
    for (var sq = 0; sq < 64; sq++) if (S.game.b[sq]) S.actors[sq] = spawn(S.game.b[sq], sq);
  }

  function faceAngle(from, to) { return Math.atan2(to.x - from.x, to.z - from.z); }
  function turnTo(rig, ang, dur) {
    var a0 = rig.root.rotation.y, d = angDiff(ang, a0);
    if (Math.abs(d) < 0.02) return Promise.resolve();
    return tween(dur || 0.22, function (k) { rig.root.rotation.y = a0 + d * ease(k); });
  }

  // Đi (hoặc nhảy với Hiệp sĩ) tới điểm `to`
  function walkTo(rig, to, opts) {
    opts = opts || {};
    var from = rig.root.position.clone(), dist = from.distanceTo(to);
    if (dist < 0.01) return Promise.resolve();
    var knight = rig.kind === 'N', speed = opts.speed || (knight ? 2.6 : 1.8);
    return turnTo(rig, faceAngle(from, to)).then(function () {
      rig.state = 'walk';
      var dur = dist / speed + 0.08, stepAt = 0, freq = knight ? 9 : 8;
      return tween(dur, function (k) {
        var e = opts.jump ? ease(k) : k < 0.12 ? k * k / 0.24 / 0.88 : k > 0.88 ? 1 - (1 - k) * (1 - k) / 0.24 / 0.88 : (k - 0.06) / 0.88;
        e = Math.max(0, Math.min(1, e));
        rig.root.position.lerpVectors(from, to, e);
        var amt = Math.min(1, k * 6, (1 - k) * 6);
        if (opts.jump) {
          rig.root.position.y = Math.sin(Math.PI * k) * (0.35 + dist * 0.15);
          if (rig.horseBody) rig.horseBody.rotation.x = -Math.cos(Math.PI * k) * 0.35;
          rig.hLegs.forEach(function (l, i) { l.rotation.x = (i < 2 ? -1 : 1) * Math.sin(Math.PI * k) * 0.8; });
        } else Ch.walk(rig, dist * e * freq, amt, elapsed);
        if (opts.jump) { rig.speed = 1; Ch.cloth(rig, elapsed); }
        var st = Math.floor(dist * e * freq / Math.PI);
        if (st > stepAt) { stepAt = st; if (!opts.jump) sfx(knight ? 'hoof' : 'step'); }
      }).then(function () {
        rig.root.position.copy(to);
        if (opts.jump) { sfx('hoof'); dust(to, 6); }
        Ch.rest(rig);
        rig.state = 'idle';
      });
    });
  }

  // ---------- đòn đánh ----------
  // Trả về Promise; onImpact được gọi đúng lúc vũ khí chạm đối phương
  function strike(att, vic, onImpact) {
    var r = att, A = r.armR, W = r.weapon, B = r.body, aim = vic.root.position.clone().setY(0.55);
    var a0 = A.rotation.x, z0 = A.rotation.z, w0 = W.rotation.x, bz = B.position.z, by = B.position.y, F = r.foreR, f0 = F.rotation.x;
    r.state = 'attack';
    tween(0.25, function (k) { F.rotation.x = lerp(f0, -0.1, k); });
    var done = function () { return tween(0.3, function (k) { F.rotation.x = lerp(F.rotation.x, r.restFore.R, k); A.rotation.x = lerp(A.rotation.x, r.restArm.R[0], k); A.rotation.z = lerp(A.rotation.z, r.restArm.R[2], k); W.rotation.x = lerp(W.rotation.x, r.weaponRest, k); B.position.z = lerp(B.position.z, 0, k); B.rotation.x = lerp(B.rotation.x, 0, k); }).then(function () { Ch.rest(r); r.state = 'idle'; }); };
    if (r.attack === 'thrust') {
      return tween(0.28, function (k) { var e = ease(k); A.rotation.x = lerp(a0, -0.7, e); W.rotation.x = lerp(w0, 2.27, e); B.position.z = lerp(bz, -0.04, e); })
        .then(function () { sfx('thrust'); return tween(0.11, function (k) { A.rotation.x = lerp(-0.7, -1.45, k); W.rotation.x = lerp(2.27, 3.02, k); B.position.z = lerp(-0.04, 0.1, k); }); })
        .then(function () { onImpact(); return wait(0.15); }).then(done);
    }
    if (r.attack === 'slash') {
      return tween(0.32, function (k) { var e = ease(k); A.rotation.x = lerp(a0, -2.5, e); A.rotation.z = lerp(z0, 0.9, e); W.rotation.x = lerp(w0, 0.3, e); B.rotation.y = 0; })
        .then(function () { sfx('swing'); return tween(0.13, function (k) { A.rotation.x = lerp(-2.5, -0.9, k); A.rotation.z = lerp(0.9, -0.6, k); B.position.z = lerp(0, 0.06, k); }); })
        .then(function () { onImpact(); return wait(0.18); }).then(done);
    }
    if (r.attack === 'smash') {
      return tween(0.42, function (k) { var e = ease(k); A.rotation.x = lerp(a0, -2.95, e); W.rotation.x = lerp(w0, 0.1, e); B.rotation.x = lerp(0, -0.12, e); })
        .then(function () { sfx('swing'); return tween(0.12, function (k) { A.rotation.x = lerp(-2.95, -0.75, easeIn(k)); B.rotation.x = lerp(-0.12, 0.18, k); }); })
        .then(function () { onImpact(); shake = 0.25; dust(aim.clone().setY(0), 12); return wait(0.25); }).then(done);
    }
    if (r.attack === 'rear') {
      var hb = r.horseBody, HL = r.hLegs, HK = r.hKnees, hy = r.horseBaseY;
      sfx('neigh');
      r.speed = 1;
      var rearUp = function (k) {
        hb.rotation.x = -0.7 * k; hb.position.y = hy + 0.02 * k;
        HL[0].rotation.x = -1.1 * k + Math.sin(k * 14) * 0.25 * k; HL[1].rotation.x = -0.8 * k - Math.sin(k * 14) * 0.25 * k;
        HK[0].rotation.x = 1.5 * k; HK[1].rotation.x = 1.3 * k;
        HL[2].rotation.x = 0.35 * k; HL[3].rotation.x = 0.35 * k; HK[2].rotation.x = -0.3 * k; HK[3].rotation.x = -0.3 * k;
      };
      return tween(0.45, function (k) { rearUp(ease(k)); A.rotation.x = lerp(a0, -2.7, ease(k)); A.rotation.z = lerp(z0, 0.6, ease(k)); W.rotation.x = lerp(w0, 0.2, ease(k)); })
        .then(function () { sfx('swing'); return tween(0.16, function (k) { rearUp(1 - k * 0.6); A.rotation.x = lerp(-2.7, -0.7, k); A.rotation.z = lerp(0.6, -0.5, k); r.rider.position.z = lerp(-0.03, 0.06, k); }); })
        .then(function () { onImpact(); dust(r.root.position.clone(), 6); return tween(0.3, function (k) { rearUp(0.4 * (1 - k)); r.rider.position.z = lerp(0.06, -0.03, k); }); })
        .then(function () { sfx('hoof'); return done(); });
    }
    var tip = new T3.Vector3();
    if (r.attack === 'beam') {
      return tween(0.4, function (k) { var e = ease(k); A.rotation.x = lerp(a0, -2.3, e); W.rotation.x = lerp(w0, 0.9, e); r.orb.scale.setScalar(1 + e * 1.2); })
        .then(function () {
          sfx('magic');
          r.orb.getWorldPosition(tip);
          flash(tip, Ch.TEAM[r.color].gem, 2.5);
          return projectile(tip, aim, Ch.TEAM[r.color].gem, 0.42, 0);
        })
        .then(function () { sfx('boom'); flash(aim, Ch.TEAM[r.color].gem, 4); sparks(aim, Ch.TEAM[r.color].gem, 22, 2.6); onImpact(); return wait(0.2); }).then(done);
    }
    if (r.attack === 'magic') {
      var L = r.armL, l0 = L.rotation.x, col = Ch.TEAM[r.color].gem;
      return tween(0.42, function (k) { var e = ease(k); A.rotation.x = lerp(a0, -1.7, e); L.rotation.x = lerp(l0, -1.7, e); A.rotation.z = lerp(z0, -0.25, e); L.rotation.z = lerp(L.rotation.z, 0.25, e); r.orb.scale.setScalar(1 + e); })
        .then(function () {
          sfx('magic');
          r.orb.getWorldPosition(tip);
          var hit = false;
          return Promise.all([-1, 0, 1].map(function (cv, i) {
            return wait(i * 0.09).then(function () { return projectile(tip, aim, col, 0.45, cv * 1.4); }).then(function () {
              sparks(aim, col, 10, 2);
              if (!hit) { hit = true; sfx('boom'); flash(aim, col, 4); onImpact(); }
            });
          }));
        })
        .then(function () { return wait(0.2); })
        .then(function () { return tween(0.3, function (k) { L.rotation.x = lerp(L.rotation.x, r.restArm.L[0], k); L.rotation.z = lerp(L.rotation.z, r.restArm.L[2], k); }); })
        .then(done);
    }
    onImpact();
    return Promise.resolve();
  }

  // Trúng đòn rồi ngã xuống, chìm vào đất
  function die(vic, fromPos, keep) {
    vic.state = 'dead';
    var chest = vic.root.position.clone().setY(0.55);
    sfx('clash');
    sparks(chest, 0xffd27a, 18, 2.4);
    var away = faceAngle(fromPos, vic.root.position), r = vic.root;
    var rot0 = r.rotation.y;
    return tween(0.15, function (k) { r.rotation.y = rot0 + angDiff(away + Math.PI, rot0) * k; vic.body.rotation.x = -0.35 * k; })
      .then(function () {
        // ngã ngửa ra sau (Hiệp sĩ đổ nghiêng cả ngựa)
        var pivot = new T3.Group();
        pivot.userData.pivot = true;
        pivot.position.copy(r.position);
        pivot.rotation.y = r.rotation.y;
        scene.add(pivot);
        scene.remove(r);
        r.position.set(0, 0, 0);
        r.rotation.set(0, 0, 0);
        pivot.add(r);
        vic.pivot = pivot;
        Ch.rest(vic);
        vic.armL.rotation.x = -2.2; vic.armR.rotation.x = -2.0;
        return tween(0.55, function (k) {
          var e = easeIn(k);
          if (vic.kind === 'N') pivot.rotation.z = 1.45 * e; else pivot.rotation.x = -1.45 * e;
        });
      })
      .then(function () {
        sfx('fall');
        dust(vic.pivot.position, 10);
        if (keep) return null;
        return wait(0.35).then(function () {
          var p = vic.pivot, y0 = p.position.y;
          return tween(0.8, function (k) { p.position.y = y0 - 0.7 * k; p.scale.setScalar(1 - 0.4 * k); });
        }).then(function () { scene.remove(vic.pivot); });
      });
  }

  // Toàn bộ trận đánh khi ăn quân: tiếp cận, ra đòn, đối phương ngã, rồi chiếm ô
  function battle(att, vic, dest) {
    var ranged = att.kind === 'B' || att.kind === 'Q';
    var vp = vic.root.position.clone(), ap = att.root.position.clone();
    var dir = vp.clone().sub(ap).setY(0), dist = dir.length();
    dir.normalize();
    camFocus(ap.clone().lerp(vp, 0.5), Math.atan2(dir.x, dir.z));
    var approach = Promise.resolve();
    if (!ranged && dist > 0.75) {
      var stop = vp.clone().sub(dir.clone().multiplyScalar(att.kind === 'N' ? 0.85 : 0.62));
      approach = walkTo(att, stop, { jump: att.kind === 'N' && !isLine(ap, vp) });
    }
    var victimTurn = approach.then(function () { return turnTo(vic, faceAngle(vp, att.root.position), 0.2); });
    return Promise.all([approach.then(function () { return turnTo(att, faceAngle(att.root.position, vp), 0.15); }), victimTurn])
      .then(function () {
        var dying;
        return strike(att, vic, function () { dying = die(vic, att.root.position); }).then(function () { return dying; });
      })
      .then(function () { return walkTo(att, dest); })
      .then(function () { return turnTo(att, forwardAngle(att.color), 0.25); });
  }
  function isLine(a, b) { var dx = Math.abs(a.x - b.x), dz = Math.abs(a.z - b.z); return dx < 0.01 || dz < 0.01 || Math.abs(dx - dz) < 0.01; }

  // ---------- hiển thị chọn quân / nước đi ----------
  var markers = group(scene, 0, 0, 0);
  var selRing = mesh(new T3.TorusGeometry(0.4, 0.035, 8, 32), new T3.MeshBasicMaterial({ color: 0xffd34d }), scene, 0, 0.02, 0);
  selRing.rotation.x = -Math.PI / 2;
  selRing.visible = false;
  var checkRing = mesh(new T3.TorusGeometry(0.44, 0.05, 8, 32), new T3.MeshBasicMaterial({ color: 0xff3020 }), scene, 0, 0.025, 0);
  checkRing.rotation.x = -Math.PI / 2;
  checkRing.visible = false;
  var lastMarks = [0, 1].map(function () {
    var p = mesh(new T3.PlaneGeometry(0.98, 0.98), new T3.MeshBasicMaterial({ color: 0xffe066, transparent: true, opacity: 0.32, depthWrite: false }), scene, 0, 0.003, 0);
    p.rotation.x = -Math.PI / 2; p.visible = false; p.castShadow = false;
    return p;
  });
  var dotMat = new T3.MeshBasicMaterial({ color: 0x5fe07a, transparent: true, opacity: 0.85 });
  var capMat = new T3.MeshBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.9 });
  function showTargets() {
    while (markers.children.length) markers.remove(markers.children[0]);
    S.targets.forEach(function (m) {
      var to = C.mTo(m), p = sqPos(to), cap = S.game.b[to] || C.mFlag(m) === 1;
      var mk = cap ? new T3.Mesh(new T3.TorusGeometry(0.4, 0.04, 6, 28), capMat) : new T3.Mesh(new T3.CylinderGeometry(0.13, 0.13, 0.02, 16), dotMat);
      if (cap) mk.rotation.x = -Math.PI / 2;
      mk.position.set(p.x, 0.02, p.z);
      mk.userData.sq = to;
      markers.add(mk);
    });
    if (S.sel >= 0) { var sp = sqPos(S.sel); selRing.position.set(sp.x, 0.02, sp.z); selRing.visible = true; } else selRing.visible = false;
  }
  function showLast(inf) {
    lastMarks.forEach(function (p, i) {
      if (!inf) { p.visible = false; return; }
      var q = sqPos(i ? inf.to : inf.from);
      p.position.set(q.x, 0.003, q.z); p.visible = true;
    });
  }
  function showCheck() {
    var g = S.game;
    if (g.inCheck() && !S.over) { var p = sqPos(g.king[g.turn]); checkRing.position.set(p.x, 0.025, p.z); checkRing.visible = true; }
    else checkRing.visible = false;
  }

  // ---------- điều khiển chuột / chạm ----------
  var ray = new T3.Raycaster(), ptr = new T3.Vector2(), pointers = {}, drag = null, pinch = null;
  var el = renderer.domElement;
  el.addEventListener('pointerdown', function (e) {
    pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    var ids = Object.keys(pointers);
    if (ids.length === 2) { var a = pointers[ids[0]], b = pointers[ids[1]]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), r: userCam.radius }; drag = null; return; }
    drag = { x: e.clientX, y: e.clientY, moved: false, th: userCam.theta, ph: userCam.phi };
    try { el.setPointerCapture(e.pointerId); } catch (err) { /* bỏ qua */ }
  });
  el.addEventListener('pointermove', function (e) {
    if (pointers[e.pointerId]) pointers[e.pointerId] = { x: e.clientX, y: e.clientY };
    if (pinch) {
      var ids = Object.keys(pointers);
      if (ids.length === 2) {
        var a = pointers[ids[0]], b = pointers[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y);
        userCam.radius = Math.max(6, Math.min(20, pinch.r * pinch.d / d));
        camHome();
      }
      return;
    }
    if (!drag) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 7) drag.moved = true;
    if (drag.moved) {
      userCam.theta = drag.th - dx * 0.006;
      userCam.phi = Math.max(0.3, Math.min(1.38, drag.ph - dy * 0.005));
      camHome();
    }
  });
  function up(e) {
    delete pointers[e.pointerId];
    if (pinch) { if (Object.keys(pointers).length < 2) pinch = null; return; }
    if (drag && !drag.moved) onClick(e.clientX, e.clientY);
    drag = null;
  }
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', function (e) { delete pointers[e.pointerId]; drag = null; pinch = null; });
  el.addEventListener('wheel', function (e) {
    e.preventDefault();
    userCam.radius = Math.max(6, Math.min(20, userCam.radius * (e.deltaY > 0 ? 1.08 : 0.93)));
    camHome();
  }, { passive: false });

  function pickSquare(x, y) {
    var r = el.getBoundingClientRect();
    ptr.set((x - r.left) / r.width * 2 - 1, -(y - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ptr, camera);
    var objs = markers.children.slice();
    Object.keys(S.actors).forEach(function (k) { objs.push(S.actors[k].root); });
    var hits = ray.intersectObjects(objs, true);
    for (var i = 0; i < hits.length; i++) {
      var o = hits[i].object;
      if (o.userData.sq !== undefined) return o.userData.sq;
      if (o.userData.rig && o.userData.rig.state !== 'dead') return o.userData.rig.sq;
    }
    hits = ray.intersectObjects(squares, false);
    return hits.length ? hits[0].object.userData.sq : -1;
  }

  function canInteract() { return !S.busy && !S.over && (S.opp === 'human' || S.game.turn === S.human); }
  function onClick(x, y) {
    try { window.Music.ctx(); } catch (e) { /* mở khóa âm thanh */ }
    if (!canInteract()) return;
    var sq = pickSquare(x, y);
    if (sq < 0) { select(-1); return; }
    var opts = S.targets.filter(function (m) { return C.mTo(m) === sq; });
    if (S.sel >= 0 && opts.length) {
      if (opts.length > 1) { askPromo(S.game.turn, function (ty) { play(opts.filter(function (m) { return C.mPromo(m) === ty; })[0]); }); return; }
      play(opts[0]);
      return;
    }
    var p = S.game.b[sq];
    if (p && (p >> 3) === S.game.turn && sq !== S.sel) { select(sq); sfx('select'); } else select(-1);
  }
  function select(sq) {
    S.sel = sq;
    S.targets = sq < 0 ? [] : S.game.legal().filter(function (m) { return C.mFrom(m) === sq; });
    showTargets();
  }
  function askPromo(color, cb) {
    var box = $('promo');
    box.innerHTML = '<div class="promo-title">Phong cấp thành:</div>' + [C.Q, C.R, C.B, C.N].map(function (ty) {
      return '<button class="btn" data-ty="' + ty + '"><span class="gl ' + (color ? 'b' : 'w') + '">' + GLYPH[ty] + '</span>' + NAME[KIND[ty]] + '</button>';
    }).join('');
    box.hidden = false;
    box.onclick = function (e) {
      var bt = e.target.closest('[data-ty]');
      if (!bt) return;
      box.hidden = true;
      cb(+bt.dataset.ty);
    };
  }

  // ---------- diễn biến ván cờ ----------
  function play(m) {
    var g = S.game, inf = g.info(m), id = S.gameId;
    g.make(m);
    var key = g.key();
    S.keys[key] = (S.keys[key] || 0) + 1;
    S.hist.push({ info: inf, fen: g.fen() });
    select(-1);
    S.busy = true;
    showLast(null);
    checkRing.visible = false;
    renderHUD();
    return animateMove(inf).then(function () {
      if (id !== S.gameId) return;
      S.busy = false;
      showLast(inf);
      checkOver();
      showCheck();
      if (S.over) return endGame();
      if (g.inCheck()) {
        sfx('check');
        var kr = S.actors[g.king[g.turn]];
        if (kr) flash(kr.root.position.clone().setY(0.8), 0xff3020, 2.5);
      }
      renderHUD();
      requestAI();
    });
  }

  function animateMove(inf) {
    var A = S.actors, att = A[inf.from], to = sqPos(inf.to);
    if (!att) { syncActors(); return Promise.resolve(); }
    delete A[inf.from];
    var p;
    if (inf.flag === 2) {
      // nhập thành: Vua và Xe cùng di chuyển
      var right = (inf.to & 7) === 6, rf = inf.from + (right ? 3 : -4), rt = inf.from + (right ? 1 : -1), rook = A[rf];
      delete A[rf];
      p = Promise.all([
        walkTo(att, to).then(function () { return turnTo(att, forwardAngle(att.color)); }),
        rook ? wait(0.25).then(function () { return walkTo(rook, sqPos(rt)); }).then(function () { return turnTo(rook, forwardAngle(rook.color)); }) : null
      ]).then(function () { if (rook) { rook.sq = rt; A[rt] = rook; } });
    } else if (inf.captured) {
      var vsq = inf.flag === 1 ? inf.to + (inf.color === 0 ? 8 : -8) : inf.to, vic = A[vsq];
      delete A[vsq];
      p = vic ? battle(att, vic, to) : walkTo(att, to);
    } else {
      var straight = att.kind !== 'N';
      p = walkTo(att, to, { jump: !straight }).then(function () { return turnTo(att, forwardAngle(att.color)); });
    }
    return p.then(function () {
      att.sq = inf.to;
      A[inf.to] = att;
      camHome();
      if (inf.promo) return promote(att, inf.promo | inf.color << 3);
    });
  }

  function promote(old, code) {
    var pos = old.root.position.clone();
    sfx('promote');
    flash(pos.clone().setY(0.6), 0xffe9a0, 5);
    sparks(pos.clone().setY(0.4), 0xffe08a, 30, 2);
    return tween(0.35, function (k) { old.root.scale.setScalar(1 - k); old.root.rotation.y += 0.3; }).then(function () {
      scene.remove(old.root);
      var nw = spawn(code, old.sq);
      S.actors[old.sq] = nw;
      var s = nw.root.scale.x;
      return tween(0.45, function (k) { nw.root.scale.setScalar(s * easeOut(k)); });
    });
  }

  function checkOver() {
    var g = S.game;
    if (!g.legal().length) S.over = g.inCheck() ? { text: 'Chiếu hết — ' + side(g.turn ^ 1) + ' thắng!', winner: g.turn ^ 1 } : { text: 'Hòa — hết nước đi (pat)' };
    else if (g.insufficient()) S.over = { text: 'Hòa — không đủ quân để chiếu hết' };
    else if (S.keys[g.key()] >= 3) S.over = { text: 'Hòa — lặp lại thế cờ 3 lần' };
    else if (g.half >= 100) S.over = { text: 'Hòa — luật 50 nước' };
  }
  function side(c) { return c ? 'Đen' : 'Trắng'; }

  // Kết thúc: Vua thua ngã xuống, quân bên thắng giơ vũ khí ăn mừng
  function endGame() {
    renderHUD();
    var o = S.over, id = S.gameId;
    showBanner(o.text);
    if (o.winner === undefined) return;
    var g = S.game, ks = g.king[o.winner ^ 1], king = S.actors[ks];
    var attacker = null;
    Object.keys(S.actors).forEach(function (k) { var a = S.actors[k]; if (a.color === o.winner && (!attacker || a.root.position.distanceTo(king.root.position) < attacker.root.position.distanceTo(king.root.position))) attacker = a; });
    camFocus(king.root.position, 0);
    return die(king, attacker ? attacker.root.position : new T3.Vector3(0, 0, 0), true).then(function () {
      if (id !== S.gameId) return;
      sfx('fanfare');
      camHome();
      Object.keys(S.actors).forEach(function (k) {
        var a = S.actors[k];
        if (a.color !== o.winner || a.state === 'dead') return;
        a.state = 'cheer';
        var d = Math.random() * 0.4;
        wait(d).then(function () {
          return tween(1.6, function (t) {
            var j = Math.abs(Math.sin(t * Math.PI * 3));
            a.root.position.y = j * 0.18;
            a.armR.rotation.x = -2.6; a.armL.rotation.x = -2.2 - j * 0.3;
          });
        }).then(function () { a.root.position.y = 0; Ch.rest(a); a.state = 'idle'; });
      });
    });
  }
  var bannerTimer = null;
  function showBanner(text) {
    var b = $('banner');
    b.textContent = text;
    b.hidden = false;
    b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () { b.hidden = true; }, 5200);
  }

  // ---------- máy chơi theo Elo ----------
  var engine = new Engine(), engineReady = engine.init().then(renderHUD);
  function eloParams(elo) {
    if (elo >= 3200) return { depth: 18, multipv: 1, temp: 0, blunder: 0, movetime: 1000 };
    return {
      depth: Math.max(1, Math.min(14, Math.round(1 + (elo - 250) / 220))),
      multipv: elo >= 2400 ? 3 : elo >= 1600 ? 5 : 8,
      temp: 300 * Math.exp(-(elo - 250) / 600),
      blunder: elo >= 2000 ? 0 : 0.3 * Math.exp(-(elo - 250) / 450),
      movetime: 1500
    };
  }
  function pickMove(r, p, turn, elo) {
    var lines = r.lines.filter(Boolean);
    if (p.multipv === 1 || lines.length < 2) return r.best;
    var sign = turn === 0 ? 1 : -1, best = -Infinity, i;
    var sc = lines.map(function (l) { return (l.mate !== null ? (l.mate > 0 ? 1 : -1) * (10000 - Math.abs(l.mate) * 100) : l.cp) * sign; });
    for (i = 0; i < sc.length; i++) {
      if (elo >= 600 && lines[i].mate === sign) return lines[i].move;
      if (sc[i] > best) best = sc[i];
    }
    if (Math.random() < p.blunder) return lines[Math.floor(Math.random() * lines.length)].move;
    var w = sc.map(function (s) { return Math.exp(-(best - s) / Math.max(1, p.temp)); });
    var x = Math.random() * w.reduce(function (a, v) { return a + v; }, 0);
    for (i = 0; i < w.length; i++) { x -= w[i]; if (x <= 0) return lines[i].move; }
    return lines[0].move;
  }
  function requestAI() {
    if (S.over || S.opp !== 'ai' || S.game.turn === S.human) return;
    var id = S.gameId, fen = S.game.fen(), turn = S.game.turn, p = eloParams(S.elo), t0 = performance.now();
    S.thinking = true;
    renderHUD();
    engineReady.then(function () { return id === S.gameId ? engine.analyze(fen, { depth: p.depth, multipv: p.multipv, movetime: p.movetime }) : null; })
      .then(function (r) {
        if (!r || id !== S.gameId) return;
        var mv = pickMove(r, p, turn, S.elo);
        setTimeout(function () {
          if (id !== S.gameId) return;
          S.thinking = false;
          var m = S.game.fromUci(mv) || S.game.fromUci(r.best) || S.game.legal()[0];
          if (m) play(m);
        }, Math.max(0, 500 - (performance.now() - t0)));
      });
  }

  // ---------- ván mới / đi lại / đầu hàng ----------
  function newGame() {
    engine.cancel();
    S.gameId++;
    S.opp = prefs.opp; S.elo = +prefs.elo;
    S.human = S.opp === 'ai' ? (prefs.side === 'r' ? (Math.random() < 0.5 ? 0 : 1) : +prefs.side) : 0;
    S.game = new Game(); S.hist = []; S.keys = {}; S.over = null; S.busy = false; S.thinking = false;
    S.keys[S.game.key()] = 1;
    tweens.forEach(function (t) { t.res(); });
    tweens.length = 0;
    fx.forEach(function (f) { scene.remove(f.obj); });
    fx.length = 0;
    clearScenePivots();
    syncActors();
    select(-1);
    showLast(null);
    showCheck();
    $('banner').hidden = true;
    userCam.theta = sideTheta(S.human); userCam.phi = 0.92; userCam.radius = 12.5;
    camHome();
    renderHUD();
    requestAI();
  }
  function clearScenePivots() {
    scene.children.slice().forEach(function (o) { if (o.userData.pivot) scene.remove(o); });
  }
  function undo() {
    if (S.busy || !S.hist.length) return;
    engine.cancel();
    S.gameId++;
    var n = S.opp === 'ai' && S.game.turn === S.human ? 2 : 1;
    if (S.opp === 'ai' && S.over && S.game.turn !== S.human) n = 1;
    n = Math.min(n, S.hist.length);
    while (n--) { S.keys[S.game.key()]--; S.game.unmake(); S.hist.pop(); }
    S.over = null; S.thinking = false;
    tweens.forEach(function (t) { t.res(); });
    tweens.length = 0;
    clearScenePivots();
    syncActors();
    select(-1);
    showLast(S.hist.length ? S.hist[S.hist.length - 1].info : null);
    showCheck();
    $('banner').hidden = true;
    camHome();
    renderHUD();
    requestAI();
  }
  function resign() {
    if (S.over || S.busy) return;
    engine.cancel();
    S.gameId++;
    var loser = S.opp === 'ai' ? S.human : S.game.turn;
    S.over = { text: side(loser) + ' đầu hàng — ' + side(loser ^ 1) + ' thắng!' };
    S.thinking = false;
    select(-1);
    showBanner(S.over.text);
    renderHUD();
  }

  // ---------- bảng thông tin ----------
  function renderHUD() {
    var g = S.game, st = $('status');
    if (S.over) st.textContent = S.over.text;
    else if (S.busy) st.textContent = '⚔ ' + side(g.turn ^ 1) + ' đang hành quân…';
    else if (S.thinking) st.textContent = 'Máy đang tính nước…';
    else st.textContent = 'Lượt của ' + side(g.turn) + (g.inCheck() ? ' — Vua bị chiếu!' : '');
    $('engineTag').textContent = !engine.kind ? 'Đang tải engine…' : engine.kind === 'stockfish' ? 'Stockfish 10' : 'Engine dự phòng';
    var html = '';
    S.hist.forEach(function (h, i) {
      if (i % 2 === 0) html += '<span class="num">' + (i / 2 + 1) + '.</span>';
      html += '<span class="mv">' + h.info.san + '</span>';
    });
    var mv = $('moves');
    mv.innerHTML = html || '<span class="empty">Bấm vào một nhân vật rồi chọn ô sáng để ra quân.</span>';
    mv.scrollTop = mv.scrollHeight;
    // quân đã bị hạ của mỗi bên
    var cnt = [[0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0]], init = [0, 8, 2, 2, 2, 1, 1];
    for (var s2 = 0; s2 < 64; s2++) { var p = g.b[s2]; if (p) cnt[p >> 3][p & 7]++; }
    [0, 1].forEach(function (c) {
      var out = '';
      for (var ty = 5; ty >= 1; ty--) for (var j = cnt[c ^ 1][ty]; j < init[ty]; j++) out += '<span class="gl ' + (c ? 'w' : 'b') + '">' + GLYPH[ty] + '</span>';
      $('cap' + c).innerHTML = out || '<i>—</i>';
    });
    $('who0').textContent = S.opp === 'ai' ? (S.human === 0 ? 'Bạn (Trắng)' : 'Máy (Trắng, Elo ' + S.elo + ')') : 'Trắng';
    $('who1').textContent = S.opp === 'ai' ? (S.human === 1 ? 'Bạn (Đen)' : 'Máy (Đen, Elo ' + S.elo + ')') : 'Đen';
    $('btnUndo').disabled = S.busy || !S.hist.length;
    $('btnResign').disabled = !!S.over || S.busy;
    $('btnCam').classList.toggle('on', !!prefs.cam);
    $('btnSpeed').textContent = '⏩ ' + prefs.speed + 'x';
  }

  // ---------- nút bấm ----------
  $('btnNew').onclick = function () { syncDialog(); $('dlgNew').showModal(); };
  $('btnUndo').onclick = undo;
  $('btnResign').onclick = resign;
  $('btnView').onclick = function () { userCam.theta += Math.PI; camHome(); };
  $('btnCam').onclick = function () { prefs.cam = !prefs.cam; savePrefs(); renderHUD(); };
  $('btnSpeed').onclick = function () { prefs.speed = prefs.speed >= 3 ? 1 : prefs.speed + 1; savePrefs(); renderHUD(); };
  $('btnSound').onclick = function () { S.sound = !S.sound; this.textContent = S.sound ? '🔊' : '🔇'; };
  $('btnMusic').onclick = function () {
    var M = window.Music, on = !M.state().on;
    if (on) M.setTrack(4);
    M.setOn(on);
    this.classList.toggle('on', on);
  };
  $('btnMusic').classList.toggle('on', window.Music.state().on);
  $('btnPanel').onclick = function () { document.body.classList.toggle('panel-min'); setTimeout(resize, 260); };

  var dlg = $('dlgNew'), elo = $('eloRange');
  function tier(e) { return e >= 3200 ? 'Tối đa' : e >= 2500 ? 'Kiện tướng' : e >= 2000 ? 'Chuyên gia' : e >= 1500 ? 'Nâng cao' : e >= 1000 ? 'Trung cấp' : 'Mới chơi'; }
  function syncDialog() {
    [].forEach.call(dlg.querySelectorAll('.seg'), function (seg) {
      [].forEach.call(seg.children, function (x) { x.classList.toggle('on', x.dataset.v === String(prefs[seg.dataset.name])); });
    });
    elo.value = prefs.elo;
    $('eloValue').textContent = prefs.elo + ' — ' + tier(+prefs.elo);
    $('fieldSide').hidden = $('fieldElo').hidden = prefs.opp !== 'ai';
  }
  dlg.addEventListener('click', function (e) {
    var bt = e.target.closest('.seg button');
    if (!bt) return;
    prefs[bt.parentNode.dataset.name] = bt.dataset.v;
    syncDialog();
  });
  elo.addEventListener('input', function () { prefs.elo = +elo.value; syncDialog(); });
  dlg.addEventListener('close', function () { if (dlg.returnValue === 'ok') { savePrefs(); newGame(); } });

  // ---------- vòng lặp khung hình ----------
  var clock = new T3.Clock(), elapsed = 0;
  function frame() {
    requestAnimationFrame(frame);
    var raw = Math.min(clock.getDelta(), 0.05), dt = raw * prefs.speed;
    elapsed += raw;
    for (var i = tweens.length - 1; i >= 0; i--) {
      var tw = tweens[i];
      tw.t += dt;
      var k = Math.min(1, tw.t / tw.dur);
      tw.fn(k);
      if (k >= 1) { tweens.splice(i, 1); tw.res(); }
    }
    Object.keys(S.actors).forEach(function (q) { var a = S.actors[q]; if (a.state === 'idle') Ch.idle(a, elapsed); else if (a.state !== 'walk') Ch.cloth(a, elapsed); });
    flames.forEach(function (f) {
      var fl = 0.85 + Math.sin(elapsed * 13 + f.ph) * 0.08 + Math.sin(elapsed * 23 + f.ph * 2) * 0.06;
      f.fire.scale.set(1, fl * 1.1, 1);
      f.light.intensity = 1.6 * fl;
      f.flag.rotation.y = Math.sin(elapsed * 2 + f.ph) * 0.35;
    });
    selRing.rotation.z += raw * 1.5;
    selRing.scale.setScalar(1 + Math.sin(elapsed * 5) * 0.04);
    checkRing.material.color.setHSL(0.01, 1, 0.45 + Math.sin(elapsed * 8) * 0.12);
    markers.children.forEach(function (m) { m.position.y = 0.02 + Math.sin(elapsed * 4) * 0.008; });
    updateFx(dt);
    updateCamera(raw);
    renderer.render(scene, camera);
  }

  resize();
  syncDialog();
  newGame();
  cam.theta = camGoal.theta; cam.phi = camGoal.phi + 0.25; cam.radius = camGoal.radius + 6;
  frame();
  // nạp thế cờ bất kỳ (dùng khi kiểm thử từ console)
  function load(fen) {
    newGame();
    S.opp = 'human';
    S.game = new Game(fen); S.hist = []; S.keys = {};
    syncActors(); select(-1); renderHUD();
  }
  window.__rf = { S: S, play: play, load: load, scene: scene, camGoal: camGoal, prefs: prefs };
})();
