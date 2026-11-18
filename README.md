# 别给水分付运费

一批鲜货（辣椒、柴、鲜笋……）可以就地卖、原样装车拉到远处卖，也可以先加工（晒干、烧成炭）变轻了再拉。填上价格、运费和出成率，算哪样到手多、怎么拆开走、市场多远以后先加工再拉才合算。

## 文件

- `index.html`：入口（从 `template.html` 产出，见 `build.cjs`）
- `template.html`：HTML 模板，`<script src>` 外链 `core.js` 和 `ui.js`
- `core.js`：计算核心（Node 与浏览器通用）
- `ui.js`：界面（读写 `#` 元素、画 SVG 图表、画结果卡 PNG 1080×1350、四种导出）
- `build.cjs`：构建脚本，把 `template.html` 复制为 `index.html` 并校验外链形式
- `tests/core.test.cjs`：核心测试 13 组（含独立 Python Fraction 暴力穷举对拍 299 组）
- `tests/ref.json`：对拍基准（每组把每一种整数公斤拆法都试一遍，选最优的）
- `tests/ref.py`：生成 `ref.json` 的独立 Python 脚本
- `tests/inject.cjs`：注入测试 21 处抓到 20 处

运行：`node build.cjs && node --test tests/core.test.cjs && node tests/inject.cjs`
