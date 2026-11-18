/* 别给水分付运费 · 核心测试：node --test tests/core.test.cjs
 * 锚点：独立 Python Fraction 对拆法暴力穷举（299 组）、默认场景手算、边界、导出。 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const A = require(path.join(__dirname, '..', 'core.js'));
const REF = JSON.parse(fs.readFileSync(path.join(__dirname, 'ref.json'), 'utf8'));

test('默认场景：拆开走（mix）、手算读数、说明、改法', () => {
  const o = A.compute(A.defaultState()); assert.ok(o.ok);
  assert.equal(o.P.qty, 3000); assert.equal(o.P.dist, 200); assert.equal(o.P.yld, 180);
  /* 每公斤鲜辣椒：原样拉换 3.20、加工后换 19×0.18=3.42、加工费 0.30 → C换回 3.42−0.30=3.12
   * 一趟 150 + 4×200 = 950 元；原样 ⌈3000/1500⌉=2 车、加工后 ⌈3000×0.18/450⌉=⌈540/450⌉=2 车
   * 三条纯路：A=3000×2=6000; B=3000×3.2−2×950=9600−1900=7700; C=3000×3.12−2×950=9360−1900=7460
   * 拆开走：cap2=450 → 1 车装 450 公斤干辣椒对应 ⌊450/0.18⌋=2500 公斤鲜辣椒，剩 500 kg 就地卖
   *   net = 500×2 + 2500×3.12 − 1×950 = 1000+7800−950 = 7850 */
  assert.equal(o.best.q.A, 500); assert.equal(o.best.q.B, 0); assert.equal(o.best.q.C, 2500);
  assert.equal(o.best.n.B, 0); assert.equal(o.best.n.C, 1); assert.equal(o.best.trips, 1);
  assert.equal(o.best.net, 785000000);   /* mf = 千分之一分；7850 元 = 785000 分 = 785000000 mf */
  assert.equal(o.kind, 'mix');
  assert.equal(o.routes.A.net, 600000000); assert.equal(o.routes.B.net, 770000000); assert.equal(o.routes.C.net, 746000000);
  assert.ok(A.headline(o).includes('拆开走最划算'));
  assert.ok(A.headline(o).includes('7,850.00 元'));
  assert.ok(A.explain(o).includes('不管市场多远，全部晒干再拉都不比原样拉多'));
  assert.ok(A.explain(o).includes('拆开走是因为'));
  assert.ok(o.actions.length >= 2);
  assert.ok(o.actions.some((a) => a.id === 'p2' && a.kind === 'C'));
});

test('对拍：Python Fraction 暴力穷举 299 组', () => {
  let ok = 0;
  REF.forEach((c, i) => {
    const st = { name: 'test', pv: '加工', pn: '加工后', qty: String(c.qty), p0: String(c.p0 / 100),
      dist: String(c.dist), p1: String(c.p1 / 100), cap1: String(c.cap1), fee: String(c.fee / 100), perkm: String(c.perkm / 100),
      yld: String(c.yld / 10), proc: String(c.proc / 100), p2: String(c.p2 / 100), cap2: String(c.cap2) };
    const o = A.compute(st);
    if (!o.ok) { console.log('case', i, 'parse fail', JSON.stringify(o.errors)); assert.fail('parse'); }
    assert.deepEqual([o.best.q.A, o.best.q.B, o.best.q.C], c.ref.q, `case ${i} split`);
    assert.deepEqual([o.best.n.B, o.best.n.C], c.ref.n, `case ${i} trips`);
    /* mf 允许 ±1 舍入（JS 按 mf 四舍五入到分再算，Python Fraction 精确） */
    const diff = Math.abs(o.best.net - c.ref.net_mf);
    assert.ok(diff <= 1, `case ${i} net diff=${diff} js=${o.best.net} py=${c.ref.net_mf}`);
    ok++;
  });
  assert.equal(ok, 299);
});

test('纯路线：A全卖/B全拉/C全加工，边界 dist=0 运费=0', () => {
  let st = A.defaultState(); st.dist = '0'; st.fee = '0'; st.perkm = '0';
  let o = A.compute(st); assert.ok(o.ok);
  /* 无运费：A=6000, B=3000×3.2=9600, C=3000×(19×0.18−0.30)=3000×3.12=9360 → B最好 */
  assert.equal(o.kind, 'B'); assert.equal(o.best.q.B, 3000); assert.equal(o.best.net, 960000000);
  assert.equal(o.routes.A.net, 600000000); assert.equal(o.routes.B.net, 960000000); assert.equal(o.routes.C.net, 936000000);
  assert.ok(A.explain(o).includes('运费只摊 0.00 元'));
});

test('crossings：两条路到手钱相等的临界距离', () => {
  /* 默认：B vs C 斜率相同（都 2 车）→ C 永远不比 B 多（C起点 7460 < B起点 7700） */
  let o = A.compute(A.defaultState()); assert.ok(o.ok);
  assert.deepEqual(o.cross.CoverB, { none: true });
  /* 改 cap2=600 让 C 只要 1 车：C起点 3000×3.12−950=8410 > B起点 7700；斜率 C−B = −950 < 0 → 越远 C 越占便宜 */
  let st = A.defaultState(); st.cap2 = '600';
  o = A.compute(st); assert.ok(o.ok);
  /* 不含运费 K_C=9360、K_B=9600；C−B = (9360−9600) + 1×(150+4d) = 4d − 90 > 0 ⇔ d ≥ 23
   * 手算：22 公里 C=9360−238=9122 < B=9600−476=9124；23 公里 C=9118 > B=9116 */
  assert.deepEqual(o.cross.CoverB, { from: 23 });
  st.dist = '22'; let a = A.compute(st); assert.ok(a.routes.C.net < a.routes.B.net);
  st.dist = '23'; a = A.compute(st); assert.ok(a.routes.C.net > a.routes.B.net);
});

test('边界：qty=1, 单件比车重, cap 上限', () => {
  let st = A.defaultState(); st.qty = '1'; st.cap1 = '1'; st.cap2 = '1';
  let o = A.compute(st); assert.ok(o.ok);
  assert.equal(o.best.q.A + o.best.q.B + o.best.q.C, 1);
  
  /* 100000 ÷ 1000 正好 100 车：允许；999 → 101 车：报错 */
  st = A.defaultState(); st.qty = '100000'; st.cap1 = '1000';
  assert.ok(A.compute(st).ok);
  st.cap1 = '999'; o = A.compute(st);
  assert.ok(!o.ok && o.errors.some((e) => e.field === 'cap1' && e.message.includes('101 车')));
});

test('输入校验：空/非数字/小数位数/负数/超范围', () => {
  function err(f, v, want) {
    let st = A.defaultState(); st[f] = v;
    let o = A.compute(st);
    assert.ok(!o.ok && o.errors.some((e) => e.field === f && e.message.includes(want)), `field=${f} v=${v} want=${want}`);
  }
  err('qty', '', '没填');
  err('qty', 'abc', '要填数字');
  err('qty', '10.5', '要填整数');
  err('qty', '0', '要在 1');
  err('p0', '12.345', '最多两位小数');
  err('yld', '100.12', '最多一位小数');
  err('yld', '0', '要在 0.1');
  err('yld', '101', '要在');
});

test('导出：CSV、MD 行数、包含关键字、可往返 JSON', () => {
  const o = A.compute(A.defaultState()); assert.ok(o.ok);
  const csv = A.toCSV(o, '2026-11-18 16:30'), md = A.toMD(o, '2026-11-18 16:30');
  assert.ok(csv.includes('别给水分付运费')); assert.ok(csv.includes('鲜辣椒'));
  assert.ok(csv.split('\n').length > 10);
  assert.ok(md.includes('# 别给水分付运费')); assert.ok(md.includes('拆开走最划算'));
  assert.ok(md.split('\n').length > 8);
  const j = JSON.stringify({ app: '别给水分付运费', state: A.defaultState() });
  assert.ok(j.includes('鲜辣椒'));
});

test('改法 actions：p2涨价让C成为最优、cap2变大少一车', () => {
  const o = A.compute(A.defaultState()); assert.ok(o.ok);
  /* 默认 mix，actions 应该有「干辣椒卖到 X 元，全部晒干再拉就最划算」 */
  const p2act = o.actions.filter((a) => a.id === 'p2' && a.kind === 'C');
  assert.ok(p2act.length >= 1, 'should have p2 action');
  const a = p2act[0];
  const o2 = A.compute(A.applyChange(A.defaultState(), a));
  assert.ok(o2.ok && o2.kind === 'C', 'after p2 change should be all C');
});

test('全角数字、中文逗号能识别', () => {
  let st = A.defaultState(); st.qty = '３，０００'; st.p0 = '２．００';
  let o = A.compute(st); assert.ok(o.ok);
  assert.equal(o.P.qty, 3000); assert.equal(o.P.p0, 200);
});

test('平局规则：到手一样时少跑趟、就地卖多、加工少', () => {
  /* 就地价 = 市场价、不花运费 → A 与 B 打平，取就地卖 */
  let s = A.defaultState(); s.p1 = '2.00'; s.dist = '0'; s.fee = '0'; s.perkm = '0'; s.p2 = '0';
  let o = A.compute(s); assert.equal(o.kind, 'A'); assert.equal(o.best.q.A, 3000);
  /* 出成率 20%、干货 17.50 → 每公斤 0.2×17.5−0.30 = 3.20，与原样一样；都 1 车、无运费 → 打平取加工少 = 全部原样拉 */
  s = A.defaultState(); s.yld = '20'; s.p2 = '17.50'; s.cap1 = '3000'; s.cap2 = '600'; s.dist = '0'; s.fee = '0'; s.perkm = '0';
  o = A.compute(s); assert.equal(o.kind, 'B'); assert.equal(o.best.net, A.compute(Object.assign({}, s, { p1: '3.20' })).routes.C.net);
  /* 每趟 160 元固定：C−B = 4d − 80，20 公里正好打平 → C 只 1 车，取趟数少 */
  s = A.defaultState(); s.cap2 = '600'; s.fee = '160'; s.dist = '20';
  o = A.compute(s); assert.equal(o.routes.B.net, o.routes.C.net); assert.equal(o.kind, 'C');
});

test('临界距离正好落在整数公里：严格多才算', () => {
  let s = A.defaultState(); s.cap2 = '600'; s.fee = '160';
  assert.deepEqual(A.compute(s).cross.CoverB, { from: 21 });
  /* B−A = 3600 − 2×(100 + 4d) = 3400 − 8d，425 公里打平 → 最远 424 公里 B 严格多 */
  s = A.defaultState(); s.fee = '100';
  const o = A.compute(s); assert.equal(o.cross.BoverA.upTo, 424);
  s.dist = '424'; let r = A.compute(s).routes; assert.ok(r.B.net > r.A.net);
  s.dist = '425'; r = A.compute(s).routes; assert.equal(r.B.net, r.A.net);
});

test('改法：建议价是最低的那一分钱；无运费时「少一车」不出现', () => {
  const o = A.compute(A.defaultState()); const a = o.actions.find((x) => x.id === 'p2');
  assert.equal(a.value, '23.34');
  let s = A.defaultState(); s.p2 = '23.33'; assert.notEqual(A.compute(s).kind, 'C');
  s.p2 = '23.34'; assert.equal(A.compute(s).kind, 'C');
  s = A.defaultState(); s.dist = '0'; s.fee = '0'; s.perkm = '0';
  const r = A.compute(s); assert.equal(r.kind, 'B'); assert.equal(r.best.n.B, 2);
  assert.ok(!r.actions.some((x) => x.id === 'cap1' || x.id === 'cap2'));
  assert.ok(r.actions.every((x) => x.gain > 0 || x.id === 'p2' || x.id === 'yld'));
});

test('加工后车数上限与图表刻度', () => {
  let s = A.defaultState(); s.qty = '2010'; s.yld = '50'; s.cap2 = '10';
  let o = A.compute(s); assert.ok(o.errors.some((e) => e.field === 'cap2' && e.message.includes('101 车')));
  s.qty = '2000'; assert.ok(A.compute(s).ok);
  s = A.defaultState(); s.dist = '500'; o = A.compute(s); assert.equal(o.chart.Dmax, 1000); assert.equal(o.chart.step, 100);
  assert.equal(o.chart.pts.length, 61); assert.equal(o.chart.pts[60].d, 1000);
});
