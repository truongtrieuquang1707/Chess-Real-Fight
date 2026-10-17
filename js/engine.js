// Lớp bọc engine: ưu tiên Stockfish (tải từ CDN, chạy trong Web Worker), không được thì dùng engine dự phòng.
(function () {
  'use strict';
  var SF_BASE = 'https://cdnjs.cloudflare.com/ajax/libs/stockfish.js/10.0.2/';

  function boot(src, ms) {
    return new Promise(function (resolve, reject) {
      var w;
      try { w = new Worker(URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))); }
      catch (e) { reject(e); return; }
      var timer = setTimeout(function () { w.terminate(); reject(new Error('timeout')); }, ms);
      w.onerror = function (e) { e.preventDefault(); clearTimeout(timer); w.terminate(); reject(new Error('load failed')); };
      w.onmessage = function (e) {
        if (String(e.data).indexOf('uciok') === 0) { clearTimeout(timer); w.onerror = null; w.onmessage = null; resolve(w); }
      };
      w.postMessage('uci');
    });
  }

  function Engine() {
    this.kind = null; // 'stockfish' | 'builtin'
    this.worker = null;
    this.queue = Promise.resolve();
    this.token = 0;
    this.busy = false;
  }

  Engine.prototype.init = function () {
    var self = this;
    var builtin = function () {
      var src = 'var Core=(' + ChessCore.toString() + ')();(' + BuiltinEngineWorker.toString() + ')(Core);';
      return boot(src, 5000).then(function (w) { self.worker = w; self.kind = 'builtin'; });
    };
    if (!navigator.onLine) return builtin();
    var ready = function (w) {
      self.worker = w; self.kind = 'stockfish';
      w.postMessage('setoption name Hash value 32');
    };
    // Bản WebAssembly nhanh gấp nhiều lần; file .wasm nằm cạnh script nên phải chỉ lại đường dẫn cho fetch
    var wasm = 'var _f=self.fetch;self.fetch=function(u,o){if(typeof u==="string"&&u.indexOf("stockfish.wasm")>=0)u="' +
      SF_BASE + 'stockfish.wasm";return _f.call(self,u,o)};importScripts("' + SF_BASE + 'stockfish.wasm.js");';
    return boot(wasm, 12000).then(ready, function () {
      return boot('importScripts("' + SF_BASE + 'stockfish.js");', 15000).then(ready, builtin);
    });
  };

  // opts: {depth, movetime, skill, multipv}. Trả về {best, cp, mate, pv[], depth, lines[{move, cp, mate}]} theo góc nhìn của TRẮNG, hoặc null nếu bị hủy.
  Engine.prototype.analyze = function (fen, opts) {
    var self = this, token = this.token;
    var run = function () { return token === self.token ? self._go(fen, opts, token) : null; };
    return (this.queue = this.queue.then(run, run));
  };

  Engine.prototype._go = function (fen, opts, token) {
    var self = this, w = this.worker;
    return new Promise(function (resolve) {
      var sign = fen.split(' ')[1] === 'w' ? 1 : -1;
      var res = { best: null, cp: 0, mate: null, pv: [], depth: 0, lines: [] };
      w.onmessage = function (e) {
        var s = String(e.data);
        if (s.indexOf('info') === 0) {
          var pvAt = s.indexOf(' pv ');
          if (pvAt < 0 || s.indexOf('bound') > 0) return;
          var mp = / multipv (\d+)/.exec(s), sc = / score (cp|mate) (-?\d+)/.exec(s);
          if (!sc) return;
          var pv = s.slice(pvAt + 4).trim().split(/\s+/);
          res.lines[mp ? +mp[1] - 1 : 0] = { move: pv[0], cp: sc[1] === 'cp' ? sign * +sc[2] : null, mate: sc[1] === 'mate' ? sign * +sc[2] : null };
          if (mp && mp[1] !== '1') return;
          if (sc[1] === 'cp') { res.cp = sign * +sc[2]; res.mate = null; }
          else res.mate = sign * +sc[2];
          res.pv = pv;
          var d = / depth (\d+)/.exec(s);
          if (d) res.depth = +d[1];
        } else if (s.indexOf('bestmove') === 0) {
          w.onmessage = null;
          self.busy = false;
          res.best = s.split(/\s+/)[1];
          if (!res.pv.length) res.pv = [res.best];
          resolve(token === self.token ? res : null);
        }
      };
      self.busy = true;
      w.postMessage('setoption name Skill Level value ' + (opts.skill === undefined ? 20 : opts.skill));
      w.postMessage('setoption name MultiPV value ' + (opts.multipv || 1));
      w.postMessage('position fen ' + fen);
      w.postMessage('go' + (opts.depth ? ' depth ' + opts.depth : '') + (opts.movetime ? ' movetime ' + opts.movetime : ''));
    });
  };

  // Hủy mọi yêu cầu đang chờ/đang chạy
  Engine.prototype.cancel = function () {
    this.token++;
    if (this.busy && this.worker) this.worker.postMessage('stop');
  };

  window.Engine = Engine;
})();
