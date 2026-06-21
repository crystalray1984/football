# 「我的」按日分组 + 管理员按日用户收益页 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在一个开发计划内完成两个特性——(F1)「我的」页投注记录按比赛日期分组并展示当日收益；(F2) 仅管理员可见的「按日用户收益」汇总页，入口为比赛列表上的浮动按钮。

**Architecture:** 纯前端聚合（接口已有数据 / F2 新增一个精简只读接口）。F1 引入 `dayKey`/`formatDay`/`formatTime`（format.ts）与 `profitDisplay`/`groupBetsByDay`（bet.ts）；F2 复用它们并新增 `groupUserDailyProfit`（bet.ts）、`isAdmin`（admin.ts）。F2 依赖 F1，故先做 F1（Task 1–5）再做 F2（Task 6–10）。鉴权仅在客户端（白名单）。

**Tech Stack:** uni-app (Vue 3, mp-weixin)、TypeScript、decimal.js、dayjs、vitest；后端 Fastify + sequelize-typescript（Postgres）。

**对应 spec：**
- [F1: my-page-daily-grouping](../specs/2026-06-21-my-page-daily-grouping-design.md)
- [F2: admin-daily-user-profit](../specs/2026-06-21-admin-daily-user-profit-design.md)

---

## 文件结构

**F1（我的页按日分组）**
- `frontend/src/utils/format.ts` —— 新增 `dayKey`/`formatDay`/`formatTime`。
- `frontend/src/utils/format.test.ts` —— 新增用例。
- `frontend/src/utils/bet.ts` —— 新增 `profitDisplay`、`groupBetsByDay` + `BetDayGroup`。
- `frontend/src/utils/bet.test.ts` —— 新增用例。
- `frontend/src/pages/my/MyBetDayGroup.vue` —— 新建（日卡片）。
- `frontend/src/pages/my/MyBetRecord.vue` —— 行内时间改 `formatTime`。
- `frontend/src/pages/my/index.vue` —— 分组渲染 + `total` 复用 `profitDisplay`。

**F2（管理员按日用户收益页）**
- `frontend/src/utils/bet.ts` —— 新增 `groupUserDailyProfit` + `UserDayProfit`/`DailyUserProfit`。
- `frontend/src/utils/bet.test.ts` —— 新增用例。
- `frontend/src/types.d.ts` —— 新增 `AdminBetRow`。
- `frontend/src/utils/admin.ts` —— 新建（`ADMIN_OPENIDS` + `isAdmin`）。
- `frontend/src/pages/match/index.vue` —— 改用 `utils/admin` 的 `isAdmin`。
- `frontend/src/pages/admin/daily/AdminDayCard.vue` —— 新建。
- `frontend/src/pages/admin/daily/index.vue` —— 新建。
- `frontend/src/pages/index/Matches.vue` —— 管理员浮动按钮。
- `frontend/src/pages.json` —— 注册管理员页。
- `server/src/routes.ts` —— 新增 `GET /api/admin/daily-profit`。

> 验证命令：前端单测 `cd frontend && npx vitest run src/utils/`；前端构建 `cd frontend && yarn build`；后端类型检查 `cd server && npx tsc --noEmit`。所有 git 命令在仓库根 `/Users/crystal/Documents/football` 执行；提交信息可能被包装器透明改写，正常。

---

# Feature 1：「我的」页投注记录按日分组

### Task 1: format.ts 新增 `dayKey` / `formatDay` / `formatTime`（TDD）

**Files:**
- Modify: `frontend/src/utils/format.ts`
- Test: `frontend/src/utils/format.test.ts`

- [ ] **Step 1: 写失败测试**

在 `frontend/src/utils/format.test.ts` 顶部 import 里加入 `dayKey, formatDay, formatTime`（与现有 `formatMatchTime` 等并列）。然后在文件末尾追加：

```ts
describe("dayKey", () => {
  it("本地日 YYYY-MM-DD", () =>
    expect(dayKey("2026-06-21T18:00:00")).toBe("2026-06-21"));
});
describe("formatDay", () => {
  it("MM-DD", () => expect(formatDay("2026-06-21")).toBe("06-21"));
});
describe("formatTime", () => {
  it("HH:mm", () => expect(formatTime("2026-06-21T18:05:00")).toBe("18:05"));
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd /Users/crystal/Documents/football/frontend && npx vitest run src/utils/format.test.ts`
Expected: FAIL（`dayKey`/`formatDay`/`formatTime` 未导出）。

- [ ] **Step 3: 实现**

在 `frontend/src/utils/format.ts` 中、`formatMatchTime` 之后追加（`dayjs` 已在文件顶部 import）：

```ts
/**
 * 分组用日期键：本地日 YYYY-MM-DD
 */
export function dayKey(input: string | Date): string {
  return dayjs(input).format("YYYY-MM-DD");
}

/**
 * 日期分组头展示：MM-DD
 */
export function formatDay(key: string): string {
  return dayjs(key).format("MM-DD");
}

/**
 * 行内时间：HH:mm
 */
export function formatTime(input: string | Date): string {
  return dayjs(input).format("HH:mm");
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd /Users/crystal/Documents/football/frontend && npx vitest run src/utils/format.test.ts`
Expected: PASS，无失败用例。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/utils/format.ts frontend/src/utils/format.test.ts
git commit -m "feat: format 新增 dayKey/formatDay/formatTime"
```

---

### Task 2: bet.ts 新增 `profitDisplay`（TDD）

**Files:**
- Modify: `frontend/src/utils/bet.ts`
- Test: `frontend/src/utils/bet.test.ts`

- [ ] **Step 1: 写失败测试**

在 `frontend/src/utils/bet.test.ts` 的 `./bet` import 列表加入 `profitDisplay`。在文件末尾追加：

```ts
describe("profitDisplay", () => {
  it("盈利带 +、win", () =>
    expect(profitDisplay("45")).toEqual({ state: "win", text: "+45" }));
  it("亏损 loss", () =>
    expect(profitDisplay("-20")).toEqual({ state: "loss", text: "-20" }));
  it("持平 flat", () =>
    expect(profitDisplay("0")).toEqual({ state: "flat", text: "0" }));
  it("去末尾 0", () =>
    expect(profitDisplay("95.50")).toEqual({ state: "win", text: "+95.5" }));
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd /Users/crystal/Documents/football/frontend && npx vitest run src/utils/bet.test.ts`
Expected: FAIL（`profitDisplay` 未导出）。

- [ ] **Step 3: 实现**

在 `frontend/src/utils/bet.ts` 末尾追加（`Decimal` 与 `formatMoney` 已在文件顶部 import）：

```ts
/**
 * 收益展示：最多两位小数；正数带 + 记 win、负数 loss、0 flat
 */
export function profitDisplay(amount: string): {
  state: "win" | "loss" | "flat";
  text: string;
} {
  const d = new Decimal(amount);
  const money = formatMoney(amount);
  if (d.gt(0)) return { state: "win", text: `+${money}` };
  if (d.lt(0)) return { state: "loss", text: money };
  return { state: "flat", text: money };
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd /Users/crystal/Documents/football/frontend && npx vitest run src/utils/bet.test.ts`
Expected: PASS，无失败用例。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/utils/bet.ts frontend/src/utils/bet.test.ts
git commit -m "feat: bet 新增 profitDisplay 收益展示工具"
```

---

### Task 3: bet.ts 新增 `groupBetsByDay`（TDD）

**Files:**
- Modify: `frontend/src/utils/bet.ts`（顶部 import 增加 `dayKey`；末尾新增类型与函数）
- Test: `frontend/src/utils/bet.test.ts`

- [ ] **Step 1: 写失败测试**

在 `frontend/src/utils/bet.test.ts` 的 `./bet` import 列表加入 `groupBetsByDay`。在文件末尾追加：

```ts
// 最小 MyBet 夹具：仅分组所需字段
const mb = (match_time: string, result_profit: string | null): MyBet =>
  ({ result_profit, match: { match_time } } as unknown as MyBet);

describe("groupBetsByDay", () => {
  it("空数组", () => expect(groupBetsByDay([])).toEqual([]));
  it("按比赛日分组并按日倒序，组内保持输入顺序", () => {
    const a = mb("2026-06-20T18:00:00", "10");
    const b = mb("2026-06-21T20:00:00", "5");
    const c = mb("2026-06-20T21:00:00", "-3");
    const groups = groupBetsByDay([a, b, c]);
    expect(groups.map((g) => g.date)).toEqual(["2026-06-21", "2026-06-20"]);
    expect(groups[1].bets).toEqual([a, c]);
  });
  it("当日收益排除未结算", () => {
    const groups = groupBetsByDay([
      mb("2026-06-20T18:00:00", "10"),
      mb("2026-06-20T19:00:00", null),
      mb("2026-06-20T20:00:00", "-3"),
    ]);
    expect(groups[0].profit).toBe("7");
  });
  it("跨年区分", () => {
    const groups = groupBetsByDay([
      mb("2025-06-21T18:00:00", "1"),
      mb("2026-06-21T18:00:00", "2"),
    ]);
    expect(groups.map((g) => g.date)).toEqual(["2026-06-21", "2025-06-21"]);
  });
});
```

- [ ] **Step 2: 运行确认失败**

Run: `cd /Users/crystal/Documents/football/frontend && npx vitest run src/utils/bet.test.ts`
Expected: FAIL（`groupBetsByDay` 未导出）。

- [ ] **Step 3: 实现**

在 `frontend/src/utils/bet.ts` 顶部，把 `import { formatMoney, handicap } from "./format";` 改为：

```ts
import { dayKey, formatMoney, handicap } from "./format";
```

在文件末尾追加（`sumSettledProfit` 已在本文件定义，`MyBet` 为全局类型）：

```ts
export interface BetDayGroup {
  /** 分组键，YYYY-MM-DD（比赛本地日） */
  date: string;
  /** 当日已结算净盈亏 */
  profit: string;
  bets: MyBet[];
}

/**
 * 按比赛日期分组投注记录；组按日倒序，组内保持输入顺序。
 */
export function groupBetsByDay(bets: MyBet[]): BetDayGroup[] {
  const map = new Map<string, MyBet[]>();
  for (const bet of bets) {
    const key = dayKey(bet.match.match_time);
    const arr = map.get(key);
    if (arr) arr.push(bet);
    else map.set(key, [bet]);
  }
  const groups: BetDayGroup[] = [];
  for (const [date, dayBets] of map) {
    groups.push({ date, profit: sumSettledProfit(dayBets), bets: dayBets });
  }
  groups.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return groups;
}
```

- [ ] **Step 4: 运行确认通过**

Run: `cd /Users/crystal/Documents/football/frontend && npx vitest run src/utils/bet.test.ts`
Expected: PASS，无失败用例。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/utils/bet.ts frontend/src/utils/bet.test.ts
git commit -m "feat: bet 新增 groupBetsByDay 按日分组"
```

---

### Task 4: `MyBetDayGroup.vue` + `MyBetRecord.vue` 行内时间改 `formatTime`

**Files:**
- Create: `frontend/src/pages/my/MyBetDayGroup.vue`
- Modify: `frontend/src/pages/my/MyBetRecord.vue`

- [ ] **Step 1: 改 `MyBetRecord.vue` 时间格式**

在 `frontend/src/pages/my/MyBetRecord.vue`：把 import 行
```ts
import { formatMatchTime } from "@/utils/format";
```
改为
```ts
import { formatTime } from "@/utils/format";
```
把模板里的
```html
        >{{ formatMatchTime(bet.match.match_time) }} ·
```
改为
```html
        >{{ formatTime(bet.match.match_time) }} ·
```
（其余不变。）

- [ ] **Step 2: 创建 `MyBetDayGroup.vue`**

新建 `frontend/src/pages/my/MyBetDayGroup.vue`：

```vue
<script setup lang="ts">
import { profitDisplay, type BetDayGroup } from "@/utils/bet";
import { formatDay } from "@/utils/format";
import { computed, type PropType } from "vue";
import MyBetRecord from "./MyBetRecord.vue";

const props = defineProps({
  group: {
    type: Object as PropType<BetDayGroup>,
    required: true,
  },
});

const summary = computed(() => profitDisplay(props.group.profit));
</script>

<template>
  <view class="day-group">
    <view class="day-head">
      <text class="day-date">{{ formatDay(group.date) }}</text>
      <text class="day-sum" :class="summary.state">{{ summary.text }}</text>
    </view>
    <view class="day-body">
      <MyBetRecord
        v-for="bet in group.bets"
        :key="bet.id"
        :bet="bet"
        class="record-item"
      />
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import "../../styles/tokens.scss";
.day-group {
  background: $c-card;
  border: 2rpx solid $c-border;
  border-radius: 24rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
}
.day-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 26rpx;
  border-bottom: 2rpx solid $c-line;
}
.day-date {
  font-size: 24rpx;
  color: $c-text2;
}
.day-sum {
  font-size: 28rpx;
  font-weight: 600;
}
.day-sum.win {
  color: $c-green-bright;
}
.day-sum.loss {
  color: $c-red;
}
.day-sum.flat {
  color: $c-text2;
}
.record-item {
  border-bottom: 2rpx solid $c-line;
}
.record-item:last-child {
  border-bottom: none;
}
</style>
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/pages/my/MyBetDayGroup.vue frontend/src/pages/my/MyBetRecord.vue
git commit -m "feat: 新增 MyBetDayGroup 日卡片，记录行改为只显示时间"
```

> 说明：本任务无单测；编译校验在 Task 5 的 `yarn build` 统一进行。

---

### Task 5: `pages/my/index.vue` 分组渲染 + `total` 复用 `profitDisplay` + 构建校验

**Files:**
- Modify: `frontend/src/pages/my/index.vue`

- [ ] **Step 1: 用以下完整内容替换 `frontend/src/pages/my/index.vue`**

```vue
<script setup lang="ts">
import { api, getToken } from "@/api";
import { groupBetsByDay, profitDisplay, sumSettledProfit } from "@/utils/bet";
import { onShareAppMessage, onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import MyBetDayGroup from "./MyBetDayGroup.vue";

const bets = ref<MyBet[]>([]);

/**
 * 每次进入刷新；未登录不请求接口
 */
const refresh = async () => {
  if (!getToken()) {
    bets.value = [];
    return;
  }
  try {
    const ret = await api<MyBet[]>({ url: "/api/my/bets" });
    if (ret.code === 0) {
      bets.value = ret.data || [];
    }
  } catch (e) {
    uni.showToast({ title: "网络异常，请重试", icon: "none" });
  }
};

/**
 * 合计收益（已结算净盈亏之和）
 */
const total = computed(() => profitDisplay(sumSettledProfit(bets.value)));

/**
 * 按比赛日期分组
 */
const groups = computed(() => groupBetsByDay(bets.value));

/**
 * 未结算笔数
 */
const pendingCount = computed(
  () => bets.value.filter((b) => b.result_profit === null).length,
);

onShow(() => {
  refresh();
});

onShareAppMessage(() => {
  return {};
});
</script>

<template>
  <view class="mine">
    <view class="summary">
      <text class="summary-label">合计收益</text>
      <text class="summary-value" :class="total.state">{{ total.text }}</text>
      <text v-if="pendingCount > 0" class="summary-tip"
        >未结算 {{ pendingCount }} 笔不计入</text
      >
    </view>

    <view class="sec-head">
      <text class="sec-title"><text class="bar gray" />投注记录</text>
    </view>

    <view v-if="groups.length > 0">
      <MyBetDayGroup v-for="g in groups" :key="g.date" :group="g" />
    </view>
    <view v-else class="rec-empty">暂无投注记录</view>
  </view>
</template>

<style lang="scss" scoped>
@import "../../styles/tokens.scss";

.mine {
  padding: 24rpx;
}

.summary {
  background: $c-card;
  border: 2rpx solid $c-border;
  border-radius: 24rpx;
  padding: 48rpx 28rpx;
  text-align: center;
  margin-bottom: 28rpx;
}
.summary-label {
  display: block;
  font-size: 24rpx;
  color: $c-text2;
}
.summary-value {
  display: block;
  margin-top: 12rpx;
  font-size: 72rpx;
  font-weight: 600;
  color: $c-text;
}
.summary-value.win {
  color: $c-green-bright;
}
.summary-value.loss {
  color: $c-red;
}
.summary-value.flat {
  color: $c-text;
}
.summary-tip {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: $c-text3;
}

.sec-head {
  display: flex;
  align-items: center;
  margin: 0 4rpx 14rpx;
}
.sec-title {
  display: flex;
  align-items: center;
  font-size: 26rpx;
  color: $c-text;
}
.bar {
  width: 6rpx;
  height: 24rpx;
  background: $c-green;
  border-radius: 4rpx;
  margin-right: 12rpx;
}
.bar.gray {
  background: $c-text2;
}

.rec-empty {
  text-align: center;
  color: $c-text2;
  font-size: 24rpx;
  padding: 80rpx 0;
}
</style>
```

- [ ] **Step 2: 构建确认 F1 编译通过**

Run: `cd /Users/crystal/Documents/football/frontend && yarn build`
Expected: 构建成功（输出 `dist/build/mp-weixin`），无编译错误。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/pages/my/index.vue
git commit -m "feat: 我的页投注记录按日分组展示"
```

---

# Feature 2：管理员「按日用户收益」汇总页

### Task 6: `AdminBetRow` 类型 + bet.ts 新增 `groupUserDailyProfit`（TDD）

**Files:**
- Modify: `frontend/src/types.d.ts`（新增 `AdminBetRow`）
- Modify: `frontend/src/utils/bet.ts`（新增类型与函数）
- Test: `frontend/src/utils/bet.test.ts`

- [ ] **Step 1: 新增 `AdminBetRow` 全局类型**

在 `frontend/src/types.d.ts` 末尾追加：

```ts
/**
 * 管理员按日收益页：单条已结算投注（精简投影）
 */
declare interface AdminBetRow {
  openid: string;
  name: string;
  match_time: string;
  result_profit: string;
}
```

- [ ] **Step 2: 写失败测试**

在 `frontend/src/utils/bet.test.ts` 的 `./bet` import 列表加入 `groupUserDailyProfit`。在文件末尾追加：

```ts
const row = (
  openid: string,
  name: string,
  match_time: string,
  result_profit: string,
): AdminBetRow => ({ openid, name, match_time, result_profit });

describe("groupUserDailyProfit", () => {
  it("空数组", () => expect(groupUserDailyProfit([])).toEqual([]));
  it("单日多用户按收益倒序，含当日合计", () => {
    expect(
      groupUserDailyProfit([
        row("o1", "张三", "2026-06-21T18:00:00", "120"),
        row("o2", "李四", "2026-06-21T20:00:00", "-150"),
      ]),
    ).toEqual([
      {
        date: "2026-06-21",
        total: "-30",
        users: [
          { name: "张三", profit: "120" },
          { name: "李四", profit: "-150" },
        ],
      },
    ]);
  });
  it("同用户多笔累加", () => {
    const g = groupUserDailyProfit([
      row("o1", "张三", "2026-06-21T18:00:00", "120"),
      row("o1", "张三", "2026-06-21T21:00:00", "-20"),
    ]);
    expect(g[0].users).toEqual([{ name: "张三", profit: "100" }]);
    expect(g[0].total).toBe("100");
  });
  it("多日按日倒序", () => {
    const g = groupUserDailyProfit([
      row("o1", "张三", "2026-06-20T18:00:00", "10"),
      row("o1", "张三", "2026-06-21T18:00:00", "5"),
    ]);
    expect(g.map((d) => d.date)).toEqual(["2026-06-21", "2026-06-20"]);
  });
  it("同名不同 openid 区分", () => {
    const g = groupUserDailyProfit([
      row("o1", "张三", "2026-06-21T18:00:00", "10"),
      row("o2", "张三", "2026-06-21T19:00:00", "20"),
    ]);
    expect(g[0].users.length).toBe(2);
    expect(g[0].total).toBe("30");
  });
});
```

- [ ] **Step 3: 运行确认失败**

Run: `cd /Users/crystal/Documents/football/frontend && npx vitest run src/utils/bet.test.ts`
Expected: FAIL（`groupUserDailyProfit` 未导出）。

- [ ] **Step 4: 实现**

在 `frontend/src/utils/bet.ts` 末尾追加（`dayKey` 已在 Task 3 加入顶部 import，`Decimal` 已 import）：

```ts
export interface UserDayProfit {
  name: string;
  profit: string;
}
export interface DailyUserProfit {
  date: string;
  total: string;
  users: UserDayProfit[];
}

/**
 * 管理员页：按比赛日 → 用户 汇总已结算净收益。
 * 日按倒序；组内用户按当日收益倒序；total = 当日所有用户之和。
 */
export function groupUserDailyProfit(rows: AdminBetRow[]): DailyUserProfit[] {
  const byDay = new Map<string, Map<string, { name: string; sum: Decimal }>>();
  for (const r of rows) {
    const date = dayKey(r.match_time);
    let users = byDay.get(date);
    if (!users) {
      users = new Map();
      byDay.set(date, users);
    }
    const u = users.get(r.openid);
    if (u) u.sum = u.sum.add(r.result_profit);
    else users.set(r.openid, { name: r.name, sum: new Decimal(r.result_profit) });
  }
  const result: DailyUserProfit[] = [];
  for (const [date, users] of byDay) {
    const list = [...users.values()].map((u) => ({
      name: u.name,
      profit: u.sum.toString(),
    }));
    list.sort((a, b) => new Decimal(b.profit).comparedTo(a.profit));
    const total = list
      .reduce((acc, u) => acc.add(u.profit), new Decimal(0))
      .toString();
    result.push({ date, total, users: list });
  }
  result.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  return result;
}
```

- [ ] **Step 5: 运行确认通过**

Run: `cd /Users/crystal/Documents/football/frontend && npx vitest run src/utils/bet.test.ts`
Expected: PASS，无失败用例。

- [ ] **Step 6: 提交**

```bash
git add frontend/src/types.d.ts frontend/src/utils/bet.ts frontend/src/utils/bet.test.ts
git commit -m "feat: bet 新增 groupUserDailyProfit 按日用户收益聚合"
```

---

### Task 7: `utils/admin.ts` + `match/index.vue` 改用 `isAdmin`

**Files:**
- Create: `frontend/src/utils/admin.ts`
- Modify: `frontend/src/pages/match/index.vue`

- [ ] **Step 1: 创建 `utils/admin.ts`**

新建 `frontend/src/utils/admin.ts`：

```ts
import { getToken } from "@/api";

/** 管理员 openid 白名单（仅客户端鉴权） */
export const ADMIN_OPENIDS = [
  "oc2fT5Oit4YpELFxpp2kTqSPKVis",
  "oc2fT5KZcBTUOm7Flb_OIwxIpKwk",
];

/** 当前登录用户是否管理员 */
export function isAdmin(): boolean {
  return ADMIN_OPENIDS.includes(getToken());
}
```

- [ ] **Step 2: `match/index.vue` 改用共享 `isAdmin`**

在 `frontend/src/pages/match/index.vue`：

把
```ts
import { api, getToken } from "@/api";
```
改为
```ts
import { api } from "@/api";
```
（如该文件其他地方仍用到 `getToken`，则保留 `getToken`；当前仅管理员判断用到。）

新增一行 import（与其它 `@/utils/...` import 并列）：
```ts
import { isAdmin } from "@/utils/admin";
```

删除这两行：
```ts
const ADMIN = ["oc2fT5Oit4YpELFxpp2kTqSPKVis", "oc2fT5KZcBTUOm7Flb_OIwxIpKwk"];
const isAdmin = ADMIN.includes(getToken());
```

把 `toggleEmulate` 里的判断从 `if (isAdmin)` 改为 `if (isAdmin())`：
```ts
const toggleEmulate = () => {
  if (isAdmin()) {
    emulateScore.active = !emulateScore.active;
  }
};
```

- [ ] **Step 3: 构建确认编译通过**

Run: `cd /Users/crystal/Documents/football/frontend && yarn build`
Expected: 构建成功，无编译错误（确认 `match/index.vue` 重构后仍正常）。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/utils/admin.ts frontend/src/pages/match/index.vue
git commit -m "feat: 新增 utils/admin（isAdmin 白名单单点），比赛详情改用之"
```

---

### Task 8: 后端 `GET /api/admin/daily-profit`

**Files:**
- Modify: `server/src/routes.ts`

- [ ] **Step 1: 引入 `Op`**

在 `server/src/routes.ts` 顶部新增 import：
```ts
import { Op } from "sequelize";
```

- [ ] **Step 2: 新增 `getDailyProfit` handler**

在 `server/src/routes.ts` 的 `getMyBets` 函数之后（`bet` 函数之前）新增（`Bet`/`Match`/`User` 已从 `./db` import）：

```ts
/**
 * 管理员：全部用户的已结算投注（精简投影），前端按日/用户聚合。
 * 注意：仅客户端做管理员鉴权，本接口不做服务端鉴权（与其它读接口一致）。
 */
async function getDailyProfit(_req: FastifyRequest, reply: FastifyReply) {
  const bets = await Bet.findAll({
    where: { result_profit: { [Op.not]: null } },
    include: [
      { model: User, as: "user", attributes: ["name"] },
      { model: Match, as: "match", attributes: ["match_time"], required: true },
    ],
  });

  const data = bets.map((b) => ({
    openid: b.openid,
    name: b.user?.name ?? "",
    match_time: b.match!.match_time,
    result_profit: b.result_profit,
  }));

  reply.send({ code: 0, data });
}
```

- [ ] **Step 3: 注册路由**

在 `routes(app)` 内、`app.get("/api/my/bets", getMyBets);` 之后新增：
```ts
  app.get("/api/admin/daily-profit", getDailyProfit);
```

- [ ] **Step 4: 类型检查通过**

Run: `cd /Users/crystal/Documents/football/server && npx tsc --noEmit`
Expected: 无输出、退出码 0。

- [ ] **Step 5: 提交**

```bash
git add server/src/routes.ts
git commit -m "feat: 新增 /api/admin/daily-profit 接口"
```

---

### Task 9: `AdminDayCard.vue` + 管理员页 + 注册路由

**Files:**
- Create: `frontend/src/pages/admin/daily/AdminDayCard.vue`
- Create: `frontend/src/pages/admin/daily/index.vue`
- Modify: `frontend/src/pages.json`

- [ ] **Step 1: 创建 `AdminDayCard.vue`**

新建 `frontend/src/pages/admin/daily/AdminDayCard.vue`（注意 SCSS 路径为三层 `../../../`）：

```vue
<script setup lang="ts">
import { profitDisplay, type DailyUserProfit } from "@/utils/bet";
import { formatDay } from "@/utils/format";
import { computed, type PropType } from "vue";

const props = defineProps({
  group: {
    type: Object as PropType<DailyUserProfit>,
    required: true,
  },
});

const summary = computed(() => profitDisplay(props.group.total));
</script>

<template>
  <view class="day-group">
    <view class="day-head">
      <text class="day-date">{{ formatDay(group.date) }}</text>
      <text class="day-sum" :class="summary.state">{{ summary.text }}</text>
    </view>
    <view class="day-body">
      <view v-for="(u, i) in group.users" :key="i" class="user-row">
        <text class="user-name">{{ u.name }}</text>
        <text class="user-profit" :class="profitDisplay(u.profit).state">{{
          profitDisplay(u.profit).text
        }}</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import "../../../styles/tokens.scss";
.day-group {
  background: $c-card;
  border: 2rpx solid $c-border;
  border-radius: 24rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
}
.day-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 26rpx;
  border-bottom: 2rpx solid $c-line;
}
.day-date {
  font-size: 24rpx;
  color: $c-text2;
}
.day-sum {
  font-size: 28rpx;
  font-weight: 600;
}
.day-sum.win {
  color: $c-green-bright;
}
.day-sum.loss {
  color: $c-red;
}
.day-sum.flat {
  color: $c-text2;
}
.user-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 26rpx;
  border-bottom: 2rpx solid $c-line;
}
.user-row:last-child {
  border-bottom: none;
}
.user-name {
  font-size: 28rpx;
  color: $c-text;
}
.user-profit {
  font-size: 28rpx;
  font-weight: 500;
}
.user-profit.win {
  color: $c-green-bright;
}
.user-profit.loss {
  color: $c-red;
}
.user-profit.flat {
  color: $c-text2;
}
</style>
```

- [ ] **Step 2: 创建管理员页 `pages/admin/daily/index.vue`**

新建 `frontend/src/pages/admin/daily/index.vue`：

```vue
<script setup lang="ts">
import { api } from "@/api";
import { isAdmin } from "@/utils/admin";
import { groupUserDailyProfit } from "@/utils/bet";
import { onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import AdminDayCard from "./AdminDayCard.vue";

const rows = ref<AdminBetRow[]>([]);

const refresh = async () => {
  try {
    const ret = await api<AdminBetRow[]>({ url: "/api/admin/daily-profit" });
    if (ret.code === 0) {
      rows.value = ret.data || [];
    }
  } catch (e) {
    uni.showToast({ title: "网络异常，请重试", icon: "none" });
  }
};

const groups = computed(() => groupUserDailyProfit(rows.value));

onShow(() => {
  if (!isAdmin()) {
    uni.showToast({ title: "无权限", icon: "none" });
    setTimeout(() => uni.navigateBack(), 800);
    return;
  }
  refresh();
});
</script>

<template>
  <view class="admin-daily">
    <view v-if="groups.length > 0">
      <AdminDayCard v-for="g in groups" :key="g.date" :group="g" />
    </view>
    <view v-else class="empty">暂无数据</view>
  </view>
</template>

<style lang="scss" scoped>
@import "../../../styles/tokens.scss";
.admin-daily {
  padding: 24rpx;
}
.empty {
  text-align: center;
  color: $c-text2;
  font-size: 24rpx;
  padding: 80rpx 0;
}
</style>
```

- [ ] **Step 3: 在 `pages.json` 注册管理员页**

把 `frontend/src/pages.json` 的 `pages` 数组追加一项（放在 `pages/my/index` 之后；**不要**加进 `tabBar`）：

```json
    {
      "path": "pages/admin/daily/index",
      "style": {
        "navigationBarTitleText": "用户收益"
      }
    }
```

即 `pages` 数组变为 index、match、my、admin/daily 四项；`tabBar` 与 `globalStyle` 不变。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/pages/admin/daily/AdminDayCard.vue frontend/src/pages/admin/daily/index.vue frontend/src/pages.json
git commit -m "feat: 新增管理员按日用户收益页并注册路由"
```

> 说明：本任务无单测；编译校验在 Task 10 的 `yarn build` 统一进行。

---

### Task 10: 比赛列表浮动管理员按钮 + 整体构建

**Files:**
- Modify: `frontend/src/pages/index/Matches.vue`

- [ ] **Step 1: `Matches.vue` 新增管理员浮动按钮**

在 `frontend/src/pages/index/Matches.vue` 的 `<script setup>`：

新增 import：
```ts
import { isAdmin } from "@/utils/admin";
```
新增跳转方法（与 `goDetail` 并列）：
```ts
const goSummary = () => {
  uni.navigateTo({ url: "/pages/admin/daily/index" });
};
```

在模板根 `<view class="match-list">` 内、`暂无比赛` 空态之后（仍在 `.match-list` 内部、闭合 `</view>` 之前）新增浮动按钮：
```html
    <view v-if="isAdmin()" class="fab" @click="goSummary">收益</view>
```

在 `<style scoped>` 末尾新增：
```scss
.fab {
  position: fixed;
  right: 32rpx;
  bottom: 140rpx;
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: $c-green;
  color: #06231a;
  font-size: 26rpx;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.35);
  z-index: 50;
}
```

- [ ] **Step 2: 整体构建确认编译通过**

Run: `cd /Users/crystal/Documents/football/frontend && yarn build`
Expected: 构建成功（编译管理员页、`AdminDayCard`、`Matches` 浮动按钮等），无编译错误。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/pages/index/Matches.vue
git commit -m "feat: 比赛列表新增管理员浮动入口（按日用户收益）"
```

- [ ] **Step 4: 微信开发者工具手动验证**

导入 `frontend/dist/build/mp-weixin`，核对：
- **F1**：「我的」页投注记录按比赛日期分成多张日卡片；每张卡片组头显示 `MM-DD` 与当日收益（着色），记录行只显示 `HH:mm`；顶部「合计收益」与未登录/空态不变。
- **F2**：管理员账号在「比赛列表」右下角看到浮动「收益」按钮（非管理员看不到）；点击进入「用户收益」页，按日卡片展示每个用户当日收益与当日合计；空数据显示「暂无数据」。
- 金额均「最多两位小数」。

---

## 自检

**1. Spec 覆盖**

F1：
- 按比赛日期分组 → Task 3（`groupBetsByDay`）+ Task 5（渲染）✓
- 当日汇总收益（仅已结算）→ Task 3（`profit=sumSettledProfit`）+ Task 4（组头展示）✓
- 分组按日倒序、组内原顺序 → Task 3（排序/插入序）✓
- 行内时间改 `HH:mm` → Task 1（`formatTime`）+ Task 4（MyBetRecord）✓
- 合计卡片/空态不变 → Task 5 ✓

F2：
- 按日 → 用户 汇总收益 → Task 6（`groupUserDailyProfit`）✓
- 组头当日合计 → Task 6（`total`）+ Task 9（`AdminDayCard`）✓
- 仅已结算 → Task 8（`Op.not null`）✓
- 浮动按钮、仅管理员可见 → Task 10（`v-if="isAdmin()"`）✓
- 仅客户端鉴权 → Task 7（`isAdmin`）+ Task 8（接口无鉴权）✓
- 入口在比赛列表 → Task 10 ✓
- 页面注册 → Task 9（pages.json）✓

**2. 占位符扫描**：无 TBD/TODO，代码步骤均含完整代码。✓

**3. 类型/命名一致性**：
- `BetDayGroup`（Task 3 定义）↔ `MyBetDayGroup` prop（Task 4）一致。✓
- `profitDisplay`（Task 2）被 Task 4/5/9 复用，签名一致。✓
- `dayKey`（Task 1）被 `groupBetsByDay`（Task 3）、`groupUserDailyProfit`（Task 6）复用。✓
- `AdminBetRow`（Task 6 全局）↔ 接口投影字段（Task 8：openid/name/match_time/result_profit）一致。✓
- `DailyUserProfit`/`UserDayProfit`（Task 6）↔ `AdminDayCard` prop（Task 9）一致。✓
- `isAdmin`（Task 7）被 Task 9/10 复用，且 Task 7 重构 `match/index.vue`。✓
