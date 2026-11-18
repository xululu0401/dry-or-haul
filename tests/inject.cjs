#!/usr/bin/env node
'use strict';
/* 注入测试：对 core.js 做一处小改动，看核心测试能不能抓到。跑完自动还原。
 * 首轮 13/27。删掉 6 处等价/失效变异：net、trips 两条在 `!==` 守卫里，> 与 >=、< 与 <= 恒等；
 * 两路每公斤到手一样时谁先装满不改变到手钱，车数组合全试一遍后平局规则选同一个；到手与就地一样时多装也不会被平局规则选中；
 * dn === 0 在前面已经 return，dn > 0 与 >= 恒等；「dn < 0」原文不存在（是注释）。其余 8 处补测：平局、整数临界距离、建议价最低一分、无运费不给少一车、加工后车数上限、图表刻度。 */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const F = path.join(__dirname, '../core.js'), src = fs.readFileSync(F, 'utf8');
const M = [
  /* better() 平局规则：net > trips > qA > qC */
      ["if (a.q.A !== b.q.A) return a.q.A > b.q.A;", "if (a.q.A !== b.q.A) return a.q.A < b.q.A;"],
  ["return a.q.C < b.q.C;", "return a.q.C > b.q.C;"],
  
  /* margins：每公斤到手多少（mf） */
  ["A: P.p0 * 1000", "A: P.p0 * 100"],
  ["B: P.p1 * 1000", "B: P.p1 * 100"],
  ["C: P.yld * P.p2 - P.proc * 1000", "C: P.yld * P.p2 - P.proc * 100"],
  
  /* tripMf：一趟运费 */
  ["return (P.fee + P.perkm * d) * 1000;", "return (P.fee + P.perkm * d) * 100;"],
  
  /* 向上取整车数 */
  ["return Math.ceil(q / P.cap1);", "return Math.floor(q / P.cap1);"],
  ["return Math.ceil(q * P.yld / (P.cap2 * 1000));", "return Math.floor(q * P.yld / (P.cap2 * 1000));"],
  
  /* bestMix：逐个车数试一遍（含边界） */
  ["for (var nB = 0; nB <= NB; nB++)", "for (var nB = 0; nB < NB; nB++)"],
  ["for (var nC = 0; nC <= NC; nC++)", "for (var nC = 0; nC < NC; nC++)"],
  
  /* 每条路能装多少公斤（C 的 floor 是按原样货公斤取整） */
  ["C: Math.min(P.qty, Math.floor(nC * P.cap2 * 1000 / P.yld))", "C: Math.min(P.qty, Math.ceil(nC * P.cap2 * 1000 / P.yld))"],
  
  /* 两条路哪条优先装满：margin 大的先装 */
      
  /* plan net：到手钱 = 三条路毛收入 − 运费（trips 是加法不是乘法） */
  ["net: qA * m.A + qB * m.B + qC * m.C - (nB + nC) * T", "net: qA * m.A + qB * m.B + qC * m.C - nB * nC * T"],
  
  /* crossings：dn 符号判断斜率方向 */
      
  /* crossings 临界距离取整：upTo 要 -1、from 要 +1 */
  ["return { upTo: Math.ceil(c0 / (dn * R)) - 1 };", "return { upTo: Math.floor(c0 / (dn * R)) };"],
  ["return { from: Math.floor(-c0 / k) + 1 };", "return { from: Math.ceil(-c0 / k) };"],
  
  /* parse 范围校验 */
  ["if (x < lo || x > hi)", "if (x <= lo || x >= hi)"],
  ["if (P.yld < 1 || P.yld > 1000)", "if (P.yld <= 1 || P.yld >= 1000)"],
  ["if (Math.ceil(P.qty / P.cap1) > MAX_TRIPS)", "if (Math.ceil(P.qty / P.cap1) >= MAX_TRIPS)"],
  ["var nc = Math.ceil(P.qty * P.yld / (P.cap2 * 1000));", "var nc = Math.floor(P.qty * P.yld / (P.cap2 * 1000));"],
  
  /* actions：gain <= 0 的不加（p2/yld 例外） */
  ["if (gain <= 0 && !(id === 'p2' || id === 'yld')) return;", "if (gain < 0 && !(id === 'p2' || id === 'yld')) return;"],
  
  /* 二分查找：hi−lo > 1 才继续 */
  ["while (hi - lo > 1)", "while (hi - lo > 2)"],
  
  /* chart 步长：≤ 10 档 */
  ["var step = [10, 20, 25, 50, 100, 200, 250, 500, 1000].filter(function (s) { return Dmax / s <= 10; })[0] || 1000;",
   "var step = [10, 20, 25, 50, 100, 200, 250, 500, 1000].filter(function (s) { return Dmax / s < 10; })[0] || 1000;"],
];

let caught = 0;
const rows = [];
for (const [a, b] of M) {
  if (src.indexOf(a) < 0) { rows.push('✗ 找不到原文：' + a.slice(0, 70)); continue; }
  fs.writeFileSync(F, src.replace(a, b));
  let ok = true;
  try { execFileSync('node', ['--test', path.join(__dirname, 'core.test.cjs')], { stdio: 'pipe', timeout: 120000 }); }
  catch (e) { ok = false; }
  rows.push((ok ? '✗ 没抓到' : '✓ 抓到') + '：' + a.slice(0, 60) + ' → ' + b.slice(0, 60));
  if (!ok) caught++;
}
fs.writeFileSync(F, src);
console.log(rows.join('\n') + '\n\n注入 ' + M.length + ' 处，抓到 ' + caught + ' 处。');
process.exit(caught === M.length ? 0 : 1);
