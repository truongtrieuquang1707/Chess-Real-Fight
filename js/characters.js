// Dựng nhân vật trung cổ (three.js) theo phong cách tượng giáp kim loại: giáp tấm phản chiếu, áo choàng nhiều đoạn bay theo
// chuyển động, ngựa có khớp gối, bờm và đuôi nhiều sợi. Mỗi nhân vật có khung xương: thân, đầu, vai → khuỷu → bàn tay,
// hông → gối; vũ khí cầm ở tay phải. Hướng nhìn mặc định là +z.
(function () {
  'use strict';
  var T3 = window.THREE;

  var TEAM = [
    { steel: 0xc9cfd6, steel2: 0x9aa3ad, cloth: 0x2c56a3, cloth2: 0x1b3366, trim: 0xd8b04a, skin: 0xe4b892, hair: 0x6e4a2c,
      horse: 0xeeebe4, mane: 0xf7f5f0, gem: 0x6fd0ff, crest: '#2c56a3', crestFg: '#f2d27a' },
    { steel: 0x41454c, steel2: 0x2a2d32, cloth: 0x9b1c1c, cloth2: 0x5e1010, trim: 0xc39432, skin: 0xcf9878, hair: 0x241912,
      horse: 0x2e241f, mane: 0x15100c, gem: 0xff5b3a, crest: '#8f1a1a', crestFg: '#e8bf4a' }
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
      if (kind === 'cross') {
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

  // ---------- người ----------
  function humanoid(c, o) {
    var t = TEAM[c], rig = { joints: [] };
    var thigh = o.leg * 0.52, shin = o.leg * 0.48, tw = o.torsoW, th = o.torsoH;
    var root = rig.root = new T3.Group();
    var body = rig.body = group(root, 0, o.leg, 0);
    rig.baseY = o.leg;
    var plate = o.plate ? steel(t) : mat(o.chestColor || t.cloth, { rough: 0.85 });
    // thân: giáp ngực tạo bằng phép tiện (lathe)
    var torso = mesh(G.lathe('torso' + tw + th, [[0.001, 0], [tw * 0.36, 0], [tw * 0.4, th * 0.25], [tw * 0.5, th * 0.62], [tw * 0.5, th * 0.82], [tw * 0.36, th], [0.04, th + 0.01]]), plate, body, 0, 0.05, 0);
    torso.scale.z = 0.72;
    if (o.plate) {
      // gân giữa giáp ngực và đai bụng
      mesh(G.box(0.012, th * 0.6, 0.01), steel(t, true), body, 0, 0.05 + th * 0.55, tw * 0.36, false);
      for (var f = 0; f < 3; f++) {
        var fr = mesh(G.cyl(tw * (0.43 + f * 0.035), tw * (0.47 + f * 0.04), 0.045, 18), steel(t, f % 2 === 1), body, 0, 0.02 - f * 0.04, 0);
        fr.scale.z = 0.76;
      }
    }
    if (o.tabard) {
      var tab = mesh(G.box(tw * 0.62, th * 0.62 + o.leg * 0.45, 0.012), mat(0xffffff, { map: crestTex(c, o.tabard), rough: 0.85 }), body, 0, 0.05 + th * 0.58 - (th * 0.62 + o.leg * 0.45) / 2 + th * 0.31, tw * 0.37, false);
      tab.position.y = 0.05 + th * 0.62 - (th * 0.62 + o.leg * 0.45) / 2;
    }
    mesh(G.cyl(tw * 0.41, tw * 0.41, 0.03, 18), mat(0x4a2e18, { rough: 0.6 }), body, 0, 0.06, 0, false).scale.z = 0.76;
    mesh(G.box(0.035, 0.03, 0.012), gold(t), body, 0, 0.06, tw * 0.31, false);
    var top = 0.05 + th;
    rig.shoulderY = top - 0.035;
    mesh(G.cyl(0.032, 0.04, 0.05, 10), o.plate ? steel(t, true) : mat(t.skin), body, 0, top + 0.015, 0, false);
    var head = rig.head = group(body, 0, top + o.headR * 0.95, 0);
    if (o.face !== false) {
      mesh(G.sph(o.headR, 18), mat(t.skin, { rough: 0.75 }), head, 0, 0, 0);
      mesh(G.sph(o.headR * 0.11, 8), mat(0x16110d), head, -o.headR * 0.36, o.headR * 0.12, o.headR * 0.9, false);
      mesh(G.sph(o.headR * 0.11, 8), mat(0x16110d), head, o.headR * 0.36, o.headR * 0.12, o.headR * 0.9, false);
      mesh(G.cone(o.headR * 0.14, o.headR * 0.3, 6), mat(t.skin), head, 0, -o.headR * 0.05, o.headR * 1.0, false).rotation.x = Math.PI / 2;
    }
    ['L', 'R'].forEach(function (s, i) {
      var sx = i ? 1 : -1, aw = o.armW;
      var arm = rig['arm' + s] = group(body, sx * (tw / 2 + aw * 0.5), rig.shoulderY, 0);
      var armM = o.plate ? steel(t) : mat(o.sleeve || t.cloth, { rough: 0.85 });
      if (o.plate || o.pauldron) {
        // giáp vai nhiều lớp
        for (var q = 0; q < 3; q++) {
          var pd = mesh(G.hemi(aw * (1.9 - q * 0.22)), steel(t, q === 1), arm, sx * 0.008, 0.02 - q * 0.035, 0, q === 0);
          pd.rotation.z = sx * -0.35;
          pd.scale.set(1, 0.8, 1);
        }
      }
      var ua = o.arm * 0.5, fa = o.arm * 0.5;
      mesh(G.cyl(aw * 0.62, aw * 0.55, ua, 12), armM, arm, 0, -ua / 2, 0);
      var fore = rig['fore' + s] = group(arm, 0, -ua, 0);
      if (o.plate) mesh(G.sph(aw * 0.75, 10), steel(t, true), fore, 0, 0, -0.005, false); // khuỷu
      mesh(G.cyl(aw * 0.62, aw * 0.5, fa, 12), o.plate ? steel(t) : armM, fore, 0, -fa / 2, 0);
      var hand = rig['hand' + s] = group(fore, 0, -fa, 0);
      mesh(G.box(aw * 1.15, aw * 1.3, aw * 1.15), o.plate ? steel(t, true) : mat(o.gloves || 0x5b3b22, { rough: 0.8 }), hand, 0, -aw * 0.35, 0);
      var leg = rig['leg' + s] = group(body, sx * tw * 0.22, 0, 0);
      var legM = o.plate ? steel(t) : mat(o.legColor || t.cloth2, { rough: 0.85 });
      mesh(G.cyl(o.legW, o.legW * 0.82, thigh, 12), legM, leg, 0, -thigh / 2, 0);
      var knee = rig['knee' + s] = group(leg, 0, -thigh, 0);
      if (o.plate) mesh(G.sph(o.legW * 1.05, 10), steel(t, true), knee, 0, 0, 0.01, false);
      mesh(G.cyl(o.legW * 0.85, o.legW * 0.7, shin, 12), legM, knee, 0, -shin / 2, 0);
      var foot = mesh(G.box(o.legW * 1.8, 0.045, o.legW * 3.2), o.plate ? steel(t, true) : mat(0x3a2414, { rough: 0.8 }), knee, 0, -shin + 0.022, o.legW * 0.7);
      void foot;
    });
    if (o.robe) {
      var skirt = mesh(G.lathe('robe' + tw + o.leg, [[tw * 0.42, 0], [tw * 0.5, -o.leg * 0.3], [tw * 0.7, -o.leg * 0.75], [tw * 0.86, -o.leg - 0.03], [0.001, -o.leg - 0.03]], 24),
        mat(o.robe, { rough: 0.85, side: T3.DoubleSide }), body, 0, 0.06, 0);
      skirt.scale.z = 0.86;
      mesh(G.torus(tw * 0.85, 0.012, 32), gold(t), body, 0, 0.06 - o.leg - 0.015, 0, false).rotation.x = Math.PI / 2;
      rig.robe = skirt;
    }
    if (o.cape) {
      // áo choàng là một tấm vải liền, các đỉnh được dời theo sóng mỗi khung hình (xem cloth())
      var capeRoot = rig.capeRoot = group(body, 0, top - 0.005, -tw * 0.33);
      var ch = th + o.leg - 0.02, cw = tw * 1.1;
      var cg = new T3.PlaneGeometry(cw, ch, 6, 12);
      cg.translate(0, -ch / 2, 0);
      var capeM = o.cape === 'ermine' ? mat(t.cloth, { rough: 0.75, side: T3.DoubleSide }) : mat(o.cape, { rough: 0.75, side: T3.DoubleSide });
      rig.capeMesh = mesh(cg, capeM, capeRoot, 0, 0, 0);
      rig.capeBase = Float32Array.from(cg.attributes.position.array);
      rig.capeH = ch;
      rig.capeFlare = o.robe ? tw * 0.6 : tw * 0.2;
      if (o.cape === 'ermine') {
        var collar = mesh(G.cyl(tw * 0.52, tw * 0.6, 0.06, 18), mat(0xffffff, { map: crestTex(c, 'ermine'), rough: 0.9 }), body, 0, top - 0.02, 0, false);
        collar.scale.z = 0.8;
      }
    }
    return rig;
  }

  // ---------- mũ ----------
  function helmet(rig, c, r, style) {
    var t = TEAM[c], h = rig.head, st = steel(t);
    if (style === 'kettle') {
      mesh(G.hemi(r * 1.12), st, h, 0, r * 0.05, 0);
      mesh(G.cyl(r * 1.6, r * 1.75, 0.02, 20), st, h, 0, r * 0.05, 0);
      mesh(G.sph(r * 1.0, 14), mat(0x8e949b, { metal: 0.7, rough: 0.55 }), h, 0, -r * 0.15, -r * 0.1, false).scale.set(1.05, 0.9, 1);
    } else if (style === 'armet' || style === 'great') {
      // mũ kín có lưỡi trai che mặt và khe nhìn
      var hm = mesh(G.sph(r * 1.13, 18), st, h, 0, r * 0.08, 0);
      hm.scale.set(1, 1.08, 1.08);
      var vis = mesh(G.cone(r * 0.85, r * 1.0, 4), steel(t, true), h, 0, r * 0.05, r * 0.72);
      vis.rotation.x = Math.PI / 2; vis.rotation.y = Math.PI / 4; vis.scale.set(1, 1, 0.55);
      mesh(G.box(r * 1.3, 0.012, 0.02), mat(0x0c0c0c), h, 0, r * 0.22, r * 1.05, false);
      mesh(G.box(0.014, r * 1.4, r * 2.0), steel(t, true), h, 0, r * 0.75, 0, false); // gờ đỉnh mũ
      if (style === 'great') {
        mesh(G.cyl(r * 1.15, r * 1.2, r * 1.9, 18), st, h, 0, r * 0.15, 0);
        for (var k = 0; k < 6; k++) { var a = k / 6 * Math.PI * 2; mesh(G.box(0.04, 0.05, 0.04), gold(t), h, Math.cos(a) * r, r * 1.2, Math.sin(a) * r, false); }
      }
    }
  }
  // chùm lông trên mũ: các sợi cong bay ra sau
  function plume(rig, c, r, n) {
    var t = TEAM[c], base = group(rig.head, 0, r * 1.15, -r * 0.2), strands = [];
    for (var i = 0; i < n; i++) {
      var s = group(base, (i - (n - 1) / 2) * 0.012, 0, 0);
      s.rotation.x = -0.6 - Math.random() * 0.3;
      s.rotation.z = (i - (n - 1) / 2) * 0.12;
      var segs = chain(s, 3, 0.09, function (j, q) {
        mesh(G.box(0.03 - q * 0.007, 0.1, 0.006), mat(i % 2 ? 0xf6f3ec : t.cloth, { rough: 0.9, side: T3.DoubleSide }), j, 0, 0.05, 0, false).rotation.x = Math.PI;
      });
      segs.forEach(function (j) { j.position.y = j === segs[0] ? 0 : 0.09; j.rotation.x = -0.35; });
      strands.push(segs);
    }
    rig.plume = strands;
  }
  function crown(parent, c, r, h) {
    var g = group(parent, 0, 0, 0), au = gold(TEAM[c]);
    mesh(G.cyl(r, r * 0.95, 0.05, 20), au, g, 0, 0, 0);
    for (var i = 0; i < 8; i++) {
      var a = i / 8 * Math.PI * 2;
      mesh(G.cone(0.016, h, 5), au, g, Math.cos(a) * r * 0.93, 0.045, Math.sin(a) * r * 0.93, false);
      mesh(G.sph(0.012, 8), au, g, Math.cos(a) * r * 0.93, 0.05 + h * 0.5, Math.sin(a) * r * 0.93, false);
    }
    mesh(G.sph(0.018, 10), mat(TEAM[c].gem, { emissive: TEAM[c].gem, rough: 0.2 }), g, 0, 0.005, r * 0.98, false);
    return g;
  }

  // ---------- vũ khí ----------
  function longsword(parent, c, len) {
    var g = group(parent, 0, -0.012, 0.02), t = TEAM[c];
    mesh(G.cyl(0.013, 0.013, 0.11, 8), mat(0x3b2412, { rough: 0.7 }), g, 0, 0.0, 0, false);
    mesh(G.sph(0.022, 10), gold(t), g, 0, -0.065, 0, false);
    mesh(G.box(0.16, 0.022, 0.03), gold(t), g, 0, 0.06, 0, false);
    var blade = mesh(G.box(0.042, len, 0.01), mat(0xeef2f5, { metal: 1, rough: 0.12 }), g, 0, 0.07 + len / 2, 0);
    mesh(G.cone(0.021, 0.07, 4), mat(0xeef2f5, { metal: 1, rough: 0.12 }), g, 0, 0.07 + len + 0.03, 0, false).scale.z = 0.25;
    void blade;
    return g;
  }
  function spear(parent, c) {
    var g = group(parent, 0, -0.012, 0.02);
    mesh(G.cyl(0.012, 0.012, 1.05, 8), mat(0x6b4426, { rough: 0.7 }), g, 0, 0.3, 0);
    mesh(G.cone(0.032, 0.14, 4), mat(0xeef2f5, { metal: 1, rough: 0.15 }), g, 0, 0.89, 0, false);
    mesh(G.box(0.05, 0.035, 0.005), mat(TEAM[c].cloth, { side: T3.DoubleSide }), g, 0.03, 0.78, 0, false);
    return g;
  }
  function kiteShield(parent, c, s) {
    var t = TEAM[c], g = group(parent, -0.05, -0.04, 0.02);
    var shape = new T3.Shape();
    shape.moveTo(-0.5, 0.5); shape.lineTo(0.5, 0.5); shape.lineTo(0.5, 0.05);
    shape.quadraticCurveTo(0.45, -0.5, 0, -0.95); shape.quadraticCurveTo(-0.45, -0.5, -0.5, 0.05); shape.lineTo(-0.5, 0.5);
    var gg = geo('kite', function () {
      var e = new T3.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.04, bevelThickness: 0.03, bevelSegments: 2 });
      // UV phẳng theo khung huy hiệu
      var uv = e.attributes.uv, pos = e.attributes.position;
      for (var i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) + 0.5, (pos.getY(i) + 0.95) / 1.45);
      return e;
    });
    var m = mesh(gg, mat(0xffffff, { map: crestTex(c, 'fleur'), rough: 0.55, metal: 0.1 }), g, 0, 0, 0);
    m.scale.set(s, s, s);
    m.rotation.y = -Math.PI / 2;
    void t;
    return g;
  }

  // ---------- từng loại quân ----------
  function makePawn(c) {
    var t = TEAM[c];
    var rig = humanoid(c, { leg: 0.27, legW: 0.04, torsoW: 0.22, torsoH: 0.23, headR: 0.072, armW: 0.042, arm: 0.24,
      chestColor: 0x8b9198, sleeve: 0x8b9198, legColor: t.cloth2, tabard: 'fleur', pauldron: false });
    helmet(rig, c, 0.072, 'kettle');
    rig.weapon = spear(rig.handR, c);
    kiteShield(rig.handL, c, 0.15);
    rig.restArm = { L: [0.2, 0, -0.15], R: [-0.3, 0, 0.12] };
    rig.restFore = { L: -0.9, R: -0.5 };
    rig.weaponRest = 0.5;
    rig.attack = 'thrust';
    return rig;
  }
  function makeRook(c) {
    var t = TEAM[c];
    var rig = humanoid(c, { leg: 0.33, legW: 0.062, torsoW: 0.36, torsoH: 0.33, headR: 0.085, armW: 0.068, arm: 0.32, plate: true, cape: t.cloth2, face: false });
    helmet(rig, c, 0.085, 'great');
    // búa chiến hai tay
    var w = rig.weapon = group(rig.handR, 0, -0.012, 0.03);
    mesh(G.cyl(0.018, 0.018, 0.78, 8), mat(0x5a3a20, { rough: 0.7 }), w, 0, 0.22, 0);
    mesh(G.box(0.26, 0.15, 0.15), steel(t, true), w, 0, 0.6, 0);
    mesh(G.cone(0.06, 0.12, 4), steel(t, true), w, -0.18, 0.6, 0).rotation.z = Math.PI / 2;
    mesh(G.box(0.27, 0.03, 0.16), gold(t), w, 0, 0.6, 0, false);
    rig.restArm = { L: [0.1, 0, -0.12], R: [-0.35, 0, 0.12] };
    rig.restFore = { L: -0.3, R: -0.4 };
    rig.attack = 'smash';
    return rig;
  }
  function makeBishop(c) {
    var t = TEAM[c];
    var rig = humanoid(c, { leg: 0.33, legW: 0.045, torsoW: 0.24, torsoH: 0.3, headR: 0.078, armW: 0.046, arm: 0.28,
      chestColor: 0xefe8da, robe: 0xefe8da, sleeve: 0xefe8da, gloves: t.skin, tabard: 'cross', cape: t.cloth });
    var mitre = mesh(G.cone(0.074, 0.22, 4), mat(0xffffff, { map: crestTex(c, 'cross'), rough: 0.7 }), rig.head, 0, 0.13, 0);
    mitre.rotation.y = Math.PI / 4; mitre.scale.z = 0.62;
    mesh(G.cyl(0.075, 0.075, 0.03, 18), gold(t), rig.head, 0, 0.045, 0, false);
    mesh(G.cone(0.055, 0.12, 8), mat(0xdcd6cc, { rough: 0.9 }), rig.head, 0, -0.08, 0.05, false).rotation.x = Math.PI; // râu bạc
    // gậy mục tử đầu cong, gắn ngọc phát sáng
    var w = rig.weapon = group(rig.handR, 0, -0.012, 0.03);
    mesh(G.cyl(0.013, 0.013, 0.95, 8), gold(t), w, 0, 0.3, 0);
    var hook = mesh(new T3.TorusGeometry(0.065, 0.013, 8, 20, Math.PI * 1.4), gold(t), w, 0.065, 0.8, 0, false);
    hook.rotation.z = -0.2;
    rig.orb = mesh(G.sph(0.038, 14), mat(t.gem, { emissive: t.gem, rough: 0.2 }), w, 0.065, 0.8, 0, false);
    rig.restArm = { L: [0.1, 0, -0.08], R: [-0.3, 0, 0.1] };
    rig.restFore = { L: -0.6, R: -0.45 };
    rig.attack = 'beam';
    return rig;
  }
  function makeQueen(c) {
    var t = TEAM[c];
    var rig = humanoid(c, { leg: 0.37, legW: 0.042, torsoW: 0.22, torsoH: 0.3, headR: 0.075, armW: 0.04, arm: 0.28,
      chestColor: t.cloth, robe: t.cloth, sleeve: t.cloth, gloves: t.skin, cape: t.cloth2 });
    // tóc dài nhiều lọn
    mesh(G.sph(0.081, 16), mat(t.hair, { rough: 0.6 }), rig.head, 0, 0.02, -0.012).scale.set(1, 1.05, 1.05);
    rig.hair = [];
    for (var i = 0; i < 5; i++) {
      var hb = group(rig.head, (i - 2) * 0.03, -0.02, -0.06);
      rig.hair.push(chain(hb, 3, 0.07, function (j) { mesh(G.box(0.03, 0.075, 0.018), mat(t.hair, { rough: 0.6 }), j, 0, -0.035, 0, false); }));
    }
    var cr = crown(rig.head, c, 0.07, 0.07);
    cr.position.y = 0.075;
    mesh(G.torus(0.075, 0.01, 20), gold(t), rig.body, 0, rig.shoulderY + 0.02, 0, false).rotation.x = Math.PI / 2;
    var w = rig.weapon = group(rig.handR, 0, -0.012, 0.02);
    mesh(G.cyl(0.011, 0.011, 0.45, 8), gold(t), w, 0, 0.13, 0);
    rig.orb = mesh(G.sph(0.036, 14), mat(t.gem, { emissive: t.gem, rough: 0.2 }), w, 0, 0.37, 0, false);
    for (var k = 0; k < 4; k++) { var a = k / 4 * Math.PI * 2; mesh(G.cone(0.01, 0.05, 4), gold(t), w, Math.cos(a) * 0.035, 0.35, Math.sin(a) * 0.035, false); }
    rig.restArm = { L: [0.05, 0, -0.1], R: [-0.35, 0, 0.1] };
    rig.restFore = { L: -0.5, R: -0.6 };
    rig.attack = 'magic';
    return rig;
  }
  function makeKing(c) {
    var t = TEAM[c];
    var rig = humanoid(c, { leg: 0.36, legW: 0.052, torsoW: 0.28, torsoH: 0.33, headR: 0.082, armW: 0.054, arm: 0.31, plate: true, cape: 'ermine' });
    mesh(G.cone(0.062, 0.13, 8), mat(t.hair, { rough: 0.8 }), rig.head, 0, -0.08, 0.05, false).rotation.x = Math.PI;
    mesh(G.sph(0.084, 16), mat(t.hair, { rough: 0.7 }), rig.head, 0, 0.025, -0.012).scale.set(1.02, 0.9, 1.03);
    var cr = crown(rig.head, c, 0.082, 0.09);
    cr.position.y = 0.075;
    rig.weapon = longsword(rig.handR, c, 0.5);
    rig.restArm = { L: [0.1, 0, -0.12], R: [-0.25, 0, 0.12] };
    rig.restFore = { L: -0.4, R: -0.4 };
    rig.weaponRest = 0.4;
    rig.attack = 'slash';
    return rig;
  }

  // ---------- Hiệp sĩ cưỡi ngựa ----------
  function makeKnight(c) {
    var t = TEAM[c], rig = {};
    var root = rig.root = new T3.Group();
    var hide = mat(t.horse, { rough: 0.55 }), mane = mat(t.mane, { rough: 0.7, side: T3.DoubleSide }), hoof = mat(0x1d1a18, { rough: 0.5 });
    var horse = rig.horse = group(root, 0, 0, 0);
    // khớp chồm ở hông sau: xoay khớp này để ngựa đứng lên hai chân sau
    var rear = rig.horseBody = group(horse, 0, 0.46, -0.17);
    rig.horseBaseY = 0.46;
    var torso = group(rear, 0, 0, 0.17);
    var barrel = mesh(G.sph(0.16, 18), hide, torso, 0, 0, 0);
    barrel.scale.set(0.95, 1, 1.75);
    mesh(G.sph(0.15, 16), hide, torso, 0, 0.01, 0.2).scale.set(1, 1.02, 1.05);   // ngực
    mesh(G.sph(0.155, 16), hide, torso, 0, 0.02, -0.2).scale.set(1.05, 1, 1.1);   // mông
    // áo phủ ngựa có huy hiệu
    var cap = mesh(G.cyl(0.175, 0.2, 0.2, 22, 1), mat(0xffffff, { map: crestTex(c, 'fleur'), rough: 0.8, side: T3.DoubleSide }), torso, 0, -0.1, -0.05);
    cap.scale.z = 1.7;
    var hem = mesh(G.torus(0.2, 0.01, 28), gold(t), torso, 0, -0.2, -0.05, false);
    hem.rotation.x = Math.PI / 2; hem.scale.set(1, 1.7, 1);
    // giáp ngực ngựa bằng kim loại chạm trổ
    var peytral = mesh(G.sph(0.16, 18, 10), steel(t), torso, 0, -0.02, 0.24);
    peytral.scale.set(1.05, 0.75, 0.55);
    mesh(G.torus(0.12, 0.012, 20), gold(t), torso, 0, -0.02, 0.32, false).scale.set(1, 0.7, 1);
    // yên và bàn đạp
    mesh(G.box(0.2, 0.05, 0.24), mat(0x4a2b16, { rough: 0.55 }), torso, 0, 0.16, -0.02);
    mesh(G.box(0.22, 0.04, 0.06), mat(0x4a2b16, { rough: 0.55 }), torso, 0, 0.2, -0.13, false);
    // cổ cong, đầu có giáp mặt và dây cương
    var neck = rig.horseNeck = group(torso, 0, 0.08, 0.25);
    var nk = mesh(G.cyl(0.07, 0.11, 0.34, 14), hide, neck, 0, 0.14, 0.06);
    nk.rotation.x = 0.55;
    var crinet = mesh(G.cyl(0.072, 0.1, 0.28, 14, 1), steel(t), neck, 0, 0.16, 0.04);
    crinet.rotation.x = 0.55; crinet.scale.set(1.05, 1, 0.6); crinet.position.z = 0.02;
    var head = rig.horseHead = group(neck, 0, 0.3, 0.17);
    var skull = mesh(G.cyl(0.06, 0.04, 0.27, 12), hide, head, 0, 0, 0.09);
    skull.rotation.x = Math.PI / 2 + 0.45;
    mesh(G.sph(0.05, 12), hide, head, 0, -0.06, 0.19);
    var chanfron = mesh(G.cyl(0.062, 0.045, 0.24, 12, 1), steel(t), head, 0, 0.022, 0.09);
    chanfron.rotation.x = Math.PI / 2 + 0.45; chanfron.scale.set(1.05, 1, 0.75);
    mesh(G.cone(0.012, 0.09, 5), gold(t), head, 0, 0.08, 0.04, false).rotation.x = 0.4; // sừng giáp trán
    mesh(G.cone(0.018, 0.06, 5), hide, head, -0.035, 0.07, -0.03, false);
    mesh(G.cone(0.018, 0.06, 5), hide, head, 0.035, 0.07, -0.03, false);
    mesh(G.sph(0.012, 8), mat(0x0b0b0b, { rough: 0.2 }), head, -0.055, 0.02, 0.05, false);
    mesh(G.sph(0.012, 8), mat(0x0b0b0b, { rough: 0.2 }), head, 0.055, 0.02, 0.05, false);
    var bridle = mesh(G.torus(0.055, 0.006, 18), mat(0x2a180c, { rough: 0.5 }), head, 0, -0.03, 0.12, false);
    bridle.rotation.y = Math.PI / 2; bridle.rotation.z = 0.5;
    // bờm: nhiều lọn dọc theo cổ, bay theo gió
    rig.mane = [];
    for (var i = 0; i < 10; i++) {
      var mb = group(neck, 0, 0.03 + i * 0.045, 0.0 - i * 0.012 + 0.11 * (i / 6));
      mb.position.set(0, 0.02 + i * 0.028, -0.03 + i * 0.016);
      rig.mane.push(chain(mb, 3, 0.06, function (j, q) {
        var st = mesh(G.cone(0.016 - q * 0.004, 0.075, 5), mane, j, (i % 2 ? 1 : -1) * 0.01, -0.035, 0, false);
        st.rotation.x = Math.PI;
      }));
      rig.mane[i].forEach(function (j, q) { if (q) j.position.y = -0.06; });
      rig.mane[i][0].rotation.set(-1.0, 0, (i % 2 ? 1 : -1) * 0.5);
    }
    // đuôi dài nhiều sợi
    var tailBase = rig.horseTail = group(torso, 0, 0.08, -0.33);
    rig.tail = [];
    for (var k = 0; k < 3; k++) {
      var tb = group(tailBase, (k - 1) * 0.02, 0, 0);
      tb.rotation.x = -0.5;
      rig.tail.push(chain(tb, 5, 0.075, function (j, q) {
        mesh(G.box(0.03 - q * 0.004, 0.08, 0.02), mane, j, 0, -0.04, 0, false);
      }));
      rig.tail[k].forEach(function (j, q) { if (q) j.position.y = -0.075; });
    }
    // chân: đùi → gối → cổ chân → móng, có lông chùm trên móng
    rig.hLegs = []; rig.hKnees = [];
    [[-0.08, 0.2, 1], [0.08, 0.2, 1], [-0.085, -0.2, 0], [0.085, -0.2, 0]].forEach(function (p) {
      var parent = p[2] ? torso : horse;
      var lg = group(parent, p[0], p[2] ? -0.06 : 0.42, p[2] ? p[1] : p[1] - 0.0);
      mesh(G.cyl(0.045, 0.032, 0.2, 10), hide, lg, 0, -0.1, 0);
      var kn = group(lg, 0, -0.2, 0);
      mesh(G.cyl(0.026, 0.022, 0.19, 10), hide, kn, 0, -0.095, 0);
      mesh(G.cyl(0.036, 0.03, 0.05, 10), mane, kn, 0, -0.17, 0, false);
      mesh(G.cyl(0.03, 0.034, 0.04, 10), hoof, kn, 0, -0.205, 0);
      rig.hLegs.push(lg); rig.hKnees.push(kn);
    });

    // kỵ sĩ giáp toàn thân
    var rider = humanoid(c, { leg: 0.22, legW: 0.04, torsoW: 0.21, torsoH: 0.25, headR: 0.068, armW: 0.042, arm: 0.25, plate: true, cape: t.cloth, face: false });
    torso.add(rider.root);
    rider.root.position.set(0, 0.0, -0.03);
    rider.body.position.y = 0.2;
    rider.legL.rotation.set(-1.15, 0, -0.42); rider.kneeL.rotation.x = 1.1;
    rider.legR.rotation.set(-1.15, 0, 0.42); rider.kneeR.rotation.x = 1.1;
    helmet(rider, c, 0.068, 'armet');
    plume(rider, c, 0.068, 5);
    rider.weapon = longsword(rider.handR, c, 0.44);
    kiteShield(rider.handL, c, 0.12);
    Object.keys(rider).forEach(function (k2) { if (!(k2 in rig)) rig[k2] = rider[k2]; });
    rig.rider = rider.root;
    rig.body = rider.body;
    rig.baseY = 0.2;
    // tư thế như tranh: giơ kiếm chếch về trước, áo choàng tung ra sau
    rig.restArm = { L: [-0.5, 0, -0.15], R: [-1.6, 0, 0.35] };
    rig.restFore = { L: -0.6, R: -0.5 };
    rig.weaponRest = 0.6;
    rig.attack = 'rear';
    return rig;
  }

  var MAKERS = { P: makePawn, N: makeKnight, B: makeBishop, R: makeRook, Q: makeQueen, K: makeKing };
  var SCALE = { P: 1.25, N: 1.3, B: 1.36, R: 1.4, Q: 1.42, K: 1.48 };

  function create(kind, color) {
    var rig = MAKERS[kind](color);
    rig.kind = kind;
    rig.color = color;
    rig.root.scale.setScalar(SCALE[kind]);
    rig.weaponRest = rig.weaponRest || 0;
    rig.restFore = rig.restFore || { L: -0.3, R: -0.3 };
    rig.phase = Math.random() * 10;
    rig.speed = 0;
    rest(rig);
    rig.root.traverse(function (o) { if (o.isMesh) o.userData.rig = rig; });
    return rig;
  }

  // Tư thế nghỉ
  function rest(rig) {
    var a = rig.restArm;
    rig.armL.rotation.set(a.L[0], a.L[1], a.L[2]);
    rig.armR.rotation.set(a.R[0], a.R[1], a.R[2]);
    rig.foreL.rotation.set(rig.restFore.L, 0, 0);
    rig.foreR.rotation.set(rig.restFore.R, 0, 0);
    if (rig.kind !== 'N') {
      rig.legL.rotation.set(0, 0, 0); rig.legR.rotation.set(0, 0, 0);
      rig.kneeL.rotation.set(0, 0, 0); rig.kneeR.rotation.set(0, 0, 0);
    }
    rig.body.position.set(0, rig.baseY, 0);
    rig.body.rotation.set(0, 0, 0);
    rig.head.rotation.set(0, 0, 0);
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
        var back = -(0.01 + fl * Math.pow(v, 1.4)) - lift * 0.32 * Math.pow(v, 1.2);
        var wave = Math.sin(f - v * 4.5 + x0 * 7) * (0.008 + lift * 0.045) * v;
        pos.setXYZ(i, x0 * (1 + v * 0.22), y0 * (1 - lift * 0.22 * v), back + wave);
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
    if (rig.hair) rig.hair.forEach(function (s, n) {
      for (i = 0; i < s.length; i++) s[i].rotation.x = 0.15 + Math.sin(t * 2 - i - n * 0.4 + rig.phase) * (0.04 + sp * 0.2);
    });
  }

  // Dáng thở / nhìn quanh khi đứng yên
  function idle(rig, t) {
    var p = t * 1.8 + rig.phase;
    rig.speed += (0 - rig.speed) * 0.05;
    rig.body.position.y = rig.baseY + Math.sin(p) * 0.005;
    rig.armL.rotation.x = rig.restArm.L[0] + Math.sin(p) * 0.03;
    rig.armR.rotation.x = rig.restArm.R[0] - Math.sin(p) * 0.03;
    rig.head.rotation.y = Math.sin(t * 0.37 + rig.phase) * 0.22;
    if (rig.horseNeck) rig.horseNeck.rotation.x = Math.sin(p * 0.6) * 0.06;
    if (rig.hKnees) rig.hKnees[1].rotation.x = Math.max(0, Math.sin(t * 0.5 + rig.phase) - 0.92) * 8; // ngựa thỉnh thoảng gõ móng
    if (rig.horseTail) rig.horseTail.rotation.z = Math.sin(p * 1.1) * 0.25;
    if (rig.orb) rig.orb.scale.setScalar(1 + Math.sin(t * 4 + rig.phase) * 0.12);
    cloth(rig, t);
  }

  // Bước đi: ph là pha chu kỳ bước, amt 0..1 độ mạnh của bước, t thời gian (cho vải bay)
  function walk(rig, ph, amt, t) {
    amt = amt === undefined ? 1 : amt;
    rig.speed = amt;
    var s = Math.sin(ph), c = Math.cos(ph);
    if (rig.kind === 'N') {
      // phi nước kiệu: hai cặp chân chéo nhau, gối gập khi nhấc chân
      var L = rig.hLegs, K = rig.hKnees;
      [[0, 3, 1], [1, 2, -1]].forEach(function (pr) {
        var v = s * pr[2];
        L[pr[0]].rotation.x = v * 0.6 * amt; L[pr[1]].rotation.x = v * 0.6 * amt;
        K[pr[0]].rotation.x = Math.max(0, -v) * 1.1 * amt; K[pr[1]].rotation.x = -Math.max(0, -v) * 0.6 * amt;
      });
      rig.horseBody.position.y = rig.horseBaseY + Math.abs(c) * 0.03 * amt;
      rig.horseBody.rotation.x = s * 0.03 * amt;
      rig.horseNeck.rotation.x = c * 0.1 * amt;
      rig.body.position.y = rig.baseY + Math.abs(s) * 0.015 * amt;
    } else {
      rig.legL.rotation.x = s * 0.55 * amt;
      rig.legR.rotation.x = -s * 0.55 * amt;
      rig.kneeL.rotation.x = Math.max(0, -s) * 0.8 * amt;
      rig.kneeR.rotation.x = Math.max(0, s) * 0.8 * amt;
      rig.armL.rotation.x = rig.restArm.L[0] - s * 0.3 * amt;
      rig.armR.rotation.x = rig.restArm.R[0] + s * 0.2 * amt;
      rig.body.position.y = rig.baseY + Math.abs(c) * 0.022 * amt;
      rig.body.rotation.z = s * 0.025 * amt;
      if (rig.robe) rig.robe.rotation.z = s * 0.03 * amt;
    }
    cloth(rig, t || ph * 0.4);
  }

  window.Characters = { create: create, rest: rest, idle: idle, walk: walk, cloth: cloth, TEAM: TEAM, mat: mat, G: G, mesh: mesh, group: group };
})();
