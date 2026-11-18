/* 封面 cover.svg（1200×1200）：读数来自 core.js 同一次 compute；再用浏览器截成 cover.png。 */
const fs = require('node:fs');
const A = require('./core.js');
const o = A.compute(A.defaultState()), P = o.P, b = o.best;
if (!o.ok || o.kind !== 'mix' || A.yuan(b.net) !== '7,850.00') throw new Error('默认场景不对');
const F = "-apple-system,'PingFang SC','Microsoft YaHei',sans-serif";
const COL = { A: '#7b8a5a', B: '#3f6e8c', C: '#a4521f' };
const mx = Math.max(o.routes.A.net, o.routes.B.net, o.routes.C.net, b.net);
const rows = [['A', A.routeName(P, 'A'), o.routes.A.net], ['B', A.routeName(P, 'B'), o.routes.B.net], ['C', A.routeName(P, 'C'), o.routes.C.net]].map((r, k) => {
  const y = 700 + k * 110, w = (440 * r[2] / mx).toFixed(1);
  return `<text x="140" y="${y + 36}" font-family="${F}" font-size="36" font-weight="700" fill="#2a2622">${r[1]}</text>
  <rect x="440" y="${y + 8}" width="440" height="36" rx="6" fill="#eee8de"/><rect x="440" y="${y + 8}" width="${w}" height="36" rx="6" fill="${COL[r[0]]}"/>
  <text x="1060" y="${y + 36}" text-anchor="end" font-family="${F}" font-size="32" font-weight="700" fill="#2a2622">${A.yuan(r[2]).replace('.00', '')}</text>`;
}).join('\n  ');
const segA = (920 * b.q.A / P.qty).toFixed(1);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="1200" viewBox="0 0 1200 1200">
  <rect width="1200" height="1200" fill="#f3f0ea"/>
  <rect x="60" y="60" width="1080" height="1080" rx="18" fill="#ffffff"/>
  <text x="140" y="230" font-family="${F}" font-size="112" font-weight="800" fill="#2a2622">别给水分付运费</text>
  <text x="140" y="305" font-family="${F}" font-size="38" fill="#575049">就地卖、原样拉、晒干烧炭了再拉，哪样到手多</text>
  <text x="140" y="430" font-family="${F}" font-size="44" font-weight="700" fill="#a4521f">拆开走最划算</text>
  <text x="140" y="520" font-family="${F}" font-size="80" font-weight="800" fill="#2a2622">到手 ${A.yuan(b.net).replace('.00', '')} 元</text>
  <rect x="140" y="565" width="${segA}" height="40" fill="${COL.A}"/><rect x="${140 + +segA}" y="565" width="${(920 - segA).toFixed(1)}" height="40" fill="${COL.C}"/>
  <text x="140" y="655" font-family="${F}" font-size="28" fill="#575049">${A.kgStr(b.q.A)} 公斤就地卖 · ${A.kgStr(b.q.C)} 公斤${P.pv}成 ${A.gKg(b.q.C * P.yld)} 公斤正好 1 车</text>
  ${rows}
  <text x="140" y="1090" font-family="${F}" font-size="24" fill="#8d857c">${P.name} ${A.kgStr(P.qty)} 公斤 · 市场 ${P.dist} 公里 · 数字是虚构示例 · 价格运费自己填</text>
</svg>`;
fs.writeFileSync('cover.svg', svg);
fs.writeFileSync('cover-shot.html', '<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0}</style></head><body>' + svg + '</body></html>');
console.log('cover.svg', svg.length);
