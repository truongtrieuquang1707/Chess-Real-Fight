// Dựng nhân vật chiến binh trung cổ bằng three.js: giáp tấm phản chiếu, mũ kín với mắt phát sáng, áo choàng vải mềm,
// chiến mã bọc giáp. Đội Trắng: hiệp sĩ thánh (bạc, vàng, cánh, mào lông). Đội Đen: quân đoàn bóng tối (thép đen, gai,
// sừng, mắt đỏ, áo choàng rách). Khung xương: thân, đầu, vai → khuỷu → bàn tay, hông → gối; vũ khí ở tay phải. Mặt nhìn +z.
(function () {
  'use strict';
  var T3 = window.THREE;

  var TEAM = [
    { steel: 0xc9cfd6, steel2: 0x9aa3ad, cloth: 0x2c56a3, cloth2: 0x1b3366, trim: 0xd8b04a, skin: 0xe4b892, hair: 0x6e4a2c,
      horse: 0xeeebe4, mane: 0xf7f5f0, gem: 0x6fd0ff, crest: '#2c56a3', crestFg: '#f2d27a', eye: 0x8fe4ff, spikes: false, tattered: false },
    { steel: 0x34373d, steel2: 0x1c1e22, cloth: 0x7d1414, cloth2: 0x3d0a0a, trim: 0xa8812c, skin: 0xcf9878, hair: 0x241912,
      horse: 0x1f1a17, mane: 0x0d0a08, gem: 0xff4a26, crest: '#6e1212', crestFg: '#d8b04a', eye: 0xff2a10, spikes: true, tattered: true }
  ];

  // ---------- vật liệu (màu nhập theo sRGB, chuyển sang tuyến tính) ----------
  var mcache = {};
  function mat(color, o) {
    o = o || {};
    var key = [color, o.metal || 0, o.rough === undefined ? 0.7 : o.rough, o.emissive || 0, o.map ? o.map.uuid : '', o.flat ? 1 : 0, o.side || 0].join('|');
    if (!mcache[key]) {
      var m = new T3.MeshStandardMaterial({
        color: new T3.Color(color).convertSRGBToLinear(), metalness: o.metal || 0, roughness: o.rough === undefined ? 0.7 : o.rough,
        flatShading: !!o.flat, map: o.map || null, side: o.side || T3.FrontSide
      });
      if (o.emissive) { m.emissive = new T3.Color(o.emissive).convertSRGBToLinear(); m.emissiveIntensity = 1.4; }
      m.envMapIntensity = o.metal ? 1.15 : 0.45;
      mcache[key] = m;
    }
    return mcache[key];
  }
  function steel(t, dark) { return mat(dark ? t.steel2 : t.steel, { metal: 0.92, rough: 0.26 }); }
  function gold(t) { return mat(t.trim, { metal: 0.95, rough: 0.28 }); }

  var gcache = {};
  function geo(key, make) { return gcache[key] || (gcache[key] = make()); }
  var G = {
    box: function (w, h, d) { return geo('b' + [w, h, d], function () { return new T3.BoxGeometry(w, h, d); }); },
    cyl: function (rt, rb, h, s) { return geo('c' + [rt, rb, h, s], function () { return new T3.CylinderGeometry(rt, rb, h, s || 14); }); },
    sph: function (r, s) { return geo('s' + [r, s], function () { return new T3.SphereGeometry(r, s || 16, s ? Math.max(8, s - 4) : 12); }); },
    hemi: function (r) { return geo('h' + r, function () { return new T3.SphereGeometry(r, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); }); },
    cone: function (r, h, s) { return geo('o' + [r, h, s], function () { return new T3.ConeGeometry(r, h, s || 14); }); },
    torus: function (r, t, s) { return geo('t' + [r, t, s], function () { return new T3.TorusGeometry(r, t, 8, s || 24); }); },
    lathe: function (key, pts, s) {
      return geo('l' + key, function () { return new T3.LatheGeometry(pts.map(function (p) { return new T3.Vector2(p[0], p[1]); }), s || 20); });
    }
  };
  // shadow = false cho chi tiết nhỏ để giảm tải
  function mesh(g, m, parent, x, y, z, shadow) {
    var me = new T3.Mesh(g, m);
    me.position.set(x || 0, y || 0, z || 0);
    me.castShadow = shadow !== false;
    me.receiveShadow = true;
    if (parent) parent.add(me);
    return me;
  }
  function group(parent, x, y, z) {
    var g = new T3.Group();
    g.position.set(x || 0, y || 0, z || 0);
    if (parent) parent.add(g);
    return g;
  }

  // ---------- huy hiệu vẽ bằng canvas ----------
  var crestCache = {};
  function crestTex(c, kind) {
    var k = c + kind;
    if (kind === 'emblem') k = c + (c ? 'skull' : 'fleur');
    if (crestCache[k]) return crestCache[k];
    var t = TEAM[c], cv = document.createElement('canvas');
    cv.width = cv.height = 128;
    var x = cv.getContext('2d');
    x.fillStyle = t.crest; x.fillRect(0, 0, 128, 128);
    if (kind === 'ermine') {
      x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, 128, 128);
      x.fillStyle = '#151515';
      for (var i = 0; i < 16; i++) { var px = (i % 4) * 32 + (Math.floor(i / 4) % 2) * 16 + 8, py = Math.floor(i / 4) * 32 + 10; x.beginPath(); x.moveTo(px, py); x.lineTo(px - 4, py + 12); x.lineTo(px + 4, py + 12); x.fill(); }
    } else {
      x.strokeStyle = t.crestFg; x.lineWidth = 6; x.strokeRect(6, 6, 116, 116);
      x.fillStyle = t.crestFg;
      if (kind === 'emblem') kind = c ? 'skull' : 'fleur';
      if (kind === 'skull') {
        x.beginPath(); x.arc(64, 54, 30, 0, Math.PI * 2); x.fill();
        x.fillRect(46, 74, 36, 22);
        x.fillStyle = t.crest;
        x.beginPath(); x.arc(52, 54, 9, 0, Math.PI * 2); x.arc(76, 54, 9, 0, Math.PI * 2); x.fill();
        x.beginPath(); x.moveTo(64, 64); x.lineTo(58, 74); x.lineTo(70, 74); x.fill();
        for (var tt = 0; tt < 4; tt++) x.fillRect(50 + tt * 8, 84, 3, 12);
        x.fillStyle = t.crestFg;
        x.save(); x.translate(64, 64); x.rotate(0.78); x.fillRect(-54, -5, 108, 10); x.rotate(-1.56); x.fillRect(-54, -5, 108, 10); x.restore();
        x.beginPath(); x.arc(64, 54, 30, 0, Math.PI * 2); x.fill();
        x.fillStyle = t.crest;
        x.beginPath(); x.arc(52, 54, 9, 0, Math.PI * 2); x.arc(76, 54, 9, 0, Math.PI * 2); x.fill();
        x.beginPath(); x.moveTo(64, 64); x.lineTo(58, 74); x.lineTo(70, 74); x.fill();
      } else if (kind === 'cross') {
        x.fillRect(54, 18, 20, 92); x.fillRect(26, 44, 76, 18);
      } else {
        // hoa huệ (fleur-de-lis) đơn giản
        x.beginPath();
        x.moveTo(64, 18); x.bezierCurveTo(84, 40, 78, 62, 64, 76); x.bezierCurveTo(50, 62, 44, 40, 64, 18); x.fill();
        x.beginPath(); x.moveTo(60, 70); x.bezierCurveTo(40, 50, 18, 58, 26, 80); x.bezierCurveTo(34, 70, 46, 72, 56, 82); x.fill();
        x.beginPath(); x.moveTo(68, 70); x.bezierCurveTo(88, 50, 110, 58, 102, 80); x.bezierCurveTo(94, 70, 82, 72, 72, 82); x.fill();
        x.fillRect(40, 80, 48, 9);
        x.beginPath(); x.moveTo(56, 89); x.lineTo(72, 89); x.lineTo(64, 112); x.fill();
      }
    }
    var tx = new T3.CanvasTexture(cv);
    tx.encoding = T3.sRGBEncoding;
    tx.anisotropy = 4;
    crestCache[k] = tx;
    return tx;
  }

  // ---------- chuỗi đoạn mềm (áo choàng, bờm, đuôi, lông mũ) ----------
  // trả về mảng khớp; đoạn i+1 là con của đoạn i
  function chain(parent, n, segLen, makeSeg) {
    var joints = [], p = parent;
    for (var i = 0; i < n; i++) {
      var j = group(p, 0, i ? -segLen : 0, 0);
      makeSeg(j, i);
      joints.push(j);
      p = j;
    }
    return joints;
  }

  // ---------- chi tiết "chiến": gai, sừng, mắt phát sáng ----------
  function spikes(parent, t, n, r, h, y, tilt) {
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2, s = mesh(G.cone(r, h, 6), steel(t, true), parent, Math.cos(a) * r * 1.6, y, Math.sin(a) * r * 1.6, false);
      s.rotation.z = -Math.cos(a) * (tilt || 0.6); s.rotation.x = Math.sin(a) * (tilt || 0.6);
    }
  }
  // sừng cong: chuỗi chóp nón nhỏ dần, cong lên rồi ra trước
  function horns(parent, r, color, size) {
    size = size || 1;
    [-1, 1].forEach(function (sx) {
      var g = group(parent, sx * r * 0.85, r * 0.35, 0);
      g.rotation.z = -sx * 1.1;
      var p = g;
      for (var i = 0; i < 4; i++) {
        var seg = group(p, 0, i ? r * 0.42 * size : 0, 0);
        seg.rotation.z = sx * 0.32;
        seg.rotation.x = -0.18;
        mesh(G.cone(r * (0.28 - i * 0.055) * size, r * 0.5 * size, 7), mat(color, { rough: 0.45, metal: 0.2 }), seg, 0, r * 0.22 * size, 0, false);
        p = seg;
      }
    });
  }
  function eyes(rig, head, r, t, z, y) {
    var em = mat(0x000000, { emissive: t.eye });
    rig.eyes = rig.eyes || [];
    [-1, 1].forEach(function (sx) {
      var e = mesh(G.box(r * 0.28, r * 0.09, 0.01), em, head, sx * r * 0.32, y || r * 0.2, z || r * 1.1, false);
      rig.eyes.push(e);
    });
  }

  // ---------- người: tỉ lệ chiến binh (vai rộng, ngực nở, eo thon, chân vững) ----------
  function humanoid(c, o) {
    var t = TEAM[c], rig = {};
    var thigh = o.leg * 0.52, shin = o.leg * 0.48, tw = o.torsoW, th = o.torsoH;
    var root = rig.root = new T3.Group();
    var body = rig.body = group(root, 0, o.leg, 0);
    rig.baseY = o.leg;
    var plate = o.plate ? steel(t) : o.mail ? mat(o.chestColor, { metal: 0.75, rough: 0.55 }) : mat(o.chestColor || t.cloth, { rough: 0.85 });
    var torso = mesh(G.lathe('torso3' + tw + th, [[0.001, 0], [tw * 0.34, 0], [tw * 0.35, th * 0.22], [tw * 0.5, th * 0.55], [tw * 0.57, th * 0.78],
      [tw * 0.5, th * 0.94], [tw * 0.26, th * 1.02], [0.04, th * 1.04]], 22), plate, body, 0, 0.05, 0);
    torso.scale.z = 0.7;
    if (o.plate) {
      mesh(G.box(0.014, th * 0.62, 0.012), steel(t, true), body, 0, 0.05 + th * 0.55, tw * 0.38, false);
      // đai bụng chồng lớp
      for (var f = 0; f < 3; f++) mesh(G.cyl(tw * (0.4 + f * 0.02), tw * (0.42 + f * 0.03), 0.04, 18), steel(t, f % 2 === 1), body, 0, 0.1 - f * 0.035, 0, false).scale.z = 0.72;
      // váy giáp hai bên đùi
      [-1, 1].forEach(function (sx) {
        var ts = mesh(G.box(tw * 0.34, 0.11, 0.02), steel(t), body, sx * tw * 0.2, -0.04, tw * 0.3, false);
        ts.rotation.x = 0.25; ts.rotation.z = sx * 0.12;
      });
      if (t.spikes) spikes(body, t, 3, 0.012, 0.06, 0.05 + th * 0.7, 0.2);
    }
    if (o.tabard) {
      var tl = th * 0.55 + o.leg * 0.5;
      mesh(G.box(tw * 0.55, tl, 0.012), mat(0xffffff, { map: crestTex(c, 'emblem'), rough: 0.85 }), body, 0, 0.05 + th * 0.6 - tl / 2, tw * 0.4, false);
    }
    mesh(G.cyl(tw * 0.4, tw * 0.4, 0.035, 18), mat(0x2e1b0e, { rough: 0.6 }), body, 0, 0.06, 0, false).scale.z = 0.72;
    mesh(G.box(0.045, 0.04, 0.014), gold(t), body, 0, 0.06, tw * 0.3, false);
    var top = 0.05 + th;
    rig.shoulderY = top - 0.04;
    // gorget che cổ
    mesh(G.cyl(0.05, 0.075, 0.06, 14), o.plate || o.gorget ? steel(t, true) : mat(t.cloth2), body, 0, top + 0.01, 0, false);
    rig.head = group(body, 0, top + o.headR * 0.95, 0);
    ['L', 'R'].forEach(function (s, i) {
      var sx = i ? 1 : -1, aw = o.armW;
      var arm = rig['arm' + s] = group(body, sx * (tw / 2 + aw * 0.55), rig.shoulderY, 0);
      var armM = o.plate ? steel(t) : o.mail ? mat(o.sleeve, { metal: 0.75, rough: 0.55 }) : mat(o.sleeve || t.cloth, { rough: 0.85 });
      // giáp vai lớn nhiều lớp (đội Đen có gai)
      // giáp vai dẹt, chồng 3 lớp xuôi xuống như vảy, viền kim loại màu
      for (var q = 0; q < 3; q++) {
        var pd = mesh(G.hemi(aw * (1.75 - q * 0.18)), q === 1 ? steel(t, true) : steel(t), arm, sx * (0.01 + q * 0.012), 0.025 - q * 0.042, 0, q === 0);
        pd.rotation.z = sx * -(0.45 + q * 0.15); pd.scale.set(1.2, 0.5, 1.15);
      }
      var rim = mesh(G.torus(aw * 1.72, aw * 0.12, 20), t.spikes ? steel(t, true) : gold(t), arm, sx * 0.01, 0.025, 0, false);
      rim.rotation.set(Math.PI / 2, sx * 0.45, 0); rim.scale.set(1.2, 1.15, 1);
      if (t.spikes) for (var k = 0; k < 3; k++) {
        var sp = mesh(G.cone(aw * 0.35, aw * 1.6, 6), steel(t, true), arm, sx * (0.01 + k * 0.012), 0.07 + aw, (k - 1) * aw * 0.9, false);
        sp.rotation.z = -sx * 0.5;
      } else mesh(G.box(aw * 0.5, aw * 0.9, aw * 2.4), gold(t), arm, sx * aw * 0.4, 0.06 + aw * 0.8, 0, false).rotation.z = -sx * 0.4;
      var ua = o.arm * 0.5, fa = o.arm * 0.5;
      mesh(G.cyl(aw * 0.7, aw * 0.6, ua, 12), armM, arm, 0, -ua / 2, 0);
      var fore = rig['fore' + s] = group(arm, 0, -ua, 0);
      mesh(G.sph(aw * 0.85, 10), steel(t, true), fore, 0, 0, -0.005, false);
      if (t.spikes) mesh(G.cone(aw * 0.3, aw * 1.2, 5), steel(t, true), fore, 0, 0, -aw * 1.2, false).rotation.x = -Math.PI / 2;
      mesh(G.cyl(aw * 0.75, aw * 0.58, fa, 12), steel(t), fore, 0, -fa / 2, 0);
      var hand = rig['hand' + s] = group(fore, 0, -fa, 0);
      mesh(G.box(aw * 1.3, aw * 1.45, aw * 1.3), steel(t, true), hand, 0, -aw * 0.35, 0);
      var leg = rig['leg' + s] = group(body, sx * tw * 0.24, 0, 0);
      var legM = o.plate ? steel(t) : mat(o.legColor || t.cloth2, { rough: 0.85 });
      mesh(G.cyl(o.legW * 1.1, o.legW * 0.85, thigh, 12), legM, leg, 0, -thigh / 2, 0);
      var knee = rig['knee' + s] = group(leg, 0, -thigh, 0);
      mesh(G.sph(o.legW * 1.15, 10), steel(t, true), knee, 0, 0, 0.012, false);
      if (t.spikes) mesh(G.cone(o.legW * 0.4, o.legW * 1.4, 5), steel(t, true), knee, 0, 0, o.legW * 1.3, false).rotation.x = Math.PI / 2;
      mesh(G.cyl(o.legW * 0.95, o.legW * 0.75, shin, 12), steel(t), knee, 0, -shin / 2, 0);
      mesh(G.box(o.legW * 2, 0.05, o.legW * 3.5), steel(t, true), knee, 0, -shin + 0.025, o.legW * 0.8);
    });
    if (o.robe) {
      var skirt = mesh(G.lathe('robe3' + tw + o.leg, [[tw * 0.4, 0], [tw * 0.48, -o.leg * 0.3], [tw * 0.68, -o.leg * 0.75], [tw * 0.88, -o.leg - 0.03], [0.001, -o.leg - 0.03]], 24),
        mat(o.robe, { rough: 0.8, side: T3.DoubleSide }), body, 0, 0.06, 0);
      skirt.scale.z = 0.86;
      mesh(G.torus(tw * 0.87, 0.014, 32), gold(t), body, 0, 0.06 - o.leg - 0.015, 0, false).rotation.x = Math.PI / 2;
      rig.robe = skirt;
    }
    if (o.cape) {
      var capeRoot = rig.capeRoot = group(body, 0, top - 0.005, -tw * 0.33);
      var ch = th + o.leg - 0.02, cw = tw * 1.2;
      var cg = new T3.PlaneGeometry(cw, ch, 8, 12);
      cg.translate(0, -ch / 2, 0);
      // đội Đen: mép dưới áo choàng rách tả tơi
      if (t.tattered) {
        var pa = cg.attributes.position;
        for (var v = 0; v < pa.count; v++) if (pa.getY(v) < -ch * 0.8) pa.setY(v, pa.getY(v) + Math.random() * ch * 0.14);
      }
      rig.capeMesh = mesh(cg, mat(o.cape, { rough: 0.75, side: T3.DoubleSide }), capeRoot, 0, 0, 0);
      rig.capeBase = Float32Array.from(cg.attributes.position.array);
      rig.capeH = ch;
      rig.capeFlare = o.robe ? tw * 0.6 : tw * 0.25;
    }
    return rig;
  }

  // ---------- mũ kín, mắt sáng sau khe nhìn ----------
  function helm(rig, c, r, style) {
    var t = TEAM[c], h = rig.head, st = steel(t);
    var shell = mesh(G.sph(r * 1.12, 18), st, h, 0, r * 0.1, 0);
    shell.scale.set(1, 1.12, 1.1);
    mesh(G.box(r * 1.5, r * 0.16, 0.02), mat(0x050505), h, 0, r * 0.2, r * 1.1, false);           // khe nhìn
    eyes(rig, h, r, t, r * 1.105, r * 0.2);
    if (style !== 'hood') {
      var v = mesh(G.cone(r * 0.82, r * 0.95, 4), steel(t, true), h, 0, -r * 0.2, r * 0.72);       // lưỡi trai nhọn
      v.rotation.x = Math.PI / 2; v.rotation.y = Math.PI / 4; v.scale.set(1, 1, 0.5);
      mesh(G.box(0.016, r * 1.5, r * 2.1), t.spikes ? steel(t, true) : gold(t), h, 0, r * 0.8, 0, false);  // mào
    }
    if (style === 'sallet') mesh(G.cone(r * 0.9, r * 0.8, 12), st, h, 0, r * 0.15, -r * 0.75, false).rotation.x = -Math.PI / 2 - 0.5;
    if (style === 'great') {
      mesh(G.cyl(r * 1.18, r * 1.25, r * 2.1, 18), st, h, 0, r * 0.1, 0);
      mesh(G.box(r * 1.6, r * 0.14, 0.02), mat(0x050505), h, 0, r * 0.3, r * 1.22, false);
      eyes(rig, h, r * 1.1, t, r * 1.225, r * 0.3);
      mesh(G.box(0.02, r * 1.0, 0.02), gold(t), h, 0, -r * 0.3, r * 1.24, false);
      if (!t.spikes) for (var k = 0; k < 6; k++) { var a = k / 6 * Math.PI * 2; mesh(G.box(0.05, 0.06, 0.05), gold(t), h, Math.cos(a) * r, r * 1.2, Math.sin(a) * r, false); }
    }
    if (style === 'hood') {
      var hood = mesh(G.lathe('hood' + r, [[0.001, r * 1.9], [r * 0.5, r * 1.6], [r * 1.25, r * 0.8], [r * 1.35, 0], [r * 1.3, -r * 0.9], [r * 1.0, -r * 1.1]], 18),
        mat(t.spikes ? 0x1a1414 : 0xe9e2d2, { rough: 0.9, side: T3.DoubleSide }), h, 0, 0, -r * 0.1);
      hood.scale.z = 1.05;
      mesh(G.sph(r * 0.95, 14), mat(0x070606), h, 0, -r * 0.05, r * 0.25, false);   // khuôn mặt chìm trong bóng tối
      rig.eyes.slice(-2).forEach(function (e) { e.position.z = r * 1.1; });
    }
    if (t.spikes) horns(h, r, 0x1b1714, style === 'great' ? 1.5 : 1.15);
    return shell;
  }
  // chùm lông trên mũ (đội Trắng)
  function plume(rig, c, r, n) {
    var t = TEAM[c], base = group(rig.head, 0, r * 1.25, -r * 0.2), strands = [];
    for (var i = 0; i < n; i++) {
      var s = group(base, (i - (n - 1) / 2) * 0.012, 0, 0);
      s.rotation.x = -0.6 - Math.random() * 0.3;
      s.rotation.z = (i - (n - 1) / 2) * 0.12;
      var segs = chain(s, 3, 0.1, function (j, q) {
        mesh(G.box(0.032 - q * 0.007, 0.11, 0.006), mat(i % 2 ? 0xf6f3ec : t.cloth, { rough: 0.9, side: T3.DoubleSide }), j, 0, 0.055, 0, false).rotation.x = Math.PI;
      });
      segs.forEach(function (j) { j.position.y = j === segs[0] ? 0 : 0.1; j.rotation.x = -0.35; });
      strands.push(segs);
    }
    rig.plume = strands;
  }
  // cánh trên mũ (đội Trắng) hoặc sừng lớn (đội Đen)
  function wings(h, r, t) {
    [-1, 1].forEach(function (sx) {
      var g = group(h, sx * r * 1.05, r * 0.4, -r * 0.1);
      g.rotation.z = -sx * 0.5; g.rotation.y = sx * 0.4;
      for (var i = 0; i < 5; i++) mesh(G.box(0.02, r * (1.6 - i * 0.2), r * 0.35), gold(t), g, sx * i * 0.02, r * 0.6 - i * 0.04, -i * r * 0.28, false).rotation.x = -0.3 - i * 0.12;
    });
  }
  function crown(parent, c, r, h) {
    var t = TEAM[c], g = group(parent, 0, 0, 0), au = gold(t);
    mesh(G.cyl(r, r * 0.95, 0.055, 20), au, g, 0, 0, 0);
    for (var i = 0; i < 8; i++) {
      var a = i / 8 * Math.PI * 2, hh = h * (t.spikes ? (i % 2 ? 1.8 : 1.1) : 1);
      mesh(G.cone(0.018, hh, 5), t.spikes ? steel(t, true) : au, g, Math.cos(a) * r * 0.93, 0.03 + hh / 2, Math.sin(a) * r * 0.93, false);
    }
    mesh(G.sph(0.02, 10), mat(0x000000, { emissive: t.eye }), g, 0, 0.01, r * 0.98, false);
    return g;
  }

  // ---------- vũ khí ----------
  // đại kiếm có rãnh phát sáng dọc lưỡi
  function greatsword(parent, c, len) {
    var t = TEAM[c], g = group(parent, 0, -0.012, 0.02);
    mesh(G.cyl(0.015, 0.015, 0.16, 8), mat(0x24150b, { rough: 0.7 }), g, 0, 0.0, 0, false);
    mesh(G.sph(0.026, 10), gold(t), g, 0, -0.09, 0, false);
    var guard = mesh(G.box(0.22, 0.026, 0.035), t.spikes ? steel(t, true) : gold(t), g, 0, 0.085, 0, false);
    [-1, 1].forEach(function (sx) { mesh(G.cone(0.016, 0.06, 5), t.spikes ? steel(t, true) : gold(t), g, sx * 0.12, 0.1, 0, false).rotation.z = -sx * 0.7; });
    void guard;
    mesh(G.box(0.06, len, 0.012), mat(0xeef2f5, { metal: 1, rough: 0.1 }), g, 0, 0.1 + len / 2, 0);
    mesh(G.box(0.012, len * 0.82, 0.014), mat(0x000000, { emissive: t.eye }), g, 0, 0.1 + len * 0.44, 0, false);
    mesh(G.cone(0.03, 0.09, 4), mat(0xeef2f5, { metal: 1, rough: 0.1 }), g, 0, 0.1 + len + 0.04, 0, false).scale.z = 0.2;
    return g;
  }
  function halberd(parent, c) {
    var t = TEAM[c], g = group(parent, 0, -0.012, 0.02), blade = mat(0xe2e7ec, { metal: 1, rough: 0.15 });
    mesh(G.cyl(0.013, 0.013, 1.15, 8), mat(0x3d2716, { rough: 0.7 }), g, 0, 0.33, 0);
    mesh(G.cone(0.025, 0.16, 4), blade, g, 0, 0.98, 0, false);
    var ax = mesh(G.cyl(0.11, 0.11, 0.012, 16, 1), blade, g, 0.07, 0.82, 0);   // lưỡi rìu hình bán nguyệt
    ax.rotation.x = Math.PI / 2; ax.scale.set(0.75, 1, 1.2);
    mesh(G.cone(0.02, 0.09, 4), blade, g, -0.06, 0.84, 0, false).rotation.z = Math.PI / 2;
    mesh(G.box(0.05, 0.05, 0.006), mat(t.cloth, { side: T3.DoubleSide }), g, 0.03, 0.66, 0, false);
    return g;
  }
  function kiteShield(parent, c, s, x) {
    var g = group(parent, x === undefined ? -0.055 : x, -0.04, 0.02);
    var shape = new T3.Shape();
    shape.moveTo(-0.5, 0.5); shape.lineTo(0.5, 0.5); shape.lineTo(0.5, 0.05);
    shape.quadraticCurveTo(0.45, -0.5, 0, -0.95); shape.quadraticCurveTo(-0.45, -0.5, -0.5, 0.05); shape.lineTo(-0.5, 0.5);
    var gg = geo('kite', function () {
      var e = new T3.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.03, bevelSegments: 2 });
      var uv = e.attributes.uv, pos = e.attributes.position;
      for (var i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) + 0.5, (pos.getY(i) + 0.95) / 1.45);
      return e;
    });
    var m = mesh(gg, mat(0xffffff, { map: crestTex(c, 'emblem'), rough: 0.5, metal: 0.15 }), g, 0, 0, 0);
    m.scale.set(s, s, s);
    m.rotation.y = -Math.PI / 2;
    if (TEAM[c].spikes) mesh(G.cone(s * 0.12, s * 0.5, 6), steel(TEAM[c], true), g, -s * 0.14, 0, 0, false).rotation.z = Math.PI / 2;
    return g;
  }

  // ---------- từng loại quân ----------
  function makePawn(c) {
    var t = TEAM[c];
    var rig = humanoid(c, { leg: 0.28, legW: 0.045, torsoW: 0.25, torsoH: 0.24, headR: 0.07, armW: 0.046, arm: 0.25,
      chestColor: c ? 0x3a3c40 : 0x9aa1a8, sleeve: c ? 0x3a3c40 : 0x9aa1a8, legColor: t.cloth2, tabard: true, gorget: true, mail: true });
    helm(rig, c, 0.07, 'sallet');
    rig.weapon = halberd(rig.handR, c);
    kiteShield(rig.handL, c, 0.17);
    rig.restArm = { L: [-0.35, 0, -0.2], R: [-0.55, 0, 0.12] };
    rig.restFore = { L: -1.0, R: -0.75 };
    rig.weaponRest = 1.0;
    rig.attack = 'thrust';
    return rig;
  }
  function makeRook(c) {
    var t = TEAM[c];
    var rig = humanoid(c, { leg: 0.34, legW: 0.07, torsoW: 0.42, torsoH: 0.36, headR: 0.08, armW: 0.078, arm: 0.34, plate: true, cape: t.cloth2 });
    helm(rig, c, 0.08, 'great');
    // búa chiến khổng lồ có gai
    var w = rig.weapon = group(rig.handR, 0, -0.012, 0.03);
    mesh(G.cyl(0.02, 0.02, 0.9, 8), mat(0x2e1d10, { rough: 0.7 }), w, 0, 0.25, 0);
    mesh(G.box(0.32, 0.18, 0.18), steel(t, true), w, 0, 0.66, 0);
    mesh(G.box(0.33, 0.035, 0.19), gold(t), w, 0, 0.66, 0, false);
    mesh(G.cone(0.07, 0.15, 4), steel(t, true), w, -0.23, 0.66, 0, false).rotation.z = Math.PI / 2;
    mesh(G.cone(0.04, 0.16, 4), steel(t, true), w, 0, 0.82, 0, false);
    // khiên tháp trên tay trái
    var sh = group(rig.handL, -0.06, 0.02, 0.03);
    var tw = mesh(G.cyl(0.32, 0.32, 0.5, 14, 1, true), mat(0xffffff, { map: crestTex(c, 'emblem'), rough: 0.55, metal: 0.2, side: T3.DoubleSide }), sh, 0.25, 0, 0);
    tw.scale.set(0.18, 1, 0.55);
    void tw;
    rig.restArm = { L: [-0.6, 0, -0.25], R: [-0.6, 0, 0.18] };
    rig.restFore = { L: -0.9, R: -0.7 };
    rig.weaponRest = 0.9;
    rig.attack = 'smash';
    rig.heavy = true;
    return rig;
  }
  function makeBishop(c) {
    var t = TEAM[c];
    var rig = humanoid(c, { leg: 0.34, legW: 0.048, torsoW: 0.28, torsoH: 0.31, headR: 0.075, armW: 0.05, arm: 0.29, plate: true,
      robe: t.spikes ? 0x231a17 : 0xece6d8, tabard: true, cape: t.spikes ? 0x3a0b0b : t.cloth });
    helm(rig, c, 0.075, 'hood');
    // gậy phép chiến trận
    var w = rig.weapon = group(rig.handR, 0, -0.012, 0.03);
    mesh(G.cyl(0.014, 0.014, 1.05, 8), t.spikes ? steel(t, true) : gold(t), w, 0, 0.33, 0);
    if (t.spikes) {
      mesh(G.sph(0.06, 10), mat(0xd9d2c0, { rough: 0.6 }), w, 0, 0.9, 0, false).scale.set(1, 1.1, 1.1);   // đầu lâu
      horns(group(w, 0, 0.9, 0), 0.06, 0x1b1714, 1);
    } else {
      mesh(G.torus(0.09, 0.012, 22), gold(t), w, 0, 0.9, 0, false);
      for (var k = 0; k < 8; k++) { var a = k / 8 * Math.PI * 2; mesh(G.cone(0.012, 0.07, 4), gold(t), w, Math.cos(a) * 0.12, 0.9 + Math.sin(a) * 0.12, 0, false).rotation.z = a - Math.PI / 2; }
    }
    rig.orb = mesh(G.sph(0.045, 14), mat(0x000000, { emissive: t.gem }), w, 0, 0.9, 0.04, false);
    rig.restArm = { L: [-0.3, 0, -0.15], R: [-0.6, 0, 0.12] };
    rig.restFore = { L: -0.9, R: -0.6 };
    rig.weaponRest = 0.55;
    rig.attack = 'beam';
    rig.glide = true;
    return rig;
  }
  function makeQueen(c) {
    var t = TEAM[c];
    var rig = humanoid(c, { leg: 0.38, legW: 0.044, torsoW: 0.25, torsoH: 0.31, headR: 0.072, armW: 0.044, arm: 0.29, plate: true,
      robe: t.cloth, cape: t.cloth2 });
    helm(rig, c, 0.072, 'queen');
    if (t.spikes) horns(rig.head, 0.072, 0x1b1714, 1.6); else wings(rig.head, 0.072, t);
    var cr = crown(rig.head, c, 0.07, 0.08);
    cr.position.y = 0.11;
    rig.weapon = greatsword(rig.handR, c, 0.42);
    // quả cầu phép lơ lửng trên tay trái
    rig.orb = mesh(G.sph(0.05, 16), mat(0x000000, { emissive: t.gem }), rig.handL, 0, -0.03, 0.07, false);
    rig.restArm = { L: [-0.9, 0, -0.3], R: [-0.4, 0, 0.15] };
    rig.restFore = { L: -0.9, R: -0.7 };
    rig.weaponRest = 0.7;
    rig.attack = 'magic';
    rig.glide = true;
    return rig;
  }
  function makeKing(c) {
    var t = TEAM[c];
    var rig = humanoid(c, { leg: 0.37, legW: 0.06, torsoW: 0.33, torsoH: 0.35, headR: 0.08, armW: 0.062, arm: 0.33, plate: true, cape: t.cloth });
    helm(rig, c, 0.08, 'great');
    var cr = crown(rig.head, c, 0.1, 0.1);
    cr.position.y = 0.24;
    // cổ áo lông chồn
    var col = mesh(G.cyl(0.16, 0.2, 0.07, 18), mat(0xffffff, { map: crestTex(c, 'ermine'), rough: 0.9 }), rig.body, 0, rig.shoulderY + 0.05, -0.01, false);
    col.scale.z = 0.8;
    rig.weapon = greatsword(rig.handR, c, 0.6);
    rig.restArm = { L: [-0.2, 0, -0.18], R: [-0.75, 0, 0.15] };
    rig.restFore = { L: -0.5, R: -0.6 };
    rig.weaponRest = 1.1;
    rig.attack = 'slash';
    rig.heavy = true;
    return rig;
  }

  // ---------- Hiệp sĩ cưỡi chiến mã bọc giáp ----------
  function makeKnight(c) {
    var t = TEAM[c], rig = {};
    var root = rig.root = new T3.Group();
    var hide = mat(t.horse, { rough: 0.55 }), mane = mat(t.mane, { rough: 0.7, side: T3.DoubleSide }), hoof = mat(0x1d1a18, { rough: 0.5 });
    var horse = rig.horse = group(root, 0, 0, 0);
    var rear = rig.horseBody = group(horse, 0, 0.48, -0.18);
    rig.horseBaseY = 0.48;
    var torso = group(rear, 0, 0, 0.18);
    var barrel = mesh(G.sph(0.17, 18), hide, torso, 0, 0, 0);
    barrel.scale.set(0.95, 1, 1.75);
    mesh(G.sph(0.16, 16), hide, torso, 0, 0.01, 0.21).scale.set(1, 1.04, 1.05);
    mesh(G.sph(0.165, 16), hide, torso, 0, 0.02, -0.21).scale.set(1.05, 1, 1.1);
    // áo phủ có huy hiệu, mép rách với đội Đen
    var cap = mesh(G.cyl(0.185, 0.21, 0.22, 22, 1, true), mat(0xffffff, { map: crestTex(c, 'emblem'), rough: 0.8, side: T3.DoubleSide }), torso, 0, -0.1, -0.05);
    cap.scale.z = 1.7;
    var hem = mesh(G.torus(0.21, 0.011, 28), gold(t), torso, 0, -0.21, -0.05, false);
    hem.rotation.x = Math.PI / 2; hem.scale.set(1, 1.7, 1);
    // giáp ngực, giáp mông, giáp cổ
    var peytral = mesh(G.sph(0.17, 18), steel(t), torso, 0, -0.01, 0.25);
    peytral.scale.set(1.08, 0.8, 0.6);
    if (t.spikes) spikes(group(torso, 0, 0, 0.33), t, 4, 0.02, 0.1, 0, 1.3);
    var crupper = mesh(G.sph(0.17, 18), steel(t), torso, 0, 0.06, -0.24);
    crupper.scale.set(1.08, 0.75, 0.9);
    mesh(G.box(0.22, 0.05, 0.26), mat(0x2e1b0e, { rough: 0.55 }), torso, 0, 0.17, -0.02);
    mesh(G.box(0.24, 0.05, 0.06), mat(0x2e1b0e, { rough: 0.55 }), torso, 0, 0.21, -0.14, false);
    var neck = rig.horseNeck = group(torso, 0, 0.08, 0.26);
    var nk = mesh(G.cyl(0.075, 0.115, 0.36, 14), hide, neck, 0, 0.15, 0.06);
    nk.rotation.x = 0.55;
    var crinet = mesh(G.cyl(0.08, 0.11, 0.3, 14, 1), steel(t), neck, 0, 0.17, 0.05);
    crinet.rotation.x = 0.55; crinet.scale.set(1.05, 1, 0.65);
    var head = rig.horseHead = group(neck, 0, 0.32, 0.18);
    mesh(G.cyl(0.062, 0.042, 0.28, 12), hide, head, 0, 0, 0.09).rotation.x = Math.PI / 2 + 0.45;
    mesh(G.sph(0.052, 12), hide, head, 0, -0.065, 0.2);
    var chanfron = mesh(G.cyl(0.066, 0.047, 0.26, 12, 1), steel(t), head, 0, 0.025, 0.09);
    chanfron.rotation.x = Math.PI / 2 + 0.45; chanfron.scale.set(1.05, 1, 0.75);
    if (t.spikes) horns(group(head, 0, 0.04, 0.0), 0.05, 0x1b1714, 1.3);
    else mesh(G.cone(0.014, 0.13, 5), gold(t), head, 0, 0.1, 0.06, false).rotation.x = 0.7;   // sừng kỳ lân trên giáp mặt
    mesh(G.cone(0.018, 0.06, 5), hide, head, -0.035, 0.08, -0.03, false);
    mesh(G.cone(0.018, 0.06, 5), hide, head, 0.035, 0.08, -0.03, false);
    // mắt ngựa phát sáng
    rig.eyes = [];
    [-1, 1].forEach(function (sx) { rig.eyes.push(mesh(G.sph(0.013, 8), mat(0x000000, { emissive: t.eye }), head, sx * 0.058, 0.025, 0.05, false)); });
    var bridle = mesh(G.torus(0.057, 0.006, 18), mat(0x2a180c, { rough: 0.5 }), head, 0, -0.03, 0.12, false);
    bridle.rotation.y = Math.PI / 2; bridle.rotation.z = 0.5;
    rig.mane = [];
    for (var i = 0; i < 10; i++) {
      var mb = group(neck, 0, 0, 0);
      mb.position.set(0, 0.03 + i * 0.03, -0.03 + i * 0.017);
      rig.mane.push(chain(mb, 3, 0.065, function (j, q) {
        mesh(G.cone(0.017 - q * 0.004, 0.08, 5), mane, j, (i % 2 ? 1 : -1) * 0.01, -0.035, 0, false).rotation.x = Math.PI;
      }));
      rig.mane[i].forEach(function (j, q) { if (q) j.position.y = -0.065; });
      rig.mane[i][0].rotation.set(-1.0, 0, (i % 2 ? 1 : -1) * 0.5);
    }
    var tailBase = rig.horseTail = group(torso, 0, 0.08, -0.35);
    rig.tail = [];
    for (var k = 0; k < 3; k++) {
      var tb = group(tailBase, (k - 1) * 0.02, 0, 0);
      tb.rotation.x = -0.5;
      rig.tail.push(chain(tb, 5, 0.08, function (j, q) { mesh(G.box(0.032 - q * 0.004, 0.085, 0.02), mane, j, 0, -0.042, 0, false); }));
      rig.tail[k].forEach(function (j, q) { if (q) j.position.y = -0.08; });
    }
    rig.hLegs = []; rig.hKnees = [];
    [[-0.085, 0.21, 1], [0.085, 0.21, 1], [-0.09, -0.21, 0], [0.09, -0.21, 0]].forEach(function (p) {
      var lg = group(p[2] ? torso : horse, p[0], p[2] ? -0.06 : 0.44, p[1]);
      mesh(G.cyl(0.05, 0.035, 0.21, 10), hide, lg, 0, -0.105, 0);
      var kn = group(lg, 0, -0.21, 0);
      mesh(G.cyl(0.029, 0.024, 0.2, 10), hide, kn, 0, -0.1, 0);
      mesh(G.cyl(0.04, 0.034, 0.055, 10), mane, kn, 0, -0.18, 0, false);
      mesh(G.cyl(0.033, 0.037, 0.04, 10), hoof, kn, 0, -0.215, 0);
      rig.hLegs.push(lg); rig.hKnees.push(kn);
    });

    var rider = humanoid(c, { leg: 0.22, legW: 0.042, torsoW: 0.24, torsoH: 0.26, headR: 0.066, armW: 0.046, arm: 0.26, plate: true, cape: t.cloth });
    torso.add(rider.root);
    rider.root.position.set(0, 0.0, -0.03);
    rider.body.position.y = 0.21;
    rider.legL.rotation.set(-1.15, 0, -0.45); rider.kneeL.rotation.x = 1.1;
    rider.legR.rotation.set(-1.15, 0, 0.45); rider.kneeR.rotation.x = 1.1;
    helm(rider, c, 0.066, 'armet');
    if (!t.spikes) plume(rider, c, 0.066, 5);
    rider.weapon = greatsword(rider.handR, c, 0.5);
    kiteShield(rider.handL, c, 0.13);
    Object.keys(rider).forEach(function (k2) { if (!(k2 in rig)) rig[k2] = rider[k2]; });
    rig.eyes = rig.eyes.concat(rider.eyes);
    rig.rider = rider.root;
    rig.body = rider.body;
    rig.baseY = 0.21;
    rig.restArm = { L: [-0.5, 0, -0.15], R: [-1.7, 0, 0.35] };
    rig.restFore = { L: -0.6, R: -0.5 };
    rig.weaponRest = 0.6;
    rig.attack = 'rear';
    return rig;
  }

  var MAKERS = { P: makePawn, N: makeKnight, B: makeBishop, R: makeRook, Q: makeQueen, K: makeKing };
  var SCALE = { P: 1.3, N: 1.35, B: 1.42, R: 1.52, Q: 1.46, K: 1.56 };

  function create(kind, color) {
    var rig = MAKERS[kind](color);
    rig.kind = kind;
    rig.color = color;
    rig.root.scale.setScalar(SCALE[kind]);
    rig.weaponRest = rig.weaponRest || 0;
    rig.restFore = rig.restFore || { L: -0.3, R: -0.3 };
    rig.phase = Math.random() * 10;
    rig.speed = 0;
    rig.eyes = rig.eyes || [];
    rest(rig);
    rig.root.traverse(function (o) { if (o.isMesh) o.userData.rig = rig; });
    return rig;
  }

  // Tư thế thủ thế: chân dang rộng, gối hơi chùng, người đổ về trước
  function rest(rig) {
    var a = rig.restArm;
    rig.armL.rotation.set(a.L[0], a.L[1], a.L[2]);
    rig.armR.rotation.set(a.R[0], a.R[1], a.R[2]);
    rig.foreL.rotation.set(rig.restFore.L, 0, 0);
    rig.foreR.rotation.set(rig.restFore.R, 0, 0);
    if (rig.kind !== 'N') {
      rig.legL.rotation.set(-0.12, 0, -0.13); rig.legR.rotation.set(0.1, 0, 0.13);
      rig.kneeL.rotation.set(0.22, 0, 0); rig.kneeR.rotation.set(0.12, 0, 0);
    }
    rig.body.position.set(0, rig.baseY - (rig.kind !== 'N' ? rig.baseY * 0.03 : 0), 0);
    rig.body.rotation.set(rig.kind !== 'N' ? 0.08 : 0, 0, 0);
    rig.head.rotation.set(rig.kind !== 'N' ? -0.08 : 0, 0, 0);
    if (rig.weapon) rig.weapon.rotation.set(rig.weaponRest, 0, 0);
    if (rig.hLegs) {
      rig.hLegs.forEach(function (l) { l.rotation.set(0, 0, 0); });
      rig.hKnees.forEach(function (l) { l.rotation.set(0, 0, 0); });
    }
    if (rig.horseBody) { rig.horseBody.rotation.set(0, 0, 0); rig.horseBody.position.y = rig.horseBaseY; }
    if (rig.horseNeck) rig.horseNeck.rotation.set(0, 0, 0);
    if (rig.rider) rig.rider.position.z = -0.03;
  }

  // Vải, bờm, đuôi, lông mũ: sóng lan dọc chuỗi, mạnh hơn khi đang chạy (rig.speed 0..1)
  function cloth(rig, t) {
    var sp = rig.speed || 0, i;
    if (rig.capeMesh) {
      var g = rig.capeMesh.geometry, pos = g.attributes.position, b = rig.capeBase, h = rig.capeH, fl = rig.capeFlare;
      var lift = Math.min(1, sp), f = t * (2.2 + lift * 5) + rig.phase;
      for (i = 0; i < pos.count; i++) {
        var x0 = b[i * 3], y0 = b[i * 3 + 1], v = Math.max(0, -y0 / h); // làm tròn số có thể cho giá trị âm rất nhỏ
        var back = -(0.01 + fl * Math.pow(v, 1.4)) - lift * 0.34 * Math.pow(v, 1.2);
        var wave = Math.sin(f - v * 4.5 + x0 * 7) * (0.01 + lift * 0.05) * v;
        pos.setXYZ(i, x0 * (1 + v * 0.25), y0 * (1 - lift * 0.24 * v), back + wave);
      }
      pos.needsUpdate = true;
      g.computeVertexNormals();
    }
    if (rig.plume) rig.plume.forEach(function (s, n) {
      s.forEach(function (j, k) { j.rotation.x = -0.3 - sp * 0.25 + Math.sin(t * (3 + sp * 5) - k - n + rig.phase) * (0.08 + sp * 0.12); });
    });
    if (rig.mane) rig.mane.forEach(function (s, n) {
      s.forEach(function (j, k) { if (k) j.rotation.x = -0.25 - sp * 0.3 + Math.sin(t * (2.5 + sp * 6) - k * 0.8 - n * 0.5 + rig.phase) * (0.12 + sp * 0.2); });
    });
    if (rig.tail) rig.tail.forEach(function (s, n) {
      s.forEach(function (j, k) {
        j.rotation.x = (k ? 0.12 : 0) - sp * 0.25 + Math.sin(t * (2 + sp * 5) - k * 0.7 + n + rig.phase) * (0.08 + sp * 0.15);
        j.rotation.z = Math.sin(t * 1.3 - k * 0.6 + n * 2 + rig.phase) * (0.12 + sp * 0.05);
      });
    });
    // mắt sáng nhấp nháy như than hồng
    var glow = 0.75 + Math.sin(t * 3 + rig.phase) * 0.25;
    rig.eyes.forEach(function (e) { e.scale.y = glow; });
  }

  // Thở nặng, mắt đảo nhìn, thỉnh thoảng xoay cổ tay vũ khí
  function idle(rig, t) {
    var p = t * 1.5 + rig.phase;
    rig.speed += (0 - rig.speed) * 0.05;
    var by = rig.baseY - (rig.kind !== 'N' ? rig.baseY * 0.03 : 0);
    rig.body.position.y = by + Math.sin(p) * 0.007;
    rig.body.rotation.x = (rig.kind !== 'N' ? 0.08 : 0) + Math.sin(p) * 0.015;
    rig.armL.rotation.x = rig.restArm.L[0] + Math.sin(p) * 0.03;
    rig.armR.rotation.x = rig.restArm.R[0] - Math.sin(p) * 0.03;
    rig.head.rotation.y = Math.sin(t * 0.33 + rig.phase) * 0.3;
    if (rig.weapon) rig.weapon.rotation.x = rig.weaponRest + Math.max(0, Math.sin(t * 0.4 + rig.phase) - 0.95) * 6;
    if (rig.horseNeck) rig.horseNeck.rotation.x = Math.sin(p * 0.6) * 0.07;
    if (rig.hKnees) rig.hKnees[1].rotation.x = Math.max(0, Math.sin(t * 0.5 + rig.phase) - 0.9) * 8;
    if (rig.horseTail) rig.horseTail.rotation.z = Math.sin(p * 1.1) * 0.25;
    if (rig.orb) rig.orb.scale.setScalar(1 + Math.sin(t * 4 + rig.phase) * 0.15);
    if (rig.glide) rig.root.position.y = 0;
    cloth(rig, t);
  }

  // Bước đi nặng nề: người hạ thấp mỗi lần chân chạm đất. ph = pha bước, amt = độ mạnh (0..1)
  function walk(rig, ph, amt, t) {
    amt = amt === undefined ? 1 : amt;
    rig.speed = amt;
    var s = Math.sin(ph), c = Math.cos(ph);
    if (rig.kind === 'N') {
      var L = rig.hLegs, K = rig.hKnees;
      [[0, 3, 1], [1, 2, -1]].forEach(function (pr) {
        var v = s * pr[2];
        L[pr[0]].rotation.x = v * 0.7 * amt; L[pr[1]].rotation.x = v * 0.7 * amt;
        K[pr[0]].rotation.x = Math.max(0, -v) * 1.3 * amt; K[pr[1]].rotation.x = -Math.max(0, -v) * 0.7 * amt;
      });
      rig.horseBody.position.y = rig.horseBaseY + Math.abs(c) * 0.04 * amt;
      rig.horseBody.rotation.x = s * 0.05 * amt;
      rig.horseNeck.rotation.x = c * 0.14 * amt;
      rig.body.position.y = rig.baseY + Math.abs(s) * 0.02 * amt;
      rig.body.rotation.x = 0.2 * amt;   // kỵ sĩ rạp người khi xung phong
    } else if (rig.glide) {
      // lướt: thân nghiêng về trước, áo choàng tung ra sau
      rig.body.rotation.x = 0.2 * amt;
      rig.armL.rotation.x = rig.restArm.L[0] - 0.4 * amt;
      rig.armR.rotation.x = rig.restArm.R[0] + 0.5 * amt;
    } else {
      var heavy = rig.heavy ? 1.3 : 1;
      rig.legL.rotation.x = s * 0.6 * amt;
      rig.legR.rotation.x = -s * 0.6 * amt;
      rig.kneeL.rotation.x = 0.1 + Math.max(0, -s) * 0.9 * amt;
      rig.kneeR.rotation.x = 0.1 + Math.max(0, s) * 0.9 * amt;
      rig.legL.rotation.z = -0.08; rig.legR.rotation.z = 0.08;
      rig.armL.rotation.x = rig.restArm.L[0] - s * 0.2 * amt;
      rig.armR.rotation.x = rig.restArm.R[0] + s * 0.15 * amt;
      rig.body.position.y = rig.baseY * 0.96 - Math.pow(Math.abs(s), 3) * 0.035 * heavy * amt + 0.01;
      rig.body.rotation.x = 0.16 * amt;
      rig.body.rotation.y = s * 0.12 * amt;   // vai lắc theo bước
      rig.body.rotation.z = s * 0.04 * heavy * amt;
      if (rig.robe) rig.robe.rotation.z = s * 0.03 * amt;
    }
    cloth(rig, t || ph * 0.4);
  }

  window.Characters = { create: create, rest: rest, idle: idle, walk: walk, cloth: cloth, TEAM: TEAM, mat: mat, G: G, mesh: mesh, group: group };
})();
