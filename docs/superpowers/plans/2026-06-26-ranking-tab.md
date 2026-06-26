# 「排行」Tab 页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增一个所有登录用户可见的「排行」tab 页，展示全部下注人员的累计收益 / 胜率排行（后端预聚合，前端用 Decimal 排序 + 渲染）。

**Architecture:** 后端新增 `GET /api/rank`，对有效投注（`result∈{1,-1}`）按 `openid` 用 Decimal 预聚合，返回每人一行 `{ name, winRate(百分比数值), profit(Decimal字符串) }`。前端只做两件事：用 `decimal.js` 在「收益 / 胜率」间切换主排序（恒倒序，副指标兜底 + 名称稳定），并把胜率拼上 `%` 渲染。新增一个 tab 页与对应灰/绿图标。

**Tech Stack:** uni-app（Vue3 + TS，mp-weixin）+ vitest 前端；Fastify + sequelize-typescript + PostgreSQL 后端；`decimal.js`（前后端均已安装）。

## Global Constraints

- 沟通与注释一律**简体中文**（见 [CLAUDE.md](../../../CLAUDE.md)）。
- 金额 / 比较一律用 `decimal.js`，**禁止**用 JS 原生浮点做金额运算或数值排序。
- **口径**：仅有效投注 `result === 1 || result === -1`；`胜 = result===1`；胜率 = 胜数/有效数×100，保留 **1 位小数**；收益 = 有效投注 `result_profit` 之和。走水/平局（`result===0`）、未结算（`null`）不计入。
- 接口**无服务端鉴权**（与现有 `/api/*` 读接口一致）。
- 空名兜底显示「匿名」；样式复用 [tokens.scss](../../../frontend/src/styles/tokens.scss)。
- tabBar 顺序：**主页 | 排行 | 我的**；表格**严格三列**（名称 / 胜率 / 收益），无名次列、无前三高亮。
- 所有 shell 命令的工作目录在调用间会保持，命令里统一用绝对路径 `cd`。仓库根：`/Users/crystal/Documents/Projects/football`。

---

## File Structure

| 文件 | 职责 | 动作 |
|---|---|---|
| `frontend/src/utils/format.ts` | 新增 `formatPercent` 百分比渲染 | 改 |
| `frontend/src/utils/format.test.ts` | `formatPercent` 单测 | 改 |
| `frontend/src/types.d.ts` | 新增全局 `RankRow` 类型 | 改 |
| `frontend/src/utils/bet.ts` | 新增 `RankSortKey` + `sortRanking` 排序纯函数 | 改 |
| `frontend/src/utils/bet.test.ts` | `sortRanking` 单测 | 改 |
| `server/src/routes.ts` | 新增 `getRank` 聚合接口 + 注册路由 | 改 |
| `frontend/src/static/tabbar/rank.png` `rank-active.png` | tab 图标（灰 / 绿，81×81） | 新建 |
| `frontend/src/pages/rank/index.vue` | 排行页（取数 + 列头切换排序 + 三列渲染） | 新建 |
| `frontend/src/pages.json` | 注册页 + tabBar 中间插入排行项 | 改 |

依赖顺序：Task 1、2 互相独立（先做纯函数，TDD）→ Task 3 后端接口 → Task 4 图标（Task 6 引用）→ Task 5 页面（Task 6 注册）→ Task 6 接入 tabBar。

---

### Task 1: `formatPercent` 百分比渲染（format.ts）

**Files:**
- Modify: `frontend/src/utils/format.ts`
- Test: `frontend/src/utils/format.test.ts`

**Interfaces:**
- Consumes: `decimal.js`（format.ts 已 `import Decimal from "decimal.js"`）。
- Produces: `export function formatPercent(n: number): string` —— 入参为百分比数值（不含 %），输出保留 1 位小数并拼 `%`。

- [ ] **Step 1: 写失败测试**

在 [format.test.ts](../../../frontend/src/utils/format.test.ts) 顶部 import 列表加入 `formatPercent`（与现有 `} from "./format";` 同一处），并在文件末尾追加：

```ts
describe("formatPercent", () => {
  it("一位小数原样", () => expect(formatPercent(66.7)).toBe("66.7%"));
  it("整数补一位小数", () => expect(formatPercent(50)).toBe("50.0%"));
  it("100", () => expect(formatPercent(100)).toBe("100.0%"));
  it("0", () => expect(formatPercent(0)).toBe("0.0%"));
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd /Users/crystal/Documents/Projects/football/frontend && npx vitest run src/utils/format.test.ts`
Expected: FAIL —— `formatPercent is not a function` / 导入报错。

- [ ] **Step 3: 实现**

在 [format.ts](../../../frontend/src/utils/format.ts) 末尾追加：

```ts
/**
 * 百分比渲染：保留 1 位小数并拼 %（如 66.7 → "66.7%"，50 → "50.0%"）
 */
export function formatPercent(n: number): string {
  return new Decimal(n).toFixed(1) + "%";
}
```

- [ ] **Step 4: 运行测试，确认通过**

Run: `cd /Users/crystal/Documents/Projects/football/frontend && npx vitest run src/utils/format.test.ts`
Expected: PASS（含新增 4 条）。

- [ ] **Step 5: 提交**

```bash
cd /Users/crystal/Documents/Projects/football && git add frontend/src/utils/format.ts frontend/src/utils/format.test.ts && git commit -m "feat: 新增 formatPercent 百分比渲染工具

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `RankRow` 类型 + `sortRanking` 排序纯函数（types.d.ts + bet.ts）

**Files:**
- Modify: `frontend/src/types.d.ts`（新增全局 `RankRow`）
- Modify: `frontend/src/utils/bet.ts`（新增 `RankSortKey` + `sortRanking`）
- Test: `frontend/src/utils/bet.test.ts`

**Interfaces:**
- Consumes: `decimal.js`（bet.ts 已 `import Decimal from "decimal.js"`）；全局 `RankRow`。
- Produces:
  - 全局类型 `RankRow { name: string; winRate: number; profit: string }`。
  - `export type RankSortKey = "profit" | "winRate"`。
  - `export function sortRanking(rows: RankRow[], sortKey: RankSortKey): RankRow[]` —— 恒倒序；主指标相同按副指标倒序，再相同按 `name` 升序稳定；不修改入参数组。

- [ ] **Step 1: 写失败测试**

在 [bet.test.ts](../../../frontend/src/utils/bet.test.ts) 顶部 import 列表加入 `sortRanking`（与现有 `} from "./bet";` 同一处），并在文件末尾追加：

```ts
describe("sortRanking", () => {
  const mk = (name: string, winRate: number, profit: string): RankRow => ({
    name,
    winRate,
    profit,
  });

  it("空数组返回空", () => expect(sortRanking([], "profit")).toEqual([]));

  it("收益倒序为主", () => {
    const rows = [mk("A", 50, "10"), mk("B", 50, "30"), mk("C", 50, "20")];
    expect(sortRanking(rows, "profit").map((r) => r.name)).toEqual(["B", "C", "A"]);
  });

  it("收益相同按胜率副指标倒序", () => {
    const rows = [mk("A", 40, "10"), mk("B", 80, "10"), mk("C", 60, "10")];
    expect(sortRanking(rows, "profit").map((r) => r.name)).toEqual(["B", "C", "A"]);
  });

  it("胜率倒序为主", () => {
    const rows = [mk("A", 40, "10"), mk("B", 80, "10"), mk("C", 60, "10")];
    expect(sortRanking(rows, "winRate").map((r) => r.name)).toEqual(["B", "C", "A"]);
  });

  it("胜率相同按收益副指标倒序", () => {
    const rows = [mk("A", 50, "10"), mk("B", 50, "30"), mk("C", 50, "20")];
    expect(sortRanking(rows, "winRate").map((r) => r.name)).toEqual(["B", "C", "A"]);
  });

  it("主副指标都相同按名称升序稳定", () => {
    const rows = [mk("Bob", 50, "10"), mk("Ann", 50, "10")];
    expect(sortRanking(rows, "profit").map((r) => r.name)).toEqual(["Ann", "Bob"]);
  });

  it("收益按数值而非字典序（Decimal）", () => {
    const rows = [mk("A", 50, "9"), mk("B", 50, "100")];
    expect(sortRanking(rows, "profit").map((r) => r.name)).toEqual(["B", "A"]);
  });

  it("负收益排在正收益之后", () => {
    const rows = [mk("A", 50, "-5"), mk("B", 50, "5"), mk("C", 50, "0")];
    expect(sortRanking(rows, "profit").map((r) => r.name)).toEqual(["B", "C", "A"]);
  });

  it("不修改入参数组", () => {
    const rows = [mk("A", 10, "10"), mk("B", 20, "20")];
    const copy = [...rows];
    sortRanking(rows, "profit");
    expect(rows).toEqual(copy);
  });
});
```

- [ ] **Step 2: 运行测试，确认失败**

Run: `cd /Users/crystal/Documents/Projects/football/frontend && npx vitest run src/utils/bet.test.ts`
Expected: FAIL —— `sortRanking is not a function` / 类型 `RankRow` 未定义。

- [ ] **Step 3: 实现类型**

在 [types.d.ts](../../../frontend/src/types.d.ts) 末尾追加：

```ts
/**
 * 排行榜单行（后端预聚合）
 */
declare interface RankRow {
  /** 用户昵称，可能为空 */
  name: string;
  /** 预计算百分比数值，不含 %，1 位小数（如 66.7） */
  winRate: number;
  /** 有效投注净收益之和（Decimal 字符串） */
  profit: string;
}
```

- [ ] **Step 4: 实现排序函数**

在 [bet.ts](../../../frontend/src/utils/bet.ts) 末尾追加：

```ts
export type RankSortKey = "profit" | "winRate";

/**
 * 排行排序：恒倒序；主指标相同按副指标倒序，再相同按 name 升序稳定。
 * 不修改入参数组（复制后排序）；全程用 Decimal 比较，避免浮点/字典序误差。
 */
export function sortRanking(rows: RankRow[], sortKey: RankSortKey): RankRow[] {
  return [...rows].sort((a, b) => {
    const aPrimary = sortKey === "profit" ? a.profit : a.winRate;
    const bPrimary = sortKey === "profit" ? b.profit : b.winRate;
    const primaryCmp = new Decimal(bPrimary).comparedTo(aPrimary); // 倒序
    if (primaryCmp !== 0) return primaryCmp;

    const aSecondary = sortKey === "profit" ? a.winRate : a.profit;
    const bSecondary = sortKey === "profit" ? b.winRate : b.profit;
    const secondaryCmp = new Decimal(bSecondary).comparedTo(aSecondary); // 倒序
    if (secondaryCmp !== 0) return secondaryCmp;

    return a.name.localeCompare(b.name); // 名称升序稳定
  });
}
```

- [ ] **Step 5: 运行测试，确认通过**

Run: `cd /Users/crystal/Documents/Projects/football/frontend && npx vitest run src/utils/bet.test.ts`
Expected: PASS（含新增 9 条）。

- [ ] **Step 6: 提交**

```bash
cd /Users/crystal/Documents/Projects/football && git add frontend/src/types.d.ts frontend/src/utils/bet.ts frontend/src/utils/bet.test.ts && git commit -m "feat: 新增 RankRow 类型与 sortRanking 排行排序

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: 后端排行接口 `GET /api/rank`（routes.ts）

**Files:**
- Modify: `server/src/routes.ts`

**Interfaces:**
- Consumes: `Bet` / `User`（已从 `./db` 引入）、`Op`（已从 `sequelize` 引入）、`Decimal`（已从 `decimal.js` 引入）。
- Produces: `GET /api/rank` 返回 `{ code: 0, data: { name: string; winRate: number; profit: string }[] }`，与前端全局 `RankRow` 对应；无服务端鉴权。

> 说明：server 端无单测 runner，本任务以 `tsc --noEmit` 类型检查 + 代码审阅为门槛；接口实跑由 Task 6 后整体在微信开发者工具中人工验证。

- [ ] **Step 1: 实现 `getRank`**

在 [routes.ts](../../../server/src/routes.ts) 中、`bet` 函数定义之前（紧接 `getDailyProfit` 之后）新增：

```ts
/**
 * 排行榜：全部用户累计收益 / 胜率（后端预聚合，每人一行）。
 * 口径：仅有效投注（result ∈ {1,-1}）；胜率为百分比数值（1 位小数，不含 %）。
 * 与其它读接口一致，不做服务端鉴权。
 */
async function getRank(_req: FastifyRequest, reply: FastifyReply) {
  const bets = await Bet.findAll({
    where: { result: { [Op.in]: [1, -1] } },
    include: [{ model: User, as: "user", attributes: ["name"] }],
    attributes: ["openid", "result", "result_profit"],
  });

  const map = new Map<
    string,
    { name: string; valid: number; win: number; profit: Decimal }
  >();
  for (const b of bets) {
    let u = map.get(b.openid);
    if (!u) {
      u = { name: b.user?.name ?? "", valid: 0, win: 0, profit: new Decimal(0) };
      map.set(b.openid, u);
    }
    u.valid += 1;
    if (b.result === 1) u.win += 1;
    u.profit = u.profit.add(b.result_profit ?? 0);
  }

  const data = [...map.values()].map((u) => ({
    name: u.name,
    winRate: new Decimal(u.win)
      .div(u.valid)
      .mul(100)
      .toDecimalPlaces(1)
      .toNumber(),
    profit: u.profit.toString(),
  }));

  reply.send({ code: 0, data });
}
```

- [ ] **Step 2: 注册路由**

在 [routes.ts](../../../server/src/routes.ts) 的 `export default function routes(app)` 内，`app.get("/api/admin/daily-profit", getDailyProfit);` 之后新增一行：

```ts
  app.get("/api/rank", getRank);
```

- [ ] **Step 3: 类型检查**

Run: `cd /Users/crystal/Documents/Projects/football/server && npx tsc --noEmit -p tsconfig.json && echo OK`
Expected: 仅输出 `OK`，无类型错误。

- [ ] **Step 4: 提交**

```bash
cd /Users/crystal/Documents/Projects/football && git add server/src/routes.ts && git commit -m "feat: 新增 /api/rank 排行接口（有效投注预聚合）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: tab 图标（灰 / 绿，81×81）

**Files:**
- Create: `frontend/src/static/tabbar/rank.png`（`#8a96ac`）
- Create: `frontend/src/static/tabbar/rank-active.png`（`#19c37d`）

**Interfaces:**
- Produces: 两张 81×81 PNG，供 Task 6 在 pages.json 的 tabBar 引用。本机无 PIL/ImageMagick，用纯 Python 标准库（zlib + struct）手写最小 RGBA PNG。

- [ ] **Step 1: 写生成脚本（放 scratchpad，不提交）**

写入 `/private/tmp/claude-501/-Users-crystal-Documents-Projects-football/a7f49899-d7c3-44d6-81b5-e31242a95290/scratchpad/gen_rank_icon.py`：

```python
import zlib, struct

W = H = 81

def make_png(path, rgb):
    r, g, b = rgb
    px = [[(0, 0, 0, 0) for _ in range(W)] for _ in range(H)]  # 透明底 RGBA

    # 三根递增柱（排行/上升），底对齐
    bars = [(16, 14, 46), (34, 14, 32), (52, 14, 18)]  # (x_left, width, top)
    bottom = 64
    for (x0, bw, top) in bars:
        for y in range(top, bottom):
            for x in range(x0, x0 + bw):
                px[y][x] = (r, g, b, 255)
    # 基线
    for x in range(12, 70):
        for y in range(bottom, bottom + 4):
            px[y][x] = (r, g, b, 255)

    raw = bytearray()
    for row in px:
        raw.append(0)  # filter type 0
        for (rr, gg, bb, aa) in row:
            raw += bytes((rr, gg, bb, aa))
    comp = zlib.compress(bytes(raw), 9)

    def chunk(typ, data):
        return (struct.pack(">I", len(data)) + typ + data +
                struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff))

    png = (b"\x89PNG\r\n\x1a\n" +
           chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 6, 0, 0, 0)) +
           chunk(b"IDAT", comp) + chunk(b"IEND", b""))
    with open(path, "wb") as f:
        f.write(png)

base = "/Users/crystal/Documents/Projects/football/frontend/src/static/tabbar"
make_png(base + "/rank.png", (0x8a, 0x96, 0xac))
make_png(base + "/rank-active.png", (0x19, 0xc3, 0x7d))
print("done")
```

- [ ] **Step 2: 运行生成**

Run: `python3 /private/tmp/claude-501/-Users-crystal-Documents-Projects-football/a7f49899-d7c3-44d6-81b5-e31242a95290/scratchpad/gen_rank_icon.py`
Expected: 输出 `done`。

- [ ] **Step 3: 校验尺寸**

Run: `cd /Users/crystal/Documents/Projects/football/frontend/src/static/tabbar && for f in rank.png rank-active.png; do printf "%s: " "$f"; sips -g pixelWidth -g pixelHeight "$f" | grep pixel | awk '{print $2}' | paste -sd'x' -; done`
Expected: 两行均为 `81x81`。

- [ ] **Step 4: 提交**

```bash
cd /Users/crystal/Documents/Projects/football && git add frontend/src/static/tabbar/rank.png frontend/src/static/tabbar/rank-active.png && git commit -m "feat: 新增排行 tab 灰/绿图标

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: 排行页 `pages/rank/index.vue`

**Files:**
- Create: `frontend/src/pages/rank/index.vue`

**Interfaces:**
- Consumes: `api`（`@/api`）、`sortRanking` + `profitDisplay` + `RankSortKey`（`@/utils/bet`）、`formatPercent`（`@/utils/format`）、`onShow`（`@dcloudio/uni-app`）、全局 `RankRow`。
- Produces: 一个 tab 页面组件；Task 6 在 pages.json 注册其路径 `pages/rank/index`。

> 说明：uni-app 页面无单测 harness，本任务门槛为「不破坏既有 vitest 套件 + 代码审阅」，最终视觉/交互在 Task 6 后于微信开发者工具人工验证（列头点击切换排序、默认收益倒序、红绿着色、空态）。

- [ ] **Step 1: 创建页面**

写入 `frontend/src/pages/rank/index.vue`：

```vue
<script setup lang="ts">
import { api } from "@/api";
import { sortRanking, profitDisplay, type RankSortKey } from "@/utils/bet";
import { formatPercent } from "@/utils/format";
import { onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";

const rows = ref<RankRow[]>([]);
const sortKey = ref<RankSortKey>("profit"); // 默认收益倒序

const refresh = async () => {
  try {
    const ret = await api<RankRow[]>({ url: "/api/rank" });
    if (ret.code === 0) {
      rows.value = ret.data || [];
    }
  } catch (e) {
    uni.showToast({ title: "网络异常，请重试", icon: "none" });
  }
};

const sorted = computed(() => sortRanking(rows.value, sortKey.value));

const setSort = (key: RankSortKey) => {
  sortKey.value = key;
};

onShow(() => {
  refresh();
});
</script>

<template>
  <view class="rank">
    <view class="rank-card">
      <view class="head">
        <text class="col-name th">名称</text>
        <text
          class="col-metric th"
          :class="{ active: sortKey === 'winRate' }"
          @click="setSort('winRate')"
          >胜率<text v-if="sortKey === 'winRate'" class="arrow">▼</text></text
        >
        <text
          class="col-metric th"
          :class="{ active: sortKey === 'profit' }"
          @click="setSort('profit')"
          >收益<text v-if="sortKey === 'profit'" class="arrow">▼</text></text
        >
      </view>

      <view v-if="sorted.length > 0" class="body">
        <view v-for="(r, i) in sorted" :key="i" class="row">
          <text class="col-name name">{{ r.name || "匿名" }}</text>
          <text class="col-metric rate">{{ formatPercent(r.winRate) }}</text>
          <text
            class="col-metric profit"
            :class="profitDisplay(r.profit).state"
            >{{ profitDisplay(r.profit).text }}</text
          >
        </view>
      </view>
      <view v-else class="empty">暂无数据</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import "../../styles/tokens.scss";
.rank {
  padding: 24rpx;
}
.rank-card {
  background: $c-card;
  border: 2rpx solid $c-border;
  border-radius: 24rpx;
  overflow: hidden;
}
.head {
  display: flex;
  align-items: center;
  padding: 22rpx 26rpx;
  border-bottom: 2rpx solid $c-line;
}
.th {
  font-size: 24rpx;
  color: $c-text2;
}
.th.active {
  color: $c-green-bright;
}
.arrow {
  margin-left: 6rpx;
  font-size: 20rpx;
}
.col-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.col-metric {
  width: 180rpx;
  text-align: right;
}
.row {
  display: flex;
  align-items: center;
  padding: 24rpx 26rpx;
  border-bottom: 2rpx solid $c-line;
}
.row:last-child {
  border-bottom: none;
}
.name {
  font-size: 28rpx;
  color: $c-text;
}
.rate {
  font-size: 28rpx;
  color: $c-text;
}
.profit {
  font-size: 28rpx;
  font-weight: 500;
}
.profit.win {
  color: $c-green-bright;
}
.profit.loss {
  color: $c-red;
}
.profit.flat {
  color: $c-text2;
}
</style>
```

- [ ] **Step 2: 不破坏既有套件**

Run: `cd /Users/crystal/Documents/Projects/football/frontend && npx vitest run`
Expected: 全部测试文件 PASS（页面新增不应影响 utils 套件）。

- [ ] **Step 3: 提交**

```bash
cd /Users/crystal/Documents/Projects/football && git add frontend/src/pages/rank/index.vue && git commit -m "feat: 新增排行页（列头切换排序 + 三列渲染）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: 注册页面 + tabBar 接入（pages.json）

**Files:**
- Modify: `frontend/src/pages.json`

**Interfaces:**
- Consumes: Task 5 的页面路径 `pages/rank/index`；Task 4 的 `static/tabbar/rank.png` / `rank-active.png`。
- Produces: 「排行」成为第二个 tab（主页 | 排行 | 我的）。

- [ ] **Step 1: 在 `pages` 数组注册页面**

在 [pages.json](../../../frontend/src/pages.json) 的 `pages` 数组中、`pages/my/index` 项之后追加（注意逗号）：

```json
    {
      "path": "pages/rank/index",
      "style": {
        "navigationBarTitleText": "排行"
      }
    }
```

- [ ] **Step 2: 在 `tabBar.list` 中间插入排行项**

在 [pages.json](../../../frontend/src/pages.json) 的 `tabBar.list` 中，**主页项与我的项之间**插入：

```json
      {
        "pagePath": "pages/rank/index",
        "text": "排行",
        "iconPath": "static/tabbar/rank.png",
        "selectedIconPath": "static/tabbar/rank-active.png"
      },
```

修改后 `tabBar.list` 顺序应为：主页 → 排行 → 我的。

- [ ] **Step 3: 校验 JSON 合法**

Run: `cd /Users/crystal/Documents/Projects/football/frontend && node -e "JSON.parse(require('fs').readFileSync('src/pages.json','utf8')); console.log('JSON OK')"`
Expected: 输出 `JSON OK`。

- [ ] **Step 4: 全量单测仍绿**

Run: `cd /Users/crystal/Documents/Projects/football/frontend && npx vitest run`
Expected: 全部 PASS。

- [ ] **Step 5: 提交**

```bash
cd /Users/crystal/Documents/Projects/football && git add frontend/src/pages.json && git commit -m "feat: 排行页接入 tabBar（主页|排行|我的）

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 6: 人工冒烟（微信开发者工具）**

启动 `cd /Users/crystal/Documents/Projects/football/frontend && npm run dev`，用微信开发者工具打开 `dist/dev/mp-weixin`，确认：
1. 底部出现「排行」tab（居中），图标灰/绿切换正常；
2. 进入排行页默认按**收益倒序**；点「胜率」切换为胜率倒序，列头 `▼` 高亮跟随；
3. 收益正绿负红、空名显示「匿名」；无数据时显示「暂无数据」。

---

## Self-Review

**1. Spec coverage：**

| Spec 要求 | 对应任务 |
|---|---|
| 新增「排行」tab，主页\|排行\|我的 | Task 4（图标）+ Task 6（tabBar） |
| 严格三列 名称/胜率/收益 | Task 5 |
| 口径：有效投注 result∈{1,-1} | Task 3 |
| 胜率=胜/有效×100，1 位小数数值 | Task 3（算）+ Task 1（渲染） |
| 收益=有效投注 result_profit 之和（Decimal） | Task 3 |
| 无有效投注者不列出 | Task 3（聚合源即有效投注） |
| 前端排序，可切胜率/收益，默认收益倒序 | Task 2 + Task 5 |
| 前端排序用 decimal.js + 副指标兜底 | Task 2 |
| 后端预聚合，胜率为预算百分比数值 | Task 3 |
| 空名兜底「匿名」 | Task 5 |

无缺口。

**2. Placeholder scan：** 无 TBD/TODO；每个代码步骤均给出完整代码与可运行命令及预期输出。

**3. Type consistency：** `RankRow { name:string; winRate:number; profit:string }` 在 types.d.ts（Task 2）定义，被 `sortRanking`（Task 2）、页面（Task 5）、后端 `data`（Task 3，结构对齐）一致使用；`RankSortKey = "profit"|"winRate"`（Task 2）在页面 `sortKey`（Task 5）一致；`profitDisplay` / `formatPercent` 签名与既有/新增定义一致。

---

## 不做（YAGNI）

- 服务端鉴权（公开榜）。
- 名次列 / 前三高亮 / 投注次数列。
- 升降序切换（只切主指标，恒倒序）。
- 分页 / 关键字筛选 / 时间范围。
- 后端 SQL `GROUP BY`（先 JS 聚合，规模大再优化）。
