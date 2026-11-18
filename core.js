/* 别给水分付运费 · 计算核心（core.js）
 * 问题：一批货（鲜辣椒、柴、鲜笋……）可以就地卖，可以原样拉到远处市场卖，也可以先加工（晒干、烧成炭）
 *       变轻了再拉。原样拉是在给水分付运费；加工要花钱、还会少掉大半重量。哪样到手多？混着来呢？
 * 口径（设计选择，页面「怎么算的」写明）：
 *   - 三条路：就地卖原样的货；原样装车拉到市场卖；加工后装车拉到市场卖。可以把一批货拆开走几条路。
 *   - 车按趟算钱：每趟 = 固定费（装卸、过路）+ 每公里费 × 单程公里数（回程空车的钱算进每公里费里）。
 *     原样的货、加工后的货分开装车，各有各的每车最多装多少公斤（干货蓬松，常常装不满载重）。
 *     最后一车没装满也按一趟算。
 *   - 加工：出成率 = 加工后重量 ÷ 原样重量；加工费按原样重量每公斤算。不算加工要几天、晾晒场地、损耗以外的风险。
 *   - 目标：到手钱最多（卖货收入 − 加工费 − 运费）。平手时选趟数少的，再平手选就地卖得多的、加工得少的（省事）。
 * 精确：钱用「千分之一分」整数、重量用整数公斤与克，不用浮点。 */
(function (root) {
  'use strict';
  var MAX_TRIPS = 100;          /* 每条路最多 100 车：拆分法要把两条路的车数两两试一遍 */
  var ROUTE = ['A', 'B', 'C'];

  function defaultState() {
    return {
      name: '鲜辣椒', pv: '晒干', pn: '干辣椒',
      qty: '3000', p0: '2.00',
      dist: '200', p1: '3.20', cap1: '1500',
      fee: '150', perkm: '4.00',
      yld: '18', proc: '0.30', p2: '19.00', cap2: '450'
    };
  }
  var FIELDS = ['name', 'pv', 'pn', 'qty', 'p0', 'dist', 'p1', 'cap1', 'fee', 'perkm', 'yld', 'proc', 'p2', 'cap2'];
  var TEXT = { name: 8, pv: 6, pn: 8 };

  function half(s) { return String(s == null ? '' : s).replace(/[\uFF01-\uFF5E]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); }).replace(/\u3000/g, ' ').replace(/[\s,，]/g, ''); }
  function txt(v, n, dft) { var s = String(v == null ? '' : v).replace(/[<>&"]/g, '').trim().slice(0, n); return s || dft; }

  function parse(st) {
    var errs = [], P = {};
    st = st && typeof st === 'object' ? st : {};
    function int(f, lo, hi, label, unit) {
      var s = half(st[f]);
      if (!/^\d+$/.test(s)) { errs.push({ field: f, message: label + (s === '' ? '没填' : /^\d+\.\d+$/.test(s) ? '要填整数' : '要填数字') }); return null; }
      var x = Number(s);
      if (x < lo || x > hi) { errs.push({ field: f, message: label + '要在 ' + lo + '～' + hi + ' ' + unit + '之间' }); return null; }
      return x;
    }
    /* 钱：最多两位小数 → 分 */
    function money(f, hi, label, unit) {
      var s = half(st[f]);
      if (!/^\d+(\.\d{1,2})?$/.test(s)) { errs.push({ field: f, message: label + (s === '' ? '没填' : '要填数字，最多两位小数') }); return null; }
      var m = s.split('.'), fen = Number(m[0]) * 100 + (m[1] ? Number((m[1] + '0').slice(0, 2)) : 0);
      if (fen > hi * 100) { errs.push({ field: f, message: label + '要在 0～' + hi + ' ' + unit + '之间' }); return null; }
      return fen;
    }
    P.name = txt(st.name, TEXT.name, '这批货');
    P.pv = txt(st.pv, TEXT.pv, '加工');
    P.pn = txt(st.pn, TEXT.pn, '加工后的货');
    P.qty = int('qty', 1, 100000, '货有多少', '公斤');
    P.p0 = money('p0', 1000, '就地卖价', '元/公斤');
    P.dist = int('dist', 0, 3000, '到市场的距离', '公里');
    P.p1 = money('p1', 1000, '市场上原样的货', '元/公斤');
    P.cap1 = int('cap1', 1, 100000, '原样的货每车最多装', '公斤');
    P.fee = money('fee', 100000, '每趟固定费', '元');
    P.perkm = money('perkm', 1000, '每公里运费', '元');
    var ys = half(st.yld);
    if (!/^\d+(\.\d)?$/.test(ys)) { errs.push({ field: 'yld', message: '出成率' + (ys === '' ? '没填' : '要填数字，最多一位小数') }); P.yld = null; }
    else {
      var ym = ys.split('.'); P.yld = Number(ym[0]) * 10 + (ym[1] ? Number(ym[1]) : 0);   /* 千分之几 */
      if (P.yld < 1 || P.yld > 1000) { errs.push({ field: 'yld', message: '出成率要在 0.1～100 %之间' }); P.yld = null; }
    }
    P.proc = money('proc', 1000, '加工费', '元/公斤');
    P.p2 = money('p2', 10000, '市场上' + P.pn + '的价', '元/公斤');
    P.cap2 = int('cap2', 1, 100000, P.pn + '每车最多装', '公斤');
    if (!errs.length) {
      if (Math.ceil(P.qty / P.cap1) > MAX_TRIPS) errs.push({ field: 'cap1', message: '原样拉要 ' + Math.ceil(P.qty / P.cap1) + ' 车，超过 ' + MAX_TRIPS + ' 车算不过来：把每车装的改大，或者货量改小' });
      var nc = Math.ceil(P.qty * P.yld / (P.cap2 * 1000));
      if (nc > MAX_TRIPS) errs.push({ field: 'cap2', message: '加工后要 ' + nc + ' 车，超过 ' + MAX_TRIPS + ' 车算不过来：把每车装的改大，或者货量改小' });
    }
    return { P: P, errors: errs };
  }

  /* ── 计算：单位 mf = 千分之一分 ── */
  function tripMf(P, d) { return (P.fee + P.perkm * d) * 1000; }
  function margins(P) { return { A: P.p0 * 1000, B: P.p1 * 1000, C: P.yld * P.p2 - P.proc * 1000 }; }  /* 每公斤原样货 */
  function tripsB(P, q) { return Math.ceil(q / P.cap1); }
  function tripsC(P, q) { return Math.ceil(q * P.yld / (P.cap2 * 1000)); }   /* q 公斤原样货加工后 q×yld 克 */
  function plan(P, d, qA, qB, qC) {
    var m = margins(P), T = tripMf(P, d), nB = tripsB(P, qB), nC = tripsC(P, qC);
    return {
      q: { A: qA, B: qB, C: qC }, n: { B: nB, C: nC }, trips: nB + nC,
      rev: qA * m.A + qB * P.p1 * 1000 + qC * P.yld * P.p2, procCost: qC * P.proc * 1000, freight: (nB + nC) * T,
      net: qA * m.A + qB * m.B + qC * m.C - (nB + nC) * T,
      outKg: qC * P.yld / 1000,   /* 加工后公斤（可能带小数，克整数） */
      lastB: nB ? qB - (nB - 1) * P.cap1 : 0, lastC: nC ? qC * P.yld - (nC - 1) * P.cap2 * 1000 : 0   /* 最后一车：公斤 / 克 */
    };
  }
  function pure(P, d) { return { A: plan(P, d, P.qty, 0, 0), B: plan(P, d, 0, P.qty, 0), C: plan(P, d, 0, 0, P.qty) }; }
  function better(a, b) {   /* a 比 b 好？ */
    if (a.net !== b.net) return a.net > b.net;
    if (a.trips !== b.trips) return a.trips < b.trips;
    if (a.q.A !== b.q.A) return a.q.A > b.q.A;
    return a.q.C < b.q.C;
  }
  /* 拆开走：把原样拉的车数 nB、加工后的车数 nC 两两试一遍；车数定了以后，每公斤到手多的路先装满，剩下就地卖 */
  function bestMix(P, d) {
    var m = margins(P), NB = tripsB(P, P.qty), NC = tripsC(P, P.qty), best = null;
    for (var nB = 0; nB <= NB; nB++) for (var nC = 0; nC <= NC; nC++) {
      var cap = { B: Math.min(P.qty, nB * P.cap1), C: Math.min(P.qty, Math.floor(nC * P.cap2 * 1000 / P.yld)) };
      var order = m.B >= m.C ? ['B', 'C'] : ['C', 'B'], rem = P.qty, q = { B: 0, C: 0 };
      order.forEach(function (r) { if (m[r] > m.A) { q[r] = Math.min(cap[r], rem); rem -= q[r]; } });
      var p = plan(P, d, rem, q.B, q.C);
      if (!best || better(p, best)) best = p;
    }
    return best;
  }
  function kindOf(p, qty) { return p.q.A === qty ? 'A' : p.q.B === qty ? 'B' : p.q.C === qty ? 'C' : 'mix'; }

  /* 两条纯路线到手钱一样的距离：net(d) = K − n·(fee + perkm·d)·1000，都是直线 */
  function crossings(P) {
    var m = margins(P), Q = P.qty, nB = tripsB(P, Q), nC = tripsC(P, Q), F = P.fee * 1000, R = P.perkm * 1000;
    var K = { A: Q * m.A, B: Q * m.B, C: Q * m.C }, n = { A: 0, B: nB, C: nC };
    /* x 比 y 严格多的整数公里集合：x−y = (Kx−Ky) − (nx−ny)·F − (nx−ny)·R·d > 0 */
    function zone(x, y) {
      var dn = n[x] - n[y], c0 = K[x] - K[y] - dn * F;   /* x−y = c0 − dn·R·d */
      if (dn === 0 || R === 0) return c0 > 0 ? { all: true } : { none: true };
      if (dn > 0) {   /* 越远 x 越吃亏：d < c0/(dn R) */
        if (c0 <= 0) return { none: true };
        return { upTo: Math.ceil(c0 / (dn * R)) - 1 };   /* 最远这么多公里还严格多 */
      }
      /* dn < 0：越远 x 越占便宜：d > c0/(dn R) = (−c0)/(−dn R) */
      var k = -dn * R;
      if (c0 > 0) return { all: true };
      return { from: Math.floor(-c0 / k) + 1 };
    }
    return { CoverB: zone('C', 'B'), BoverA: zone('B', 'A'), CoverA: zone('C', 'A') };
  }

  function compute(st, opt) {
    opt = opt || {};
    var pr = parse(st), P = pr.P;
    if (pr.errors.length) return { ok: false, errors: pr.errors, P: P };
    var d = P.dist, routes = pure(P, d), best = bestMix(P, d), o = { ok: true, errors: [], P: P, routes: routes, best: best };
    o.kind = kindOf(best, P.qty);
    var pb = 'A'; ['B', 'C'].forEach(function (r) { if (better(routes[r], routes[pb])) pb = r; });
    o.pureBest = pb;
    o.m = margins(P); o.trip = tripMf(P, d);
    o.cross = crossings(P);
    if (!opt.lite) { o.actions = actions(st, o); o.chart = chart(P, o); }
    return o;
  }

  /* 改法：每条都是改一个输入，重算后到手钱更多（或换成全部加工这条路） */
  function withField(st, f, v) { var s = JSON.parse(JSON.stringify(st)); s[f] = v; return s; }
  function fenStr(fen) { return Math.floor(fen / 100) + '.' + String(fen % 100 + 100).slice(1); }
  function actions(st, o) {
    var P = o.P, list = [], base = o.best.net;
    function add(id, f, v, text) {
      var r = compute(withField(st, f, v), { lite: true });
      if (!r.ok) return;
      var gain = r.best.net - base;
      if (gain <= 0 && !(id === 'p2' || id === 'yld')) return;
      list.push({ id: id, field: f, value: v, text: text, gain: gain, net: r.best.net, kind: r.kind, trips: r.best.trips, tripsNow: o.best.trips });
    }
    function allC(s) { var r = compute(s, { lite: true }); return r.ok && r.kind === 'C'; }
    if (o.kind !== 'C') {
      /* 加工后的价卖到多少，全部加工再拉就是最划算的：对 p2 单调，二分 */
      var lo = P.p2, hi = 1000000;
      if (allC(withField(st, 'p2', fenStr(hi)))) {
        while (hi - lo > 1) { var mid = Math.floor((lo + hi) / 2); if (allC(withField(st, 'p2', fenStr(mid)))) hi = mid; else lo = mid; }
        add('p2', 'p2', fenStr(hi), P.pn + '卖到 ' + yuanFen(hi) + ' 元/公斤，全部' + P.pv + '再拉就最划算');
      }
      /* 出成率做到多少（车数会跳，不单调，逐个 0.1% 试） */
      for (var y = P.yld + 1; y <= 1000; y++) {
        var v = Math.floor(y / 10) + '.' + (y % 10);
        if (allC(withField(st, 'yld', v))) { add('yld', 'yld', v, '出成率做到 ' + pctStr(y) + '%，全部' + P.pv + '再拉就最划算'); break; }
      }
    }
    /* 装得更满：让用到的那条路少一车 */
    var b = o.best;
    if (b.n.C >= 1) {
      var c2 = b.n.C > 1 ? Math.ceil(b.q.C * P.yld / (1000 * (b.n.C - 1))) : 0;
      if (b.n.C > 1 && c2 <= 100000) add('cap2', 'cap2', String(c2), P.pn + '压紧点、每车装到 ' + kgStr(c2) + ' 公斤，少跑一趟');
    }
    if (b.n.B > 1) {
      var c1 = Math.ceil(b.q.B / (b.n.B - 1));
      if (c1 <= 100000) add('cap1', 'cap1', String(c1), '原样的货换辆能装 ' + kgStr(c1) + ' 公斤的车，少跑一趟');
    }
    list.sort(function (x, y) { return y.gain - x.gain; });
    return list.slice(0, 4);
  }
  function applyChange(st, a) { return withField(st, a.field, a.value); }

  /* 图：到市场 0～Dmax 公里，三条纯路线 + 拆开走的最多到手钱 */
  function chart(P, o) {
    var c = o.cross, cand = [P.dist * 2, 60];
    [c.CoverB.from, c.CoverA.from, c.BoverA.upTo, c.CoverA.upTo].forEach(function (x) { if (x != null && x < 3000) cand.push(Math.ceil(x * 1.25) + 10); });
    var Dmax = Math.max.apply(null, cand); Dmax = Math.min(Math.max(Dmax, P.dist + 20), 6000);
    var step = [10, 20, 25, 50, 100, 200, 250, 500, 1000].filter(function (s) { return Dmax / s <= 10; })[0] || 1000;
    Dmax = Math.ceil(Dmax / step) * step;
    var pts = [], N = 60;
    for (var i = 0; i <= N; i++) {
      var d = Math.round(Dmax * i / N), r = pure(P, d), mx = bestMix(P, d);
      pts.push({ d: d, A: r.A.net, B: r.B.net, C: r.C.net, M: mx.net });
    }
    return { Dmax: Dmax, step: step, pts: pts };
  }

  /* ── 文字 ── */
  function grp(s) { return s.replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function yuan(mf) {   /* 千分之一分 → 「1,234.56」，四舍五入到分 */
    var neg = mf < 0, f = Math.floor((Math.abs(mf) + 500) / 1000);
    return (neg && f ? '−' : '') + grp(String(Math.floor(f / 100))) + '.' + String(f % 100 + 100).slice(1);
  }
  function yuanFen(fen) { return grp(String(Math.floor(fen / 100))) + '.' + String(fen % 100 + 100).slice(1); }
  function pctStr(y) { return Math.floor(y / 10) + (y % 10 ? '.' + (y % 10) : ''); }
  function kgStr(q) { return grp(String(q)); }
  function gKg(g) {   /* 克 → 公斤，最多一位小数 */
    var t = Math.round(g / 100); return grp(String(Math.floor(t / 10))) + (t % 10 ? '.' + (t % 10) : '');
  }
  function routeName(P, r) { return r === 'A' ? '全部就地卖' : r === 'B' ? '全部原样拉去卖' : r === 'C' ? '全部' + P.pv + '再拉' : '拆开走'; }
  function planText(P, p) {
    var s = [];
    if (p.q.A) s.push(kgStr(p.q.A) + ' 公斤就地卖');
    if (p.q.B) s.push(kgStr(p.q.B) + ' 公斤原样拉（' + p.n.B + ' 车）');
    if (p.q.C) s.push(kgStr(p.q.C) + ' 公斤' + P.pv + '成 ' + gKg(p.q.C * P.yld) + ' 公斤' + P.pn + '再拉（' + p.n.C + ' 车）');
    return s.join('，');
  }
  function headline(o) {
    var P = o.P, b = o.best, k = o.kind, tail = '';
    var second = null;
    ROUTE.forEach(function (r) { if (r !== k && (!second || better(o.routes[r], o.routes[second]))) second = r; });
    if (k !== 'mix') tail = '，比' + routeName(P, second) + '多 ' + yuan(b.net - o.routes[second].net) + ' 元';
    else tail = '，比最好的单走一条路（' + routeName(P, o.pureBest) + '）多 ' + yuan(b.net - o.routes[o.pureBest].net) + ' 元';
    return P.name + ' ' + kgStr(P.qty) + ' 公斤、市场 ' + P.dist + ' 公里：' + (k === 'mix' ? '拆开走最划算——' + planText(P, b) : routeName(P, k) + '最划算') + '，到手 ' + yuan(b.net) + ' 元' + tail + '。';
  }
  function zoneText(z, yes, no) {   /* yes =「全部晒干再拉比原样拉多」 no =「全部晒干再拉都不比原样拉多」 */
    if (z.all) return '不管市场多远，' + yes + '。';
    if (z.none || (z.upTo != null && z.upTo < 0)) return '不管市场多远，' + no + '。';
    if (z.upTo != null) return '市场在 ' + z.upTo + ' 公里以内，' + yes + '。';
    return '市场在 ' + z.from + ' 公里以外，' + yes + '。';
  }
  function explain(o) {
    var P = o.P, m = o.m, T = o.trip, Q = P.qty, r = o.routes;
    var perB = r.B.n.B * T / Q, perC = r.C.n.C * T / Q;   /* 每公斤原样货摊到的运费 mf */
    var s = '每公斤' + P.name + '：原样拉到市场卖 ' + yuanFen(P.p1) + ' 元，运费摊下来 ' + yuan(Math.round(perB)) + ' 元；' +
      P.pv + '后只剩 ' + pctStr(P.yld) + '% 的重量，换回 ' + yuan(m.C + P.proc * 1000) + ' 元、扣掉加工费 ' + yuanFen(P.proc) + ' 元，运费只摊 ' + yuan(Math.round(perC)) + ' 元；就地卖 ' + yuanFen(P.p0) + ' 元、不花运费。' +
      '一趟车 ' + yuan(T) + ' 元（固定 ' + yuanFen(P.fee) + ' + ' + yuanFen(P.perkm) + ' × ' + P.dist + ' 公里），原样要 ' + r.B.n.B + ' 车、' + P.pv + '后要 ' + r.C.n.C + ' 车。';
    s += zoneText(o.cross.CoverB, '全部' + P.pv + '再拉比原样拉多', '全部' + P.pv + '再拉都不比原样拉多');
    if (o.kind === 'mix') {
      var b = o.best, why = [];
      if (b.q.A && (b.q.B || b.q.C)) why.push('最后那车装不满，拉它挣的不够一趟运费，就地卖掉');
      if (b.q.B && b.q.C) why.push('两条路各装满整车');
      if (why.length) s += '拆开走是因为' + why.join('；') + '。';
    }
    return s;
  }

  function csvCell(v) { v = String(v); return /[",\r\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
  function row(a) { return a.map(csvCell).join(','); }
  function routeRows(o) {
    var P = o.P, out = [];
    ROUTE.concat(['best']).forEach(function (r) {
      var p = r === 'best' ? o.best : o.routes[r];
      out.push([r === 'best' ? '最划算（' + (o.kind === 'mix' ? '拆开走' : routeName(P, o.kind)) + '）' : routeName(P, r), planText(P, p), p.trips, yuan(p.rev), yuan(p.procCost), yuan(p.freight), yuan(p.net)]);
    });
    return out;
  }
  function toCSV(o, when) {
    var P = o.P, L = [];
    L.push(row(['别给水分付运费', '导出时间', when, '货', P.name]));
    L.push(row(['货量 公斤', P.qty, '市场距离 公里', P.dist, '一趟车 元', yuan(o.trip), '出成率 %', pctStr(P.yld)]));
    L.push('');
    L.push(row(['走法', '怎么分', '车数', '卖货收入 元', '加工费 元', '运费 元', '到手 元']));
    routeRows(o).forEach(function (x) { L.push(row(x)); });
    L.push('');
    L.push(row(['距离 公里', routeName(P, 'A'), routeName(P, 'B'), routeName(P, 'C'), '拆开走最多']));
    o.chart.pts.forEach(function (p) { L.push(row([p.d, yuan(p.A), yuan(p.B), yuan(p.C), yuan(p.M)])); });
    L.push('');
    o.actions.forEach(function (a) { L.push(row(['改法', a.text, '改完到手', yuan(a.net)])); });
    return L.join('\r\n') + '\r\n';
  }
  function toMD(o, when) {
    var P = o.P, L = ['# 别给水分付运费 · ' + P.name, '', '导出时间：' + when, '', '**' + headline(o) + '**', '', explain(o), '',
      '| 走法 | 怎么分 | 车数 | 卖货收入 | 加工费 | 运费 | 到手 |', '|---|---|---:|---:|---:|---:|---:|'];
    routeRows(o).forEach(function (x) { L.push('| ' + x.join(' | ') + ' |'); });
    if (o.actions.length) { L.push('', '## 改一样试试'); o.actions.forEach(function (a) { L.push('- ' + a.text + '（改完到手 ' + yuan(a.net) + ' 元）'); }); }
    L.push('', '> 价格、运费、出成率都是自己填的；默认数字为虚构示例。不算加工要几天、晾晒场地、天气和压价风险。', '');
    return L.join('\n');
  }

  var api = { defaultState: defaultState, FIELDS: FIELDS, TEXT: TEXT, MAX_TRIPS: MAX_TRIPS, parse: parse, compute: compute, bestMix: bestMix, pure: pure, plan: plan,
    crossings: crossings, applyChange: applyChange, headline: headline, explain: explain, toCSV: toCSV, toMD: toMD,
    yuan: yuan, yuanFen: yuanFen, pctStr: pctStr, kgStr: kgStr, gKg: gKg, routeName: routeName, planText: planText, tripMf: tripMf };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AppCore = api;
})(this);
