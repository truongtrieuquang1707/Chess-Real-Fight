// Luật cờ vua + engine dự phòng. Gói trong một hàm để có thể nhúng nguyên văn vào Web Worker.
function ChessCore() {
  'use strict';
  var P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  var START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  var LET = ' PNBRQK', FENCH = ' PNBRQK  pnbrqk';
  var VAL = [0, 100, 320, 330, 500, 900, 0];

  // Ô 0 = a8, ô 63 = h1 (cùng thứ tự với FEN)
  var DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]];
  var KNIGHT = [], KING = [], RAYS = [], CMASK = [];
  (function () {
    var kn = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
    for (var sq = 0; sq < 64; sq++) {
      var r = sq >> 3, f = sq & 7;
      KNIGHT[sq] = []; KING[sq] = []; RAYS[sq] = []; CMASK[sq] = 15;
      kn.forEach(function (d) {
        var rr = r + d[0], ff = f + d[1];
        if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) KNIGHT[sq].push(rr * 8 + ff);
      });
      DIRS.forEach(function (d) {
        var ray = [], rr = r + d[0], ff = f + d[1];
        if (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) KING[sq].push(rr * 8 + ff);
        while (rr >= 0 && rr < 8 && ff >= 0 && ff < 8) { ray.push(rr * 8 + ff); rr += d[0]; ff += d[1]; }
        RAYS[sq].push(ray);
      });
    }
    CMASK[60] = 12; CMASK[63] = 14; CMASK[56] = 13;
    CMASK[4] = 3; CMASK[7] = 11; CMASK[0] = 7;
  })();

  function sqName(sq) { return 'abcdefgh'[sq & 7] + (8 - (sq >> 3)); }
  function sqFromName(s) { return (8 - +s[1]) * 8 + (s.charCodeAt(0) - 97); }
  function mk(from, to, promo, flag) { return from | to << 6 | promo << 12 | flag << 15; }
  function mFrom(m) { return m & 63; }
  function mTo(m) { return (m >> 6) & 63; }
  function mPromo(m) { return (m >> 12) & 7; }
  function mFlag(m) { return m >> 15; } // 1 = bắt tốt qua đường, 2 = nhập thành, 3 = tốt đi 2 ô
  function uci(m) { return sqName(m & 63) + sqName((m >> 6) & 63) + (mPromo(m) ? ' pnbrq'[mPromo(m)] : ''); }

  function Game(fen) { this.load(fen || START); }

  Game.prototype.load = function (fen) {
    var t = fen.trim().split(/\s+/), b = this.b = new Array(64).fill(0), sq = 0;
    this.king = [-1, -1];
    for (var i = 0; i < t[0].length; i++) {
      var c = t[0][i];
      if (c === '/') continue;
      if (c >= '1' && c <= '8') { sq += +c; continue; }
      var p = FENCH.indexOf(c);
      b[sq] = p;
      if ((p & 7) === K) this.king[p >> 3] = sq;
      sq++;
    }
    this.turn = t[1] === 'b' ? 1 : 0;
    var cs = t[2] || '-';
    this.castling = (cs.indexOf('K') >= 0 ? 1 : 0) | (cs.indexOf('Q') >= 0 ? 2 : 0) |
      (cs.indexOf('k') >= 0 ? 4 : 0) | (cs.indexOf('q') >= 0 ? 8 : 0);
    this.ep = t[3] && t[3] !== '-' ? sqFromName(t[3]) : -1;
    this.half = +t[4] || 0;
    this.full = +t[5] || 1;
    this.stack = [];
  };

  Game.prototype.key = function () {
    var s = '', b = this.b;
    for (var r = 0; r < 8; r++) {
      var e = 0;
      for (var f = 0; f < 8; f++) {
        var p = b[r * 8 + f];
        if (!p) { e++; continue; }
        if (e) { s += e; e = 0; }
        s += FENCH[p];
      }
      if (e) s += e;
      if (r < 7) s += '/';
    }
    var c = this.castling;
    return s + (this.turn ? ' b ' : ' w ') +
      (c ? (c & 1 ? 'K' : '') + (c & 2 ? 'Q' : '') + (c & 4 ? 'k' : '') + (c & 8 ? 'q' : '') : '-') +
      ' ' + (this.ep >= 0 ? sqName(this.ep) : '-');
  };

  Game.prototype.fen = function () { return this.key() + ' ' + this.half + ' ' + this.full; };

  // Ô sq có bị bên `by` tấn công không
  Game.prototype.attacked = function (sq, by) {
    var b = this.b, r = sq >> 3, f = sq & 7, c8 = by << 3, i, t, p;
    var pr = by === 0 ? r + 1 : r - 1;
    if (pr >= 0 && pr < 8) {
      if (f > 0 && b[pr * 8 + f - 1] === (P | c8)) return true;
      if (f < 7 && b[pr * 8 + f + 1] === (P | c8)) return true;
    }
    t = KNIGHT[sq];
    for (i = 0; i < t.length; i++) if (b[t[i]] === (N | c8)) return true;
    t = KING[sq];
    for (i = 0; i < t.length; i++) if (b[t[i]] === (K | c8)) return true;
    for (var d = 0; d < 8; d++) {
      t = RAYS[sq][d];
      for (i = 0; i < t.length; i++) {
        p = b[t[i]];
        if (!p) continue;
        if ((p >> 3) === by) {
          var ty = p & 7;
          if (ty === Q || (d < 4 ? ty === B : ty === R)) return true;
        }
        break;
      }
    }
    return false;
  };

  // Danh sách ô có quân của bên `by` đang tấn công ô sq
  Game.prototype.attackers = function (sq, by) {
    var b = this.b, r = sq >> 3, f = sq & 7, c8 = by << 3, i, t, p, out = [];
    var pr = by === 0 ? r + 1 : r - 1;
    if (pr >= 0 && pr < 8) {
      if (f > 0 && b[pr * 8 + f - 1] === (P | c8)) out.push(pr * 8 + f - 1);
      if (f < 7 && b[pr * 8 + f + 1] === (P | c8)) out.push(pr * 8 + f + 1);
    }
    t = KNIGHT[sq];
    for (i = 0; i < t.length; i++) if (b[t[i]] === (N | c8)) out.push(t[i]);
    t = KING[sq];
    for (i = 0; i < t.length; i++) if (b[t[i]] === (K | c8)) out.push(t[i]);
    for (var d = 0; d < 8; d++) {
      t = RAYS[sq][d];
      for (i = 0; i < t.length; i++) {
        p = b[t[i]];
        if (!p) continue;
        if ((p >> 3) === by) {
          var ty = p & 7;
          if (ty === Q || (d < 4 ? ty === B : ty === R)) out.push(t[i]);
        }
        break;
      }
    }
    return out;
  };

  Game.prototype.inCheck = function (color) {
    if (color === undefined) color = this.turn;
    return this.attacked(this.king[color], color ^ 1);
  };

  // Sinh nước giả hợp lệ (chưa kiểm tra vua bị chiếu sau khi đi)
  Game.prototype.gen = function (capsOnly) {
    var b = this.b, us = this.turn, them = us ^ 1, moves = [], i, t, q, d;
    for (var sq = 0; sq < 64; sq++) {
      var p = b[sq];
      if (!p || (p >> 3) !== us) continue;
      var ty = p & 7;
      if (ty === P) {
        var dir = us === 0 ? -8 : 8, r = sq >> 3, f = sq & 7;
        var promo = r === (us === 0 ? 1 : 6), one = sq + dir;
        if (!b[one] && (!capsOnly || promo)) {
          if (promo) moves.push(mk(sq, one, Q, 0), mk(sq, one, N, 0), mk(sq, one, R, 0), mk(sq, one, B, 0));
          else {
            moves.push(mk(sq, one, 0, 0));
            if (r === (us === 0 ? 6 : 1) && !b[one + dir]) moves.push(mk(sq, one + dir, 0, 3));
          }
        }
        for (d = -1; d <= 1; d += 2) {
          if (f + d < 0 || f + d > 7) continue;
          t = one + d; q = b[t];
          if (q && (q >> 3) === them) {
            if (promo) moves.push(mk(sq, t, Q, 0), mk(sq, t, N, 0), mk(sq, t, R, 0), mk(sq, t, B, 0));
            else moves.push(mk(sq, t, 0, 0));
          } else if (t === this.ep && !q) moves.push(mk(sq, t, 0, 1));
        }
      } else if (ty === N || ty === K) {
        var tb = ty === N ? KNIGHT[sq] : KING[sq];
        for (i = 0; i < tb.length; i++) {
          t = tb[i]; q = b[t];
          if (!q) { if (!capsOnly) moves.push(mk(sq, t, 0, 0)); }
          else if ((q >> 3) === them) moves.push(mk(sq, t, 0, 0));
        }
      } else {
        var d0 = ty === R ? 4 : 0, d1 = ty === B ? 4 : 8;
        for (d = d0; d < d1; d++) {
          var ray = RAYS[sq][d];
          for (i = 0; i < ray.length; i++) {
            t = ray[i]; q = b[t];
            if (!q) { if (!capsOnly) moves.push(mk(sq, t, 0, 0)); continue; }
            if ((q >> 3) === them) moves.push(mk(sq, t, 0, 0));
            break;
          }
        }
      }
    }
    if (!capsOnly) {
      var c = this.castling;
      if (us === 0 && b[60] === K && (c & 3)) {
        if ((c & 1) && !b[61] && !b[62] && b[63] === R &&
          !this.attacked(60, 1) && !this.attacked(61, 1) && !this.attacked(62, 1)) moves.push(mk(60, 62, 0, 2));
        if ((c & 2) && !b[59] && !b[58] && !b[57] && b[56] === R &&
          !this.attacked(60, 1) && !this.attacked(59, 1) && !this.attacked(58, 1)) moves.push(mk(60, 58, 0, 2));
      } else if (us === 1 && b[4] === (K | 8) && (c & 12)) {
        if ((c & 4) && !b[5] && !b[6] && b[7] === (R | 8) &&
          !this.attacked(4, 0) && !this.attacked(5, 0) && !this.attacked(6, 0)) moves.push(mk(4, 6, 0, 2));
        if ((c & 8) && !b[3] && !b[2] && !b[1] && b[0] === (R | 8) &&
          !this.attacked(4, 0) && !this.attacked(3, 0) && !this.attacked(2, 0)) moves.push(mk(4, 2, 0, 2));
      }
    }
    return moves;
  };

  Game.prototype.make = function (m) {
    var b = this.b, from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7, flag = m >> 15;
    var p = b[from], us = this.turn, cap = b[to];
    b[to] = promo ? (promo | us << 3) : p;
    b[from] = 0;
    if (flag === 1) { var cs = to + (us === 0 ? 8 : -8); cap = b[cs]; b[cs] = 0; }
    else if (flag === 2) {
      if (to === 62) { b[61] = b[63]; b[63] = 0; }
      else if (to === 58) { b[59] = b[56]; b[56] = 0; }
      else if (to === 6) { b[5] = b[7]; b[7] = 0; }
      else { b[3] = b[0]; b[0] = 0; }
    }
    this.stack.push({ m: m, p: p, cap: cap, castling: this.castling, ep: this.ep, half: this.half });
    this.ep = flag === 3 ? (from + to) >> 1 : -1;
    this.castling &= CMASK[from] & CMASK[to];
    this.half = ((p & 7) === P || cap) ? 0 : this.half + 1;
    if (us === 1) this.full++;
    if ((p & 7) === K) this.king[us] = to;
    this.turn = us ^ 1;
  };

  Game.prototype.unmake = function () {
    var s = this.stack.pop(), m = s.m, b = this.b;
    var from = m & 63, to = (m >> 6) & 63, flag = m >> 15, us = this.turn ^ 1;
    this.turn = us;
    b[from] = s.p;
    if (flag === 1) { b[to] = 0; b[to + (us === 0 ? 8 : -8)] = s.cap; }
    else {
      b[to] = s.cap;
      if (flag === 2) {
        if (to === 62) { b[63] = b[61]; b[61] = 0; }
        else if (to === 58) { b[56] = b[59]; b[59] = 0; }
        else if (to === 6) { b[7] = b[5]; b[5] = 0; }
        else { b[0] = b[3]; b[3] = 0; }
      }
    }
    this.castling = s.castling; this.ep = s.ep; this.half = s.half;
    if (us === 1) this.full--;
    if ((s.p & 7) === K) this.king[us] = from;
  };

  Game.prototype.legal = function () {
    var ms = this.gen(false), out = [], us = this.turn;
    for (var i = 0; i < ms.length; i++) {
      this.make(ms[i]);
      if (!this.attacked(this.king[us], us ^ 1)) out.push(ms[i]);
      this.unmake();
    }
    return out;
  };

  Game.prototype.fromUci = function (s) {
    var ms = this.legal();
    for (var i = 0; i < ms.length; i++) if (uci(ms[i]) === s) return ms[i];
    return 0;
  };

  // Gọi TRƯỚC khi make(m)
  Game.prototype.san = function (m) {
    var b = this.b, from = m & 63, to = (m >> 6) & 63, promo = (m >> 12) & 7, flag = m >> 15;
    var ty = b[from] & 7, cap = b[to] || flag === 1, s;
    if (flag === 2) s = (to & 7) === 6 ? 'O-O' : 'O-O-O';
    else if (ty === P) {
      s = (cap ? 'abcdefgh'[from & 7] + 'x' : '') + sqName(to) + (promo ? '=' + LET[promo] : '');
    } else {
      s = LET[ty];
      var others = this.legal().filter(function (o) {
        return ((o >> 6) & 63) === to && (o & 63) !== from && (b[o & 63] & 7) === ty;
      });
      if (others.length) {
        var sameFile = others.some(function (o) { return (o & 7) === (from & 7); });
        var sameRank = others.some(function (o) { return ((o & 63) >> 3) === (from >> 3); });
        if (!sameFile) s += 'abcdefgh'[from & 7];
        else if (!sameRank) s += (8 - (from >> 3));
        else s += sqName(from);
      }
      s += (cap ? 'x' : '') + sqName(to);
    }
    this.make(m);
    if (this.inCheck()) s += this.legal().length ? '+' : '#';
    this.unmake();
    return s;
  };

  Game.prototype.info = function (m) {
    var b = this.b, from = m & 63, to = (m >> 6) & 63, flag = m >> 15;
    return {
      m: m, from: from, to: to, piece: b[from], color: this.turn, promo: (m >> 12) & 7, flag: flag,
      captured: flag === 1 ? (P | (this.turn ^ 1) << 3) : b[to], uci: uci(m), san: this.san(m)
    };
  };

  Game.prototype.insufficient = function () {
    var minors = 0, bishopColors = 0, others = 0;
    for (var sq = 0; sq < 64; sq++) {
      var ty = this.b[sq] & 7;
      if (!ty || ty === K) continue;
      if (ty === N) minors++;
      else if (ty === B) { minors++; bishopColors |= ((sq >> 3) + (sq & 7)) & 1 ? 1 : 2; }
      else others++;
    }
    if (others) return false;
    if (minors <= 1) return true;
    // chỉ còn các Tượng cùng màu ô
    var knights = 0;
    for (sq = 0; sq < 64; sq++) if ((this.b[sq] & 7) === N) knights++;
    return knights === 0 && bishopColors !== 3;
  };

  // ---------- Engine dự phòng: alpha-beta + quiescence ----------
  var PST = [null,
    [0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30, 20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5,
      0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10, 0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0],
    [-50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30, 0, 10, 15, 15, 10, 0, -30,
      -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20, 20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30,
      -40, -20, 0, 5, 5, 0, -20, -40, -50, -40, -30, -30, -30, -30, -40, -50],
    [-20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 10, 10, 5, 0, -10,
      -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10, 0, -10, -10, 10, 10, 10, 10, 10, 10, -10,
      -10, 5, 0, 0, 0, 0, 5, -10, -20, -10, -10, -10, -10, -10, -10, -20],
    [0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5,
      -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0],
    [-20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5, 5, 5, 5, 0, -10,
      -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5, 5, 5, 5, 5, 0, -10,
      -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10, -10, -20],
    [-30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40, -30,
      -30, -40, -40, -50, -50, -40, -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20, -20, -20, -10,
      20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20]];
  var KING_END = [-50, -40, -30, -20, -20, -30, -40, -50, -30, -20, -10, 0, 0, -10, -20, -30, -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 30, 40, 40, 30, -10, -30, -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -30, 0, 0, 0, 0, -30, -30, -50, -30, -30, -30, -30, -30, -30, -50];
  var MATE = 30000;

  function evaluate(g) {
    var b = g.b, score = 0, npm = 0, sq, p, ty;
    for (sq = 0; sq < 64; sq++) {
      p = b[sq];
      if (!p) continue;
      ty = p & 7;
      if (ty !== P && ty !== K) npm += VAL[ty];
    }
    var end = npm <= 2600;
    for (sq = 0; sq < 64; sq++) {
      p = b[sq];
      if (!p) continue;
      ty = p & 7;
      var white = p < 8, idx = white ? sq : sq ^ 56;
      var v = VAL[ty] + (ty === K && end ? KING_END[idx] : PST[ty][idx]);
      score += white ? v : -v;
    }
    return g.turn === 0 ? score : -score;
  }

  function search(g, opts, onInfo) {
    var start = Date.now(), limit = opts.movetime || 1e9, maxDepth = opts.depth || 64;
    var nodes = 0, stop = false, killers = [], prevPv = [], curDepth = 1;

    function ordered(moves, ply) {
      var b = g.b, hint = prevPv[ply], kill = killers[ply];
      var scored = moves.map(function (m) {
        var s = 0, victim = b[(m >> 6) & 63] & 7;
        if (m === hint) s = 1e6;
        else if (victim) s = 10000 + VAL[victim] * 10 - VAL[b[m & 63] & 7];
        else if ((m >> 12) & 7) s = 9000;
        else if (m === kill) s = 5000;
        return { m: m, s: s };
      });
      scored.sort(function (a, c) { return c.s - a.s; });
      return scored;
    }

    function qs(alpha, beta, ply) {
      nodes++;
      var stand = evaluate(g);
      if (stand >= beta) return beta;
      if (stand > alpha) alpha = stand;
      if (ply > 40) return alpha;
      var us = g.turn, moves = ordered(g.gen(true), -1);
      for (var i = 0; i < moves.length; i++) {
        g.make(moves[i].m);
        if (g.attacked(g.king[us], us ^ 1)) { g.unmake(); continue; }
        var score = -qs(-beta, -alpha, ply + 1);
        g.unmake();
        if (score >= beta) return beta;
        if (score > alpha) alpha = score;
      }
      return alpha;
    }

    function ab(depth, alpha, beta, ply, pv) {
      if (curDepth > 1 && (nodes & 1023) === 0 && Date.now() - start > limit) stop = true;
      if (stop) return 0;
      var us = g.turn, inCheck = g.inCheck();
      if (inCheck && ply < 40) depth++;
      if (depth <= 0) return qs(alpha, beta, ply);
      nodes++;
      if (ply > 0 && g.half >= 100) return 0;
      var moves = ordered(g.gen(false), ply), legal = 0, child = [];
      for (var i = 0; i < moves.length; i++) {
        var m = moves[i].m;
        g.make(m);
        if (g.attacked(g.king[us], us ^ 1)) { g.unmake(); continue; }
        legal++;
        child.length = 0;
        var score = -ab(depth - 1, -beta, -alpha, ply + 1, child);
        g.unmake();
        if (stop) return 0;
        if (score > alpha) {
          alpha = score;
          pv.length = 0; pv.push(m);
          for (var j = 0; j < child.length; j++) pv.push(child[j]);
          if (alpha >= beta) { if (!moves[i].s || moves[i].s === 5000) killers[ply] = m; break; }
        }
      }
      if (!legal) return inCheck ? -MATE + ply : 0;
      return alpha;
    }

    var best = { pv: [], score: 0, depth: 0 };
    for (curDepth = 1; curDepth <= maxDepth; curDepth++) {
      var pv = [], score = ab(curDepth, -MATE - 1, MATE + 1, 0, pv);
      if (stop) break;
      best = { pv: pv.slice(), score: score, depth: curDepth };
      prevPv = pv.slice();
      if (Math.abs(score) > MATE - 200) best.mate = (score > 0 ? 1 : -1) * Math.ceil((MATE - Math.abs(score)) / 2);
      if (onInfo) onInfo(best);
      if (best.mate !== undefined || !pv.length) break;
      if (Date.now() - start > limit * 0.6) break;
    }
    return best;
  }

  return {
    P: P, N: N, B: B, R: R, Q: Q, K: K, START: START, LET: LET, Game: Game,
    sqName: sqName, sqFromName: sqFromName, mFrom: mFrom, mTo: mTo, mPromo: mPromo, mFlag: mFlag,
    uci: uci, search: search, evaluate: evaluate
  };
}

// Web Worker nói giao thức UCI tối giản, dùng khi không tải được Stockfish
function BuiltinEngineWorker(Core) {
  var g = new Core.Game(), skill = 20, multipv = 1;
  self.onmessage = function (e) {
    var line = String(e.data), t = line.split(/\s+/);
    if (t[0] === 'uci') { postMessage('id name Mini'); postMessage('uciok'); }
    else if (t[0] === 'isready') postMessage('readyok');
    else if (t[0] === 'setoption') {
      if (line.indexOf('Skill Level') > 0) skill = +t[t.length - 1];
      else if (line.indexOf('MultiPV') > 0) multipv = +t[t.length - 1];
    }
    else if (t[0] === 'position') g.load(line.slice(line.indexOf('fen') + 4));
    else if (t[0] === 'go') {
      var opts = {}, i = t.indexOf('depth'), j = t.indexOf('movetime');
      if (i > 0) opts.depth = +t[i + 1];
      if (j > 0) opts.movetime = +t[j + 1];
      var all = g.legal();
      if (multipv > 1 && all.length > 1) {
        // chấm riêng từng nước ở gốc để có danh sách ứng viên kèm điểm
        var d = Math.max(1, Math.min(opts.depth || 4, 4) - 1), per = Math.max(15, (opts.movetime || 1000) / all.length);
        var cand = all.map(function (m) {
          g.make(m);
          var sc = -Core.search(g, { depth: d, movetime: per }).score;
          g.unmake();
          return { m: m, sc: sc };
        }).sort(function (a, c) { return c.sc - a.sc; });
        cand.slice(0, multipv).forEach(function (c, n) {
          postMessage('info depth ' + (d + 1) + ' multipv ' + (n + 1) + ' score cp ' + c.sc + ' pv ' + Core.uci(c.m));
        });
        postMessage('bestmove ' + Core.uci(cand[0].m));
        return;
      }
      var res = Core.search(g, opts, function (r) {
        postMessage('info depth ' + r.depth + ' score ' + (r.mate !== undefined ? 'mate ' + r.mate : 'cp ' + r.score) +
          ' pv ' + r.pv.map(Core.uci).join(' '));
      });
      var mv = res.pv[0], legal = g.legal();
      // mức thấp: thỉnh thoảng đi ngẫu nhiên
      if (legal.length && (!mv || (skill < 3 && Math.random() < 0.35))) mv = legal[Math.floor(Math.random() * legal.length)];
      postMessage('bestmove ' + (mv ? Core.uci(mv) : '(none)'));
    }
  };
}

if (typeof window !== 'undefined') window.Chess = ChessCore();
