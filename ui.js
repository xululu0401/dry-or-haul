/* 别给水分付运费 · 界面（ui.js）：所有读数取自 core.js 同一次 compute 的 out */
'use strict';
(function () {
  var A = window.AppCore, KEY = 'dry-or-haul:v1';
  var $ = function (id) { return document.getElementById(id); };
  var FIELDS = A.FIELDS;
  var COL = { A: '#7b8a5a', B: '#3f6e8c', C: '#a4521f', M: '#2a2622' };
  var PRESETS = [
    { key: 'def', name: '一车鲜辣椒', note: '默认（虚构）：3 吨鲜辣椒，市场 200 公里外；晒干剩 18%，干辣椒蓬松，一车只装得下 450 公斤。' },
    { key: 'wood', name: '十斤柴一斤炭', note: '虚构示例：山里 20 吨柴，城里 120 公里；烧成炭剩 10%，烧炭的人工折进加工费。看市场多远以后烧了再挑才合算。', f: function (s) {
      s.name = '柴'; s.pv = '烧炭'; s.pn = '木炭'; s.qty = '20000'; s.p0 = '0.30'; s.dist = '120'; s.p1 = '0.60'; s.cap1 = '5000';
      s.fee = '200'; s.perkm = '5.00'; s.yld = '10'; s.proc = '0.15'; s.p2 = '5.00'; s.cap2 = '3000';
    } },
    { key: 'shoot', name: '近处卖鲜笋', note: '虚构示例：鲜笋 800 公斤，镇上 30 公里；做成笋干只剩 8%，加工费不低。市场近的时候，原样拉往往就够了。', f: function (s) {
      s.name = '鲜笋'; s.pv = '晒笋干'; s.pn = '笋干'; s.qty = '800'; s.p0 = '3.00'; s.dist = '30'; s.p1 = '5.00'; s.cap1 = '1000';
      s.fee = '80'; s.perkm = '3.00'; s.yld = '8'; s.proc = '1.20'; s.p2 = '70.00'; s.cap2 = '300';
    } }
  ];
  var state, out, tmr;
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function presetState(k) { var s = A.defaultState(), p = PRESETS.filter(function (q) { return q.key === k; })[0]; if (p && p.f) p.f(s); return s; }
  function sanitize(s) {
    if (!s || typeof s !== 'object') return null;
    var d = A.defaultState(), n = 0;
    FIELDS.forEach(function (k) { if (k in s && (typeof s[k] === 'string' || typeof s[k] === 'number')) { d[k] = String(s[k]).slice(0, A.TEXT[k] || 12); n++; } });
    return n ? d : null;
  }
  function norm(s) { return JSON.stringify(sanitize(s)); }
  function presetKey(s) { var j = norm(s); for (var i = 0; i < PRESETS.length; i++) if (norm(presetState(PRESETS[i].key)) === j) return PRESETS[i].key; return null; }
  function load() { try { var t = localStorage.getItem(KEY); if (!t) return null; var j = JSON.parse(t); return j && j.state ? sanitize(j.state) : null; } catch (e) { return null; } }
  function save() { try { localStorage.setItem(KEY, JSON.stringify({ v: 1, state: state })); $('saveTag').textContent = '· 已自动存在本机'; } catch (e) { $('saveTag').textContent = '· 这台设备存不了，刷新会丢'; } }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  state = load() || A.defaultState();

  function fill() { FIELDS.forEach(function (k) { $(k).value = state[k]; }); }
  FIELDS.forEach(function (k) { $(k).addEventListener('input', function () { state[k] = this.value; schedule(); }); });
  function schedule() { clearTimeout(tmr); tmr = setTimeout(update, 150); }
  $('presets').addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (!b) return; state = presetState(b.getAttribute('data-p')); fill(); update(); });
  $('acts').addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]'); if (!b || !out.ok) return;
    var a = out.actions.filter(function (x) { return x.id === b.getAttribute('data-act'); })[0]; if (!a) return;
    state = A.applyChange(state, a); fill(); update();
  });

  function markErrors() {
    document.querySelectorAll('.bad').forEach(function (e) { e.classList.remove('bad'); });
    if (!out.ok) out.errors.forEach(function (er) { var el = $(er.field); if (el) el.classList.add('bad'); });
  }
  function renderPresets() {
    var key = presetKey(state);
    $('presets').innerHTML = PRESETS.map(function (p) { return '<button type="button" class="chip" id="preset_' + p.key + '" data-p="' + p.key + '" aria-pressed="' + (key === p.key) + '">' + esc(p.name) + '</button>'; }).join('');
    var cur = PRESETS.filter(function (p) { return p.key === key; })[0];
    $('presetNote').textContent = cur ? cur.note : '你自己改过的数（默认那组是虚构示例）。';
  }
  function labels() {
    var P = A.parse(state).P;
    $('p2l').textContent = '市场上' + P.pn + '（元/公斤）';
    $('cap2l').textContent = P.pn + '每车最多装（公斤）';
  }
  function money(mf) { return A.yuan(mf) + ' 元'; }
  function routeCard(r) {
    var o = out, P = o.P, p = o.routes[r], win = o.kind === r;
    var rows = [['卖货收入', money(p.rev)]];
    if (r === 'C') rows.push(['加工费', '−' + money(p.procCost)]);
    if (r !== 'A') rows.push(['运费（' + p.trips + ' 趟）', '−' + money(p.freight)]);
    if (r === 'B') rows.push(['最后一车装了', A.kgStr(p.lastB) + ' / ' + A.kgStr(P.cap1) + ' 公斤']);
    if (r === 'C') rows.push(['拉去卖', A.gKg(p.outKg * 1000) + ' 公斤' + P.pn], ['最后一车装了', A.gKg(p.lastC) + ' / ' + A.kgStr(P.cap2) + ' 公斤']);
    return '<div class="route' + (win ? ' win' : '') + '" id="route' + r + '">' + (win ? '<span class="win-tag">最划算</span>' : '') +
      '<span class="tg" style="background:' + COL[r] + '">' + esc(A.routeName(P, r)) + '</span>' +
      '<div class="net' + (p.net < 0 ? ' neg' : '') + '">' + money(p.net) + '</div>' +
      '<table>' + rows.map(function (x) { return '<tr><td>' + esc(x[0]) + '</td><td class="v">' + esc(x[1]) + '</td></tr>'; }).join('') + '</table></div>';
  }
  function renderMix() {
    var o = out, P = o.P, b = o.best;
    if (o.kind !== 'mix') { $('mixBox').classList.add('hide'); return; }
    $('mixBox').classList.remove('hide');
    var seg = ['A', 'B', 'C'].filter(function (r) { return b.q[r]; }).map(function (r) { return '<i style="background:' + COL[r] + ';width:' + (b.q[r] * 100 / P.qty) + '%" title="' + esc(A.routeName(P, r)) + '"></i>'; }).join('');
    $('mixBox').innerHTML = '<b>拆开走：到手 ' + money(b.net) + '</b>，比最好的单走一条路多 ' + money(b.net - o.routes[o.pureBest].net) +
      '<div class="seg">' + seg + '</div><div class="legend">' +
      ['A', 'B', 'C'].filter(function (r) { return b.q[r]; }).map(function (r) {
        var t = r === 'A' ? '就地卖 ' + A.kgStr(b.q.A) + ' 公斤' : r === 'B' ? '原样拉 ' + A.kgStr(b.q.B) + ' 公斤（' + b.n.B + ' 车）' : P.pv + ' ' + A.kgStr(b.q.C) + ' 公斤 → ' + A.gKg(b.q.C * P.yld) + ' 公斤' + P.pn + '（' + b.n.C + ' 车）';
        return '<span style="--c:' + COL[r] + '">' + esc(t) + '</span>';
      }).join('') + '</div>' +
      '<div class="muted" style="margin-top:6px">运费 ' + money(b.freight) + (b.procCost ? '、加工费 ' + money(b.procCost) : '') + '，卖货收入 ' + money(b.rev) + '。</div>';
  }

  /* 折线图：按容器实际宽度画（批次 100 踩过：固定 720 宽在 375 上字太小） */
  function renderChart() {
    var o = out, P = o.P, c = o.chart, svg = $('chart');
    var W = Math.max(300, Math.round(svg.parentNode.clientWidth - 32)), narrow = W < 520, H = narrow ? 260 : 320;
    var padL = narrow ? 58 : 72, padR = 14, padT = 14, padB = 34, iw = W - padL - padR, ih = H - padT - padB;
    var vals = []; c.pts.forEach(function (p) { vals.push(p.A, p.B, p.C, p.M); });
    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    lo = Math.min(lo, 0); if (hi <= lo) hi = lo + 100000;
    /* 纵轴刻度：按目标 5 格选「好看」的间隔（单位元） */
    var spanY = (hi - lo) / 100000, raw = spanY / 5, mag = Math.pow(10, Math.floor(Math.log10(raw))), st = [1, 2, 2.5, 5, 10].map(function (k) { return k * mag; }).filter(function (k) { return k >= raw; })[0];
    var y0 = Math.floor(lo / 100000 / st) * st, y1 = Math.ceil(hi / 100000 / st) * st;
    function X(d) { return padL + iw * d / c.Dmax; }
    function Y(mf) { return padT + ih * (1 - (mf / 100000 - y0) / (y1 - y0)); }
    var g = [];
    for (var v = y0; v <= y1 + 1e-9; v += st) {
      var yy = Y(v * 100000).toFixed(1);
      g.push('<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy + '" y2="' + yy + '" stroke="' + (Math.abs(v) < 1e-9 ? '#b9b1a6' : '#eee8de') + '"/>');
      var lab = Math.abs(v) >= 10000 ? (v / 10000).toFixed(Math.abs(v) % 10000 ? 1 : 0) + '万' : String(Math.round(v));
      g.push('<text x="' + (padL - 6) + '" y="' + (+yy + 4) + '" text-anchor="end" font-size="12" fill="#8d857c">' + lab.replace('-', '−') + '</text>');
    }
    var xstep = c.step; if (narrow && c.Dmax / xstep > 6) xstep *= 2;
    for (var d = 0; d <= c.Dmax; d += xstep) g.push('<text x="' + X(d).toFixed(1) + '" y="' + (H - 12) + '" text-anchor="middle" font-size="12" fill="#8d857c">' + d + '</text>');
    g.push('<text x="' + (W - padR) + '" y="' + (H - 0) + '" text-anchor="end" font-size="11.5" fill="#8d857c">公里</text>');
    g.push('<text x="4" y="' + (padT + 2) + '" font-size="11.5" fill="#8d857c" dominant-baseline="hanging">元</text>');
    function line(k, w, dash) { return '<polyline fill="none" stroke="' + COL[k] + '" stroke-width="' + w + '"' + (dash ? ' stroke-dasharray="' + dash + '"' : '') + ' points="' + c.pts.map(function (p) { return X(p.d).toFixed(1) + ',' + Y(p[k]).toFixed(1); }).join(' ') + '"/>'; }
    g.push(line('A', 2), line('B', 2), line('C', 2), line('M', 2.5, '5 4'));
    var xd = X(Math.min(P.dist, c.Dmax)).toFixed(1);
    g.push('<line x1="' + xd + '" x2="' + xd + '" y1="' + padT + '" y2="' + (padT + ih) + '" stroke="#2a2622" stroke-width="1" stroke-dasharray="2 3"/>');
    var tx = +xd + 6, anchor = 'start'; if (tx > W - 90) { tx = +xd - 6; anchor = 'end'; }
    g.push('<text x="' + tx + '" y="' + (padT + 14) + '" text-anchor="' + anchor + '" font-size="12.5" font-weight="700" fill="#2a2622">你的 ' + P.dist + ' 公里</text>');
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H);
    svg.innerHTML = g.join('');
    $('legend').innerHTML = ['A', 'B', 'C', 'M'].map(function (k) { return '<span style="--c:' + COL[k] + '">' + esc(k === 'M' ? '拆开走最多（虚线）' : A.routeName(P, k)) + '</span>'; }).join('');
    var z = o.cross, notes = [];
    function zt(zz, yes) { if (zz.all) return '多远都是' + yes; if (zz.none || (zz.upTo != null && zz.upTo < 0)) return null; return zz.upTo != null ? zz.upTo + ' 公里以内' + yes : zz.from + ' 公里以外' + yes; }
    [zt(z.BoverA, '原样拉比就地卖多'), zt(z.CoverA, P.pv + '再拉比就地卖多'), zt(z.CoverB, P.pv + '再拉比原样拉多')].forEach(function (t) { if (t) notes.push(t); });
    $('chartNote').textContent = (notes.length ? notes.join('；') + '。' : '') + '折线按整车算，车数随货量跳，不随距离变；拆开走那条线每个距离都重新分了一遍。';
  }

  function gainText(a) {
    if (a.gain > 0) return '多 ' + A.yuan(a.gain) + ' 元';
    if (a.gain < 0) return '少 ' + A.yuan(-a.gain) + ' 元';
    return '到手持平' + (a.trips < a.tripsNow ? '，少跑 ' + (a.tripsNow - a.trips) + ' 趟' : a.trips > a.tripsNow ? '，多跑 ' + (a.trips - a.tripsNow) + ' 趟' : '') + '；再高一点就开始多挣';
  }
  function render() {
    var o = out;
    ['okBox', 'chartCard', 'actCard'].forEach(function (id) { $(id).classList.toggle('hide', !o.ok); });
    $('errBox').classList.toggle('hide', o.ok);
    if (!o.ok) { $('errBox').innerHTML = '先改好标红的地方：<ul>' + o.errors.map(function (e) { return '<li>' + esc(e.message) + '</li>'; }).join('') + '</ul>'; return; }
    $('headline').textContent = A.headline(o);
    $('why').textContent = A.explain(o);
    $('routes').innerHTML = ['A', 'B', 'C'].map(routeCard).join('');
    renderMix();
    renderChart();
    $('acts').innerHTML = o.actions.length ? o.actions.map(function (a) {
      return '<button type="button" class="act" id="act_' + a.id + '" data-act="' + a.id + '">→ ' + esc(a.text) + '<small>改完到手 ' + money(a.net) + '（' + gainText(a) + '）</small></button>';
    }).join('') : '<span class="muted">改单价、出成率或装车量都换不来更多，现在这样分就是最划算的。</span>';
  }
  function update() { clearTimeout(tmr); out = A.compute(state); labels(); markErrors(); renderPresets(); render(); save(); }
  var rz; window.addEventListener('resize', function () { clearTimeout(rz); rz = setTimeout(function () { if (out && out.ok) renderChart(); }, 120); });

  function stamp() { var d = new Date(), p = function (x) { return (x < 10 ? '0' : '') + x; }; return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + ' ' + p(d.getHours()) + ':' + p(d.getMinutes()); }
  function download(name, blob) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500); }
  function tag() { return out.ok ? (out.kind === 'mix' ? '拆开走' : A.routeName(out.P, out.kind)) : '待改'; }
  $('dlCsv').addEventListener('click', function () { if (out.ok) download('别给水分付运费-明细.csv', new Blob(['\ufeff' + A.toCSV(out, stamp())], { type: 'text/csv;charset=utf-8' })); });
  $('dlMd').addEventListener('click', function () { if (out.ok) download('别给水分付运费-' + tag() + '.md', new Blob([A.toMD(out, stamp())], { type: 'text/markdown;charset=utf-8' })); });
  $('dlJson').addEventListener('click', function () { download('别给水分付运费-备份.json', new Blob([JSON.stringify({ app: '别给水分付运费', slug: 'dry-or-haul', version: 1, exported_at: stamp(), state: state }, null, 2)], { type: 'application/json' })); });
  $('impJson').addEventListener('click', function () { $('impFile').click(); });
  $('impFile').addEventListener('change', function () { var f = this.files && this.files[0]; if (!f) return; var rd = new FileReader(); rd.onload = function () { importText(String(rd.result)); }; rd.readAsText(f); this.value = ''; });
  function importText(t) {
    var s = null;
    try { var j = JSON.parse(t); s = sanitize(j && j.state ? j.state : j); } catch (e) { s = null; }
    if (!s) { $('impMsg').textContent = '这个文件读不出来，没改动。'; return false; }
    $('impMsg').textContent = '已导入。'; state = s; fill(); update(); return true;
  }
  $('reset').addEventListener('click', function () { state = A.defaultState(); $('impMsg').textContent = ''; fill(); update(); });

  /* 结果卡 PNG 1080×1350：文字取自同一次 out */
  function drawCard() {
    var W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    var g = cv.getContext('2d'), FF = '-apple-system,"PingFang SC","Microsoft YaHei",sans-serif';
    g.fillStyle = '#f3f0ea'; g.fillRect(0, 0, W, H); g.fillStyle = '#ffffff'; g.fillRect(50, 50, W - 100, H - 100);
    var L = 100, Rr = W - 100, maxW = Rr - L, y = 150;
    function font(size, bold) { g.font = (bold ? '700 ' : '') + size + 'px ' + FF; }
    function clip(t, w) { t = String(t); if (g.measureText(t).width <= w) return t; while (t.length > 1 && g.measureText(t + '…').width > w) t = t.slice(0, -1); return t + '…'; }
    function wrap(t, size, color, bold, lim) {
      font(size, bold); g.fillStyle = color; var cur = '', n = 0;
      var toks = String(t).match(/[0-9.,−]+ ?(?:公斤|公里|元|车|趟|%)?[）)。，、；：—]*|[（(「]?[^\s（(「][）)」。，、；：—]*|\s/g) || [];
      for (var i = 0; i < toks.length; i++) { var ch = toks[i]; if (g.measureText(cur + ch).width > maxW && cur) { if (lim && ++n >= lim) { g.fillText(clip(cur + '…', maxW), L, y); y += size * 1.45; return; } g.fillText(cur, L, y); y += size * 1.45; cur = ch.trim() ? ch : ''; } else cur += ch; }
      if (cur) { g.fillText(cur, L, y); y += size * 1.45; }
    }
    font(54, true); g.fillStyle = '#2a2622'; g.fillText('别给水分付运费', L, y); y += 56;
    if (!out.ok) {
      font(42, true); g.fillStyle = '#b23b2e'; g.fillText('还算不了', L, y + 20); y += 90;
      out.errors.slice(0, 10).forEach(function (e) { wrap('· ' + e.message, 28, '#575049', false, 2); y += 6; }); y += 30; wrap('改好标红的地方，会自动重算。', 26, '#8d857c');
      return cv;
    }
    var o = out, P = o.P, b = o.best;
    font(26); g.fillStyle = '#8d857c'; g.fillText(clip(P.name + ' ' + A.kgStr(P.qty) + ' 公斤 · 市场 ' + P.dist + ' 公里 · ' + P.pv + '后剩 ' + A.pctStr(P.yld) + '%', maxW), L, y); y += 100;
    font(40, true); g.fillStyle = '#a4521f'; g.fillText(clip(o.kind === 'mix' ? '拆开走最划算' : A.routeName(P, o.kind) + '最划算', maxW), L, y); y += 74;
    font(80, true); g.fillStyle = '#2a2622'; g.fillText(clip('到手 ' + A.yuan(b.net) + ' 元', maxW), L, y); y += 54;
    if (o.kind === 'mix') {
      wrap(A.planText(P, b), 26, '#575049', false, 3);
      var sx = L; y += 4;
      ['A', 'B', 'C'].forEach(function (r) { if (!b.q[r]) return; var w = maxW * b.q[r] / P.qty; g.fillStyle = COL[r]; g.fillRect(sx, y, w, 26); sx += w; });
      y += 60;
    } else y += 20;
    /* 三条路横条：长度按到手钱（负的画 0 长度并标红） */
    var mx = Math.max(1, o.routes.A.net, o.routes.B.net, o.routes.C.net);
    ['A', 'B', 'C'].forEach(function (r) {
      var p = o.routes[r];
      font(26, true); g.fillStyle = '#2a2622'; g.fillText(clip(A.routeName(P, r), 330), L, y + 30);
      var bx = L + 340, bw = maxW - 340 - 200, w = p.net > 0 ? bw * p.net / mx : 0;
      g.fillStyle = '#eee8de'; g.fillRect(bx, y + 10, bw, 28); g.fillStyle = COL[r]; g.fillRect(bx, y + 10, w, 28);
      font(26, true); g.fillStyle = p.net < 0 ? '#b23b2e' : '#2a2622'; var t = A.yuan(p.net); g.fillText(t, Rr - g.measureText(t).width, y + 32);
      font(20); g.fillStyle = '#8d857c'; g.fillText(clip(r === 'A' ? '不花运费' : p.trips + ' 趟，运费 ' + A.yuan(p.freight) + ' 元' + (r === 'C' ? '，加工费 ' + A.yuan(p.procCost) + ' 元' : ''), maxW - 340), bx, y + 66);
      y += 100;
    });
    y += 34;
    var z = o.cross.CoverB, zt = z.all ? '不管市场多远，全部' + P.pv + '再拉都比原样拉多' : (z.none || (z.upTo != null && z.upTo < 0)) ? '不管市场多远，全部' + P.pv + '再拉都不比原样拉多' : z.upTo != null ? '市场在 ' + z.upTo + ' 公里以内，' + P.pv + '再拉比原样拉多' : '市场在 ' + z.from + ' 公里以外，' + P.pv + '再拉比原样拉多';
    wrap(zt, 28, '#2a2622', true, 2); y += 16;
    if (o.actions.length) { font(26, true); g.fillStyle = '#2a2622'; g.fillText('改一样试试', L, y + 6); y += 46; o.actions.slice(0, 2).forEach(function (a) { wrap('→ ' + a.text, 23, '#a4521f', false, 2); y += 2; }); }
    y = Math.max(y + 10, H - 130);
    wrap('价格、运费、出成率都是自己填的；不算加工天数、晾晒场地、天气和压价。默认数字为虚构示例。', 20, '#8d857c', false, 2);
    return cv;
  }
  $('dlPng').addEventListener('click', function () { drawCard().toBlob(function (bl) { if (bl) download('别给水分付运费-' + tag() + '-1080x1350.png', bl); }, 'image/png'); });

  window.__dhUi = { state: function () { return clone(state); }, out: function () { return out; }, importText: importText, drawCard: drawCard, storageKey: KEY };
  fill(); update();
})();
