# 足球投注小程序前端实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在已有 uni-app（mp-weixin）骨架上，按"午夜盘口"深色设计实现比赛列表、比赛详情、投注弹层三画面，并修复 4 处阻塞后端 bug。

**Architecture:** 把可单测的纯逻辑（时间/让球/金额格式化、盘口文案映射、预计可赢、金额校验、结算展示）抽到 `src/utils/`，用 vitest 做 TDD；Vue 组件与小程序 API 胶水层用完整代码实现 + 微信开发者工具手动验证；后端仅做最小一行级修复，用 `tsc --noEmit` 把关。设计 token 收敛到 `src/styles/tokens.scss`，赔率按钮抽成可复用 `OddsButton.vue`，投注弹层抽成 `BetSheet.vue`。

**Tech Stack:** uni-app 3 + Vue 3 `<script setup>` + TypeScript + SCSS（`rpx`）；dayjs、decimal.js；vitest（新增，仅测纯逻辑）；后端 Fastify + sequelize-typescript。

**设计依据:** `docs/superpowers/specs/2026-06-20-football-betting-frontend-design.md`

**单位换算:** 设计稿 px → 小程序 rpx 约 ×2（750/375 基准）。

---

## 文件结构

后端（最小修复）
- Modify: `server/src/db/models/Bet.ts` — `@HasOne` → `@BelongsTo`，使 `include:[User]` 能取到投注人
- Modify: `server/src/routes.ts` — 路由绑定、判空取反、首投 `Decimal(null)` 守卫

前端 · 配置与类型
- Create: `frontend/vitest.config.ts` — vitest 配置（仅 node 环境跑纯逻辑）
- Modify: `frontend/package.json` — 增加 vitest 依赖与 `test` 脚本
- Modify: `frontend/src/types.d.ts` — `Match` 比分改可空、新增 `MatchDetail` / `BetRecord`
- Modify: `frontend/src/pages.json` — 深色壳层 + 详情页标题
- Create: `frontend/src/styles/tokens.scss` — 深色设计 token（SCSS 变量）

前端 · 纯逻辑（TDD）
- Create: `frontend/src/utils/format.ts` + `frontend/src/utils/format.test.ts`
- Create: `frontend/src/utils/bet.ts` + `frontend/src/utils/bet.test.ts`

前端 · 组件
- Create: `frontend/src/pages/match/OddsButton.vue` — 可复用赔率按钮
- Create: `frontend/src/pages/match/BetSheet.vue` — 底部投注弹层
- Modify: `frontend/src/pages/index/Matches.vue` — 比赛列表 UI
- Modify: `frontend/src/pages/match/index.vue` — 比赛详情页

---

## Task 1: 后端最小修复

**Files:**
- Modify: `server/src/db/models/Bet.ts:45`
- Modify: `server/src/routes.ts`（`getMatchDetail` / `getMatchBets` / `bet` / `routes`）

- [ ] **Step 1: 修复 Bet↔User 关联方向**

`server/src/db/models/Bet.ts` 顶部 import 里把 `HasOne` 换成 `BelongsTo`：

```ts
import {
  AllowNull,
  AutoIncrement,
  BelongsTo,
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  Table,
  UpdatedAt,
} from "sequelize-typescript";
```

把第 45 行的关联声明改为 `BelongsTo`（外键 `openid` 在 Bet 上，指向 `User.openid`）：

```ts
  /**
   * 用户信息
   */
  @BelongsTo(() => User, { foreignKey: "openid", targetKey: "openid", as: "user" })
  declare user?: User;
```

- [ ] **Step 2: 修复 routes.ts 判空取反 + 路由绑定 + 首投守卫**

在 `server/src/routes.ts` 内做以下替换。

`getMatchDetail` 中：

```ts
  if (isNaN(match_id) || match_id <= 0) {
```

`getMatchBets` 中（同样的判断）：

```ts
  if (isNaN(match_id) || match_id <= 0) {
```

`bet` 中的 `match_id` 判断：

```ts
  if (isNaN(match_id) || match_id <= 0 || !Number.isSafeInteger(match_id)) {
```

`bet` 中的 `amount` 判断：

```ts
  if (
    isNaN(amount) ||
    !Number.isSafeInteger(amount) ||
    amount < config.min_bet ||
    amount > config.max_bet
  ) {
```

`bet` 中单场累计求和后的 `Decimal` 守卫（首投时 `sum` 为 `null`）：

```ts
  //判断单场比赛此用户总金额
  const sum = await Bet.sum("amount", { where: { match_id, openid } });
  if (Decimal(sum || 0).add(amount).gt(config.max_bet)) {
```

`routes()` 末尾路由表中把 `/api/match/bets` 绑到正确处理器：

```ts
  app.get("/api/match/bets", getMatchBets);
```

`getMatchBets` 里把 `include: [User]` 改为带别名形式，保证序列化出来的 key 是 `user`（与 Bet.ts 的 `as:"user"` 一致），否则前端 `bet.user?.name` 取不到：

```ts
  const bets = await Bet.findAll({
    where: {
      match_id,
    },
    include: [{ model: User, as: "user" }],
    order: [["id", "desc"]],
  });
```

- [ ] **Step 3: 类型检查通过**

Run: `cd server && npx tsc --noEmit`
Expected: 无错误退出（exit 0）。

- [ ] **Step 4: 提交**

```bash
git add server/src/db/models/Bet.ts server/src/routes.ts
git commit -m "fix(server): 修复投注记录关联、判空取反与首投崩溃"
```

---

## Task 2: 前端测试设施 + 类型补齐

**Files:**
- Create: `frontend/vitest.config.ts`
- Modify: `frontend/package.json`
- Modify: `frontend/src/types.d.ts`

- [ ] **Step 1: 安装 vitest**

Run: `cd frontend && yarn add -D vitest@^1.6.0`
Expected: `package.json` 的 devDependencies 出现 `vitest`，无安装错误。

- [ ] **Step 2: 增加 test 脚本**

`frontend/package.json` 的 `scripts` 增加一行：

```json
  "scripts": {
    "dev": "uni -p mp-weixin",
    "build": "uni build -p mp-weixin",
    "test": "vitest run"
  },
```

- [ ] **Step 3: 创建 vitest 配置**

Create `frontend/vitest.config.ts`（不加载 uni 插件，仅测纯逻辑；解析 `@` 别名）：

```ts
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
```

- [ ] **Step 4: 补齐前端类型**

`frontend/src/types.d.ts` 中把 `Match` 的比分改为可空，并在文件末尾追加 `MatchDetail` 与 `BetRecord`。

把 `Match` 接口里的：

```ts
  /**
   * 主队得分
   */
  score1: number | null;
  /**
   * 客队得分
   */
  score2: number | null;
```

在文件末尾追加：

```ts
/**
 * 比赛详情（含盘口）
 */
declare interface MatchDetail extends Match {
  /** 让球数（主队） */
  ah_condition: string;
  /** 让球主队水位 */
  ah1_value: string;
  /** 让球客队水位 */
  ah2_value: string;
  /** 是否开放胜平负 1/0 */
  win_open: number;
  /** 主胜赔率 */
  win1_value: string;
  /** 客胜赔率 */
  win2_value: string;
  /** 平局赔率 */
  draw_value: string;
}

/**
 * 投注记录
 */
declare interface BetRecord {
  id: number;
  type: "ah1" | "ah2" | "win1" | "win2" | "draw";
  /** 盘口 */
  condition: string;
  /** 赔率 */
  value: string;
  /** 投注金额 */
  amount: string;
  /** 赛果（结算后非空） */
  result: number | null;
  /** 结算净盈亏（未结算为 null） */
  result_profit: string | null;
  /** 投注人 */
  user?: { name: string };
}
```

- [ ] **Step 5: 验证测试命令可运行**

Run: `cd frontend && yarn test`
Expected: vitest 提示 "No test files found"（尚未写测试），但命令本身正常退出。

- [ ] **Step 6: 提交**

```bash
git add frontend/package.json frontend/yarn.lock frontend/vitest.config.ts frontend/src/types.d.ts
git commit -m "chore(frontend): 接入 vitest 并补齐 MatchDetail/BetRecord 类型"
```

---

## Task 3: 格式化工具（TDD）

**Files:**
- Create: `frontend/src/utils/format.ts`
- Test: `frontend/src/utils/format.test.ts`

- [ ] **Step 1: 写失败测试**

Create `frontend/src/utils/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  formatHandicap,
  formatMatchTime,
  formatMoney,
  matchStatusText,
} from "./format";

describe("formatMatchTime", () => {
  it("统一输出 MM-DD HH:mm，无相对日期", () => {
    expect(formatMatchTime("2026-08-15T23:00:00")).toBe("08-15 23:00");
  });
});

describe("formatHandicap", () => {
  it("正数带 +", () => expect(formatHandicap("0.5")).toBe("+0.5"));
  it("负数保留 -", () => expect(formatHandicap("-0.5")).toBe("-0.5"));
  it("零显示 0", () => expect(formatHandicap("0")).toBe("0"));
  it("四分盘", () => expect(formatHandicap("-0.25")).toBe("-0.25"));
});

describe("formatMoney", () => {
  it("两位小数", () => expect(formatMoney("95")).toBe("95.00"));
  it("接受数字", () => expect(formatMoney(50)).toBe("50.00"));
});

describe("matchStatusText", () => {
  it("pending", () => expect(matchStatusText("pending")).toBe("可投注"));
  it("playing", () => expect(matchStatusText("playing")).toBe("进行中"));
  it("end", () => expect(matchStatusText("end")).toBe("已结束"));
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && yarn test src/utils/format.test.ts`
Expected: FAIL，报 `./format` 模块不存在。

- [ ] **Step 3: 实现 format.ts**

Create `frontend/src/utils/format.ts`:

```ts
import dayjs from "dayjs";
import Decimal from "decimal.js";

/**
 * 比赛时间统一格式 MM-DD HH:mm（不使用相对日期）
 */
export function formatMatchTime(input: string | Date): string {
  return dayjs(input).format("MM-DD HH:mm");
}

/**
 * 让球数格式化：正数加 +，负数保留 -，0 显示 0
 */
export function formatHandicap(condition: string | number | Decimal): string {
  const d = new Decimal(condition);
  if (d.gt(0)) return "+" + d.toString();
  return d.toString();
}

/**
 * 金额格式化：两位小数
 */
export function formatMoney(amount: string | number | Decimal): string {
  return new Decimal(amount).toFixed(2);
}

/**
 * 状态文案
 */
export function matchStatusText(
  state: "pending" | "playing" | "end",
): string {
  switch (state) {
    case "pending":
      return "可投注";
    case "playing":
      return "进行中";
    default:
      return "已结束";
  }
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && yarn test src/utils/format.test.ts`
Expected: PASS（全部用例绿色）。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/utils/format.ts frontend/src/utils/format.test.ts
git commit -m "feat(frontend): 新增格式化工具（时间/让球/金额/状态）"
```

---

## Task 4: 投注逻辑工具（TDD）

**Files:**
- Create: `frontend/src/utils/bet.ts`
- Test: `frontend/src/utils/bet.test.ts`

- [ ] **Step 1: 写失败测试**

Create `frontend/src/utils/bet.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  betCondition,
  directionLabel,
  MAX_BET,
  MIN_BET,
  oddsValue,
  potentialWin,
  recordOddsText,
  settlement,
  validateAmount,
} from "./bet";

const match = {
  team1_name: "曼城",
  team2_name: "利物浦",
  ah_condition: "-0.5",
  ah1_value: "0.95",
  ah2_value: "0.88",
  win1_value: "2.10",
  win2_value: "3.05",
  draw_value: "3.20",
};

describe("directionLabel", () => {
  it("让球主队带让球数", () => expect(directionLabel("ah1", match)).toBe("曼城 -0.5"));
  it("让球客队取反让球数", () => expect(directionLabel("ah2", match)).toBe("利物浦 +0.5"));
  it("胜=主队名", () => expect(directionLabel("win1", match)).toBe("曼城"));
  it("负=客队名", () => expect(directionLabel("win2", match)).toBe("利物浦"));
  it("平=平局", () => expect(directionLabel("draw", match)).toBe("平局"));
});

describe("oddsValue", () => {
  it("ah1", () => expect(oddsValue("ah1", match)).toBe("0.95"));
  it("draw", () => expect(oddsValue("draw", match)).toBe("3.20"));
});

describe("potentialWin", () => {
  it("让球=本金×水位", () => expect(potentialWin("ah1", 100, "0.95")).toBe("95.00"));
  it("胜平负=本金×(赔率-1)", () => expect(potentialWin("win1", 100, "2.10")).toBe("110.00"));
  it("空金额为0", () => expect(potentialWin("win1", 0, "2.10")).toBe("0.00"));
});

describe("betCondition", () => {
  it("ah1=让球数", () => expect(betCondition("ah1", match)).toBe("-0.5"));
  it("ah2=取反让球数", () => expect(betCondition("ah2", match)).toBe("0.5"));
  it("胜平负占位 0", () => expect(betCondition("draw", match)).toBe("0"));
});

describe("validateAmount", () => {
  it("范围内整数有效", () => expect(validateAmount(100)).toBe(true));
  it("低于下限无效", () => expect(validateAmount(MIN_BET - 1)).toBe(false));
  it("高于上限无效", () => expect(validateAmount(MAX_BET + 1)).toBe(false));
  it("非整数无效", () => expect(validateAmount(100.5)).toBe(false));
});

describe("recordOddsText", () => {
  it("让球主队", () =>
    expect(recordOddsText({ type: "ah1", condition: "-0.5", value: "0.95" }, match)).toBe(
      "让球 曼城 -0.5 @0.95",
    ));
  it("让球客队", () =>
    expect(recordOddsText({ type: "ah2", condition: "0.5", value: "0.88" }, match)).toBe(
      "让球 利物浦 +0.5 @0.88",
    ));
  it("主胜", () =>
    expect(recordOddsText({ type: "win1", condition: "0", value: "2.10" }, match)).toBe(
      "曼城 胜 @2.10",
    ));
  it("平局", () =>
    expect(recordOddsText({ type: "draw", condition: "0", value: "3.20" }, match)).toBe(
      "平局 @3.20",
    ));
});

describe("settlement", () => {
  it("未结算", () =>
    expect(settlement({ result_profit: null })).toEqual({ state: "pending", text: "待结算" }));
  it("盈利", () =>
    expect(settlement({ result_profit: "95" })).toEqual({ state: "win", text: "+95.00" }));
  it("亏损", () =>
    expect(settlement({ result_profit: "-50" })).toEqual({ state: "loss", text: "-50.00" }));
  it("持平", () =>
    expect(settlement({ result_profit: "0" })).toEqual({ state: "flat", text: "0.00" }));
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend && yarn test src/utils/bet.test.ts`
Expected: FAIL，报 `./bet` 模块不存在。

- [ ] **Step 3: 实现 bet.ts**

Create `frontend/src/utils/bet.ts`:

```ts
import Decimal from "decimal.js";
import { formatHandicap } from "./format";

export type BetType = "ah1" | "ah2" | "win1" | "win2" | "draw";

export const MIN_BET = 50;
export const MAX_BET = 500;

interface MarketMatch {
  team1_name: string;
  team2_name: string;
  ah_condition: string;
}

interface OddsMatch {
  ah1_value: string;
  ah2_value: string;
  win1_value: string;
  win2_value: string;
  draw_value: string;
}

/**
 * 是否让球盘（亚盘）
 */
export function isAsian(type: BetType): boolean {
  return type === "ah1" || type === "ah2";
}

/**
 * 投注方向 → 按钮标题（用队名）
 */
export function directionLabel(type: BetType, match: MarketMatch): string {
  switch (type) {
    case "ah1":
      return `${match.team1_name} ${formatHandicap(match.ah_condition)}`;
    case "ah2":
      return `${match.team2_name} ${formatHandicap(
        new Decimal(0).sub(match.ah_condition),
      )}`;
    case "win1":
      return match.team1_name;
    case "win2":
      return match.team2_name;
    default:
      return "平局";
  }
}

/**
 * 投注方向 → 对应赔率/水位
 */
export function oddsValue(type: BetType, match: OddsMatch): string {
  switch (type) {
    case "ah1":
      return match.ah1_value;
    case "ah2":
      return match.ah2_value;
    case "win1":
      return match.win1_value;
    case "win2":
      return match.win2_value;
    default:
      return match.draw_value;
  }
}

/**
 * 预计可赢（纯盈利）：让球=本金×水位；胜平负=本金×(赔率-1)
 */
export function potentialWin(
  type: BetType,
  amount: string | number,
  value: string,
): string {
  const a = new Decimal(amount || 0);
  if (isAsian(type)) return a.mul(value).toFixed(2);
  return a.mul(new Decimal(value).sub(1)).toFixed(2);
}

/**
 * 下注 condition：ah1=让球数；ah2=取反；胜平负="0" 占位
 */
export function betCondition(type: BetType, match: MarketMatch): string {
  if (type === "ah1") return new Decimal(match.ah_condition).toString();
  if (type === "ah2") return new Decimal(0).sub(match.ah_condition).toString();
  return "0";
}

/**
 * 金额校验：50-500 的整数
 */
export function validateAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount >= MIN_BET && amount <= MAX_BET;
}

/**
 * 投注记录盘口文案
 */
export function recordOddsText(
  bet: { type: BetType; condition: string; value: string },
  match: { team1_name: string; team2_name: string },
): string {
  switch (bet.type) {
    case "ah1":
      return `让球 ${match.team1_name} ${formatHandicap(bet.condition)} @${bet.value}`;
    case "ah2":
      return `让球 ${match.team2_name} ${formatHandicap(bet.condition)} @${bet.value}`;
    case "win1":
      return `${match.team1_name} 胜 @${bet.value}`;
    case "win2":
      return `${match.team2_name} 胜 @${bet.value}`;
    default:
      return `平局 @${bet.value}`;
  }
}

export type SettlementState = "pending" | "win" | "loss" | "flat";

/**
 * 结算展示（口径为假设：result_profit 为净盈亏，null=未结算）
 */
export function settlement(bet: {
  result_profit: string | null;
}): { state: SettlementState; text: string } {
  if (bet.result_profit === null || bet.result_profit === undefined) {
    return { state: "pending", text: "待结算" };
  }
  const p = new Decimal(bet.result_profit);
  if (p.gt(0)) return { state: "win", text: "+" + p.toFixed(2) };
  if (p.lt(0)) return { state: "loss", text: p.toFixed(2) };
  return { state: "flat", text: p.toFixed(2) };
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd frontend && yarn test src/utils/bet.test.ts`
Expected: PASS（全部用例绿色）。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/utils/bet.ts frontend/src/utils/bet.test.ts
git commit -m "feat(frontend): 新增投注逻辑工具（标签/可赢/condition/校验/结算）"
```

---

## Task 5: 深色 token + 小程序壳层

**Files:**
- Create: `frontend/src/styles/tokens.scss`
- Modify: `frontend/src/pages.json`

- [ ] **Step 1: 创建设计 token**

Create `frontend/src/styles/tokens.scss`:

```scss
$c-bg: #0e1320;
$c-nav: #141b2c;
$c-card: #18202f;
$c-line: #222a3a;
$c-line2: #2c3852;
$c-border: #232c40;
$c-text: #e8edf6;
$c-text2: #8a96ac;
$c-text3: #5d6b85;
$c-green: #19c37d;
$c-green-bright: #4ade80;
$c-odds: #202a3d;
$c-odds-text: #9be15d;
$c-gold: #f5b431;
$c-red: #f76b6b;
```

- [ ] **Step 2: pages.json 深色壳层 + 详情标题**

把 `frontend/src/pages.json` 整体替换为：

```json
{
  "pages": [
    {
      "path": "pages/index/index",
      "style": {}
    },
    {
      "path": "pages/match/index",
      "style": {
        "navigationBarTitleText": "比赛详情"
      }
    }
  ],
  "globalStyle": {
    "navigationBarTextStyle": "white",
    "navigationBarTitleText": "足球竞猜",
    "navigationBarBackgroundColor": "#141b2c",
    "backgroundColor": "#0e1320"
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add frontend/src/styles/tokens.scss frontend/src/pages.json
git commit -m "feat(frontend): 午夜盘口深色 token 与小程序壳层配置"
```

---

## Task 6: 可复用赔率按钮 OddsButton

**Files:**
- Create: `frontend/src/pages/match/OddsButton.vue`

- [ ] **Step 1: 实现 OddsButton.vue**

Create `frontend/src/pages/match/OddsButton.vue`:

```vue
<script setup lang="ts">
defineProps<{
  /** 按钮标题（队名/平局，可含让球数） */
  label: string;
  /** 赔率/水位 */
  value: string;
  /** 是否选中（弹层内高亮） */
  selected?: boolean;
  /** 是否封盘禁用 */
  disabled?: boolean;
}>();

const emit = defineEmits<{ click: [] }>();

function onTap() {
  // 透传点击，禁用态不响应
  emit("click");
}
</script>

<template>
  <view
    class="odds-btn"
    :class="{ 'is-selected': selected, 'is-disabled': disabled }"
    @click="!disabled && onTap()"
  >
    <text v-if="selected" class="check">✓</text>
    <view class="label">{{ label }}</view>
    <view class="value">{{ value }}</view>
  </view>
</template>

<style lang="scss" scoped>
@import "../../styles/tokens.scss";

.odds-btn {
  width: 100%;
  min-width: 0;
  position: relative;
  background: $c-odds;
  border: 2rpx solid $c-line2;
  border-radius: 16rpx;
  padding: 20rpx 8rpx;
  box-sizing: border-box;
  text-align: center;
}

.odds-btn.is-selected {
  border-color: $c-green;
  background: rgba(25, 195, 125, 0.14);
}

.odds-btn.is-disabled {
  opacity: 0.45;
}

.check {
  position: absolute;
  top: 6rpx;
  right: 12rpx;
  font-size: 22rpx;
  color: $c-green-bright;
}

.label {
  width: 100%;
  font-size: 24rpx;
  line-height: 1.25;
  color: $c-text2;
  overflow: hidden;
  text-overflow: ellipsis;
  /* autoprefixer: ignore next */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.value {
  margin-top: 6rpx;
  font-size: 34rpx;
  font-weight: 500;
  color: $c-odds-text;
}

.odds-btn.is-selected .value {
  color: $c-green-bright;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/pages/match/OddsButton.vue
git commit -m "feat(frontend): 可复用赔率按钮 OddsButton"
```

---

## Task 7: 比赛列表 Matches.vue

**Files:**
- Modify: `frontend/src/pages/index/Matches.vue`

- [ ] **Step 1: 重写 Matches.vue（补全模板 + 样式 + 跳转）**

把 `frontend/src/pages/index/Matches.vue` 整体替换为：

```vue
<script setup lang="ts">
import { api } from "@/api";
import { ref, watch } from "vue";
import { formatMatchTime, matchStatusText } from "@/utils/format";

const props = defineProps({
  /** 当前页面是否激活 */
  active: {
    type: Boolean,
    default: false,
  },
});

/** 比赛列表 */
const matches = ref<Match[]>([]);

/** 读取比赛列表 */
const getList = async () => {
  const ret = await api<Match[]>({ url: "/api/match/list" });
  if (!ret.code) {
    matches.value = ret.data;
  }
};

const goDetail = (id: number) => {
  uni.navigateTo({ url: `/pages/match/index?match_id=${id}` });
};

let timer: any;

watch(
  () => props.active,
  (active) => {
    if (active) {
      getList();
      timer = setInterval(getList, 10000);
    } else {
      clearInterval(timer);
    }
  },
  { immediate: true },
);
</script>

<template>
  <view class="match-list">
    <view
      v-for="m in matches"
      :key="m.id"
      class="match-card"
      @click="goDetail(m.id)"
    >
      <view class="row-top">
        <text class="time">{{ formatMatchTime(m.match_time) }}</text>
        <text class="status" :class="m.state">{{ matchStatusText(m.state) }}</text>
      </view>
      <view class="row-teams">
        <text class="team">{{ m.team1_name }}</text>
        <text v-if="m.has_score && m.score1 !== null" class="score">
          {{ m.score1 }} : {{ m.score2 }}
        </text>
        <text v-else class="vs">VS</text>
        <text class="team team-right">{{ m.team2_name }}</text>
        <text class="chevron">›</text>
      </view>
    </view>

    <view v-if="matches.length === 0" class="empty">暂无比赛</view>
  </view>
</template>

<style lang="scss" scoped>
@import "../../styles/tokens.scss";

.match-list {
  padding: 24rpx;
}

.match-card {
  background: $c-card;
  border: 2rpx solid $c-border;
  border-radius: 24rpx;
  padding: 24rpx 28rpx;
  margin-bottom: 20rpx;
}

.row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22rpx;
}

.time {
  font-size: 24rpx;
  color: $c-text2;
}

.status {
  font-size: 22rpx;
  padding: 6rpx 18rpx;
  border-radius: 40rpx;
}
.status.pending {
  background: rgba(25, 195, 125, 0.16);
  color: $c-green-bright;
}
.status.playing {
  background: rgba(245, 180, 49, 0.16);
  color: $c-gold;
}
.status.end {
  background: $c-line;
  color: $c-text2;
}

.row-teams {
  display: flex;
  align-items: center;
}

.team {
  flex: 1;
  min-width: 0;
  font-size: 32rpx;
  font-weight: 500;
  color: $c-text;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.team-right {
  text-align: right;
}

.vs {
  padding: 0 24rpx;
  font-size: 24rpx;
  color: $c-text3;
}

.score {
  padding: 0 20rpx;
  font-size: 36rpx;
  font-weight: 500;
  color: $c-text;
}

.chevron {
  margin-left: 12rpx;
  font-size: 32rpx;
  color: $c-text3;
}

.empty {
  text-align: center;
  color: $c-text2;
  font-size: 26rpx;
  padding: 80rpx 0;
}
</style>
```

- [ ] **Step 2: 手动验证（微信开发者工具）**

Run: `cd frontend && yarn dev`，用微信开发者工具打开 `dist/dev/mp-weixin`。
Expected：登录后进入列表；卡片为深色，状态胶囊颜色随 可投注/进行中/已结束 变化；已结束显示中性白比分，其余显示 VS；时间为 `MM-DD HH:mm`；点卡片跳转详情页（暂为空白）。无报错。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/pages/index/Matches.vue
git commit -m "feat(frontend): 比赛列表深色 UI 与详情跳转"
```

---

## Task 8: 投注弹层 BetSheet.vue

**Files:**
- Create: `frontend/src/pages/match/BetSheet.vue`

- [ ] **Step 1: 实现 BetSheet.vue**

Create `frontend/src/pages/match/BetSheet.vue`:

```vue
<script setup lang="ts">
import { computed, ref, watch } from "vue";
import OddsButton from "./OddsButton.vue";
import { formatHandicap } from "@/utils/format";
import {
  betCondition,
  directionLabel,
  isAsian,
  oddsValue,
  potentialWin,
  validateAmount,
  type BetType,
} from "@/utils/bet";

const props = defineProps<{
  visible: boolean;
  match: MatchDetail;
  /** 唤起时点击的方向 */
  type: BetType;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [{ type: BetType; amount: number; condition: string }];
}>();

const quickAmounts = [50, 100, 200, 500];

const selected = ref<BetType>(props.type);
const amountInput = ref("");
// 打开弹层时对盘口做快照：轮询不改动弹层内已展示赔率，下注也用快照值（盘口变化交后端 -2 兜底）
const snap = ref<MatchDetail>(props.match);

watch(
  () => props.visible,
  (v) => {
    if (v) {
      selected.value = props.type;
      amountInput.value = "";
      snap.value = JSON.parse(JSON.stringify(props.match));
    }
  },
);

/** 该弹层展示的方向组 */
const group = computed<BetType[]>(() =>
  isAsian(props.type) ? ["ah1", "ah2"] : ["win1", "draw", "win2"],
);
const isAh = computed(() => isAsian(props.type));

const amount = computed(() => parseInt(amountInput.value || "0", 10) || 0);
const valid = computed(() => validateAmount(amount.value));
const win = computed(() =>
  potentialWin(selected.value, amount.value, oddsValue(selected.value, snap.value)),
);

const subtitle = computed(() => {
  const base = `${snap.value.team1_name} VS ${snap.value.team2_name}`;
  if (isAh.value) {
    return `${base} · 让球 ${snap.value.team1_name} ${formatHandicap(
      snap.value.ah_condition,
    )}`;
  }
  return base;
});

function onInput(e: any) {
  amountInput.value = String(e.detail.value).replace(/[^\d]/g, "");
}
function pick(v: number) {
  amountInput.value = String(v);
}
function confirm() {
  if (!valid.value) return;
  emit("confirm", {
    type: selected.value,
    amount: amount.value,
    condition: betCondition(selected.value, snap.value),
  });
}

function btnLabel(t: BetType): string {
  return directionLabel(t, snap.value);
}
function btnValue(t: BetType): string {
  return oddsValue(t, snap.value);
}
</script>

<template>
  <view v-if="visible" class="sheet-mask" @click="emit('close')">
    <view class="sheet" @click.stop>
      <view class="grabber" />

      <view class="head">
        <text class="title">投注 · {{ isAh ? "让球盘" : "胜平负" }}</text>
        <text class="close" @click="emit('close')">✕</text>
      </view>
      <text class="subtitle">{{ subtitle }}</text>

      <view class="group" :class="{ three: !isAh }">
        <view v-for="t in group" :key="t" class="cell">
          <OddsButton
            :label="btnLabel(t)"
            :value="btnValue(t)"
            :selected="selected === t"
            @click="selected = t"
          />
        </view>
      </view>

      <text class="field-label">投注金额</text>
      <view class="amount-box">
        <text class="yen">¥</text>
        <input
          class="amount-input"
          type="number"
          :value="amountInput"
          placeholder="50 - 500"
          placeholder-style="color: #5d6b85"
          @input="onInput"
        />
        <text class="limit">限 50 - 500</text>
      </view>

      <view class="chips">
        <text
          v-for="q in quickAmounts"
          :key="q"
          class="chip"
          :class="{ active: amount === q }"
          @click="pick(q)"
        >
          {{ q }}
        </text>
      </view>

      <view class="win-row">
        <text class="win-label">预计可赢</text>
        <text class="win-value">¥{{ win }}</text>
      </view>

      <view class="confirm" :class="{ disabled: !valid }" @click="confirm">
        确认投注
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import "../../styles/tokens.scss";

.sheet-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 100;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.sheet {
  background: #161d2c;
  border-top: 2rpx solid $c-border;
  border-radius: 36rpx 36rpx 0 0;
  padding: 28rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
}

.grabber {
  width: 72rpx;
  height: 8rpx;
  background: $c-line2;
  border-radius: 40rpx;
  margin: 0 auto 28rpx;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title {
  font-size: 30rpx;
  font-weight: 500;
  color: $c-text;
}
.close {
  font-size: 34rpx;
  color: $c-text2;
}
.subtitle {
  display: block;
  margin: 8rpx 0 28rpx;
  font-size: 24rpx;
  color: $c-text2;
}

.group {
  display: flex;
  gap: 20rpx;
  margin-bottom: 36rpx;
}
.cell {
  flex: 1;
  min-width: 0;
}

.field-label {
  display: block;
  font-size: 26rpx;
  color: $c-text;
  margin-bottom: 16rpx;
}

.amount-box {
  display: flex;
  align-items: center;
  background: $c-bg;
  border: 2rpx solid $c-line2;
  border-radius: 16rpx;
  padding: 20rpx 26rpx;
  margin-bottom: 20rpx;
}
.yen {
  font-size: 34rpx;
  color: $c-text2;
  margin-right: 14rpx;
}
.amount-input {
  flex: 1;
  font-size: 38rpx;
  font-weight: 500;
  color: $c-text;
}
.limit {
  font-size: 22rpx;
  color: $c-text3;
}

.chips {
  display: flex;
  gap: 16rpx;
  margin-bottom: 36rpx;
}
.chip {
  flex: 1;
  text-align: center;
  font-size: 26rpx;
  color: #b9c4d6;
  background: $c-odds;
  border: 2rpx solid $c-line2;
  border-radius: 16rpx;
  padding: 14rpx 0;
}
.chip.active {
  color: $c-green-bright;
  background: rgba(25, 195, 125, 0.14);
  border-color: $c-green;
}

.win-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4rpx;
  margin-bottom: 28rpx;
}
.win-label {
  font-size: 24rpx;
  color: $c-text2;
}
.win-value {
  font-size: 30rpx;
  font-weight: 500;
  color: $c-green-bright;
}

.confirm {
  text-align: center;
  background: $c-green;
  color: #06231a;
  font-size: 30rpx;
  font-weight: 500;
  border-radius: 20rpx;
  padding: 26rpx;
}
.confirm.disabled {
  opacity: 0.45;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/pages/match/BetSheet.vue
git commit -m "feat(frontend): 底部投注弹层 BetSheet"
```

---

## Task 9: 比赛详情页 match/index.vue

**Files:**
- Modify: `frontend/src/pages/match/index.vue`

- [ ] **Step 1: 实现详情页（信息卡 + 让球盘 + 胜平负 + 投注记录 + 弹层接线）**

把 `frontend/src/pages/match/index.vue` 整体替换为：

```vue
<script setup lang="ts">
import { api } from "@/api";
import { onHide, onLoad, onShow, onUnload } from "@dcloudio/uni-app";
import { ref } from "vue";
import OddsButton from "./OddsButton.vue";
import BetSheet from "./BetSheet.vue";
import { formatHandicap, formatMatchTime, matchStatusText } from "@/utils/format";
import {
  directionLabel,
  oddsValue,
  recordOddsText,
  settlement,
  type BetType,
} from "@/utils/bet";

const matchId = ref(0);
const match = ref<MatchDetail | null>(null);
const bets = ref<BetRecord[]>([]);

const sheetVisible = ref(false);
const sheetType = ref<BetType>("ah1");

let timer: any;

const refresh = async () => {
  if (!matchId.value) return;
  try {
    const [d, b] = await Promise.all([
      api<MatchDetail>({ url: `/api/match/detail?match_id=${matchId.value}` }),
      api<BetRecord[]>({ url: `/api/match/bets?match_id=${matchId.value}` }),
    ]);
    if (d.code !== 0) {
      uni.showToast({ title: d.msg || "找不到比赛", icon: "none" });
      clearInterval(timer);
      setTimeout(() => uni.navigateBack(), 1200);
      return;
    }
    match.value = d.data;
    if (b.code === 0) bets.value = b.data;
  } catch (e) {
    uni.showToast({ title: "网络异常，请重试", icon: "none" });
  }
};

const startTimer = () => {
  clearInterval(timer);
  timer = setInterval(() => {
    if (match.value?.state === "end") {
      clearInterval(timer);
      return;
    }
    refresh();
  }, 10000);
};

const canBet = () => match.value?.state === "pending";

const openBet = (type: BetType) => {
  if (!canBet()) return;
  sheetType.value = type;
  sheetVisible.value = true;
};

const onConfirm = async (payload: {
  type: BetType;
  amount: number;
  condition: string;
}) => {
  const m = match.value;
  if (!m) return;
  const ret = await api({
    url: "/api/bet",
    method: "POST",
    data: {
      match_id: m.id,
      type: payload.type,
      amount: payload.amount,
      condition: payload.condition,
    },
  });
  if (ret.code === 0) {
    sheetVisible.value = false;
    uni.showToast({ title: "投注成功", icon: "success" });
    refresh();
  } else if (ret.code === -2) {
    uni.showToast({ title: "盘口已变化，请重新下注", icon: "none" });
    refresh();
  } else {
    uni.showToast({ title: ret.msg || "投注失败", icon: "none" });
  }
};

// 模板辅助
const label = (t: BetType) => (match.value ? directionLabel(t, match.value) : "");
const odds = (t: BetType) => (match.value ? oddsValue(t, match.value) : "");
const recText = (bet: BetRecord) =>
  match.value ? recordOddsText(bet, match.value) : "";

onLoad((query) => {
  matchId.value = Number(query?.match_id) || 0;
});
onShow(() => {
  refresh();
  startTimer();
});
onHide(() => clearInterval(timer));
onUnload(() => clearInterval(timer));
</script>

<template>
  <view v-if="match" class="detail">
    <!-- 信息卡 -->
    <view class="info-card">
      <text class="status" :class="match.state">{{ matchStatusText(match.state) }}</text>
      <view class="teams">
        <text class="team">{{ match.team1_name }}</text>
        <text
          v-if="match.has_score && match.score1 !== null"
          class="score"
        >{{ match.score1 }} : {{ match.score2 }}</text>
        <text v-else class="vs">VS</text>
        <text class="team team-right">{{ match.team2_name }}</text>
      </view>
      <text class="time">{{ formatMatchTime(match.match_time) }}</text>
      <text v-if="!canBet()" class="closed">已封盘</text>
    </view>

    <!-- 让球盘 -->
    <view class="sec-head">
      <text class="sec-title"><text class="bar" />让球盘</text>
      <text class="sec-sub">让球 {{ match.team1_name }} {{ formatHandicap(match.ah_condition) }}</text>
    </view>
    <view class="market">
      <view class="cell"><OddsButton :label="label('ah1')" :value="odds('ah1')" :disabled="!canBet()" @click="openBet('ah1')" /></view>
      <view class="cell"><OddsButton :label="label('ah2')" :value="odds('ah2')" :disabled="!canBet()" @click="openBet('ah2')" /></view>
    </view>

    <!-- 胜平负 -->
    <template v-if="match.win_open">
      <view class="sec-head">
        <text class="sec-title"><text class="bar" />胜平负</text>
      </view>
      <view class="market three">
        <view class="cell"><OddsButton :label="label('win1')" :value="odds('win1')" :disabled="!canBet()" @click="openBet('win1')" /></view>
        <view class="cell"><OddsButton :label="label('draw')" :value="odds('draw')" :disabled="!canBet()" @click="openBet('draw')" /></view>
        <view class="cell"><OddsButton :label="label('win2')" :value="odds('win2')" :disabled="!canBet()" @click="openBet('win2')" /></view>
      </view>
    </template>

    <!-- 投注记录 -->
    <view class="sec-head">
      <text class="sec-title"><text class="bar gray" />投注记录</text>
    </view>
    <view class="records">
      <view v-for="bet in bets" :key="bet.id" class="record">
        <view class="rec-left">
          <text class="rec-name">{{ bet.user?.name || "匿名" }}</text>
          <text class="rec-odds">{{ recText(bet) }}</text>
        </view>
        <view class="rec-right">
          <text class="rec-amount">投 ¥{{ bet.amount }}</text>
          <text class="rec-settle" :class="settlement(bet).state">
            {{ settlement(bet).text }}
          </text>
        </view>
      </view>
      <view v-if="bets.length === 0" class="rec-empty">还没有人投注</view>
    </view>

    <BetSheet
      :visible="sheetVisible"
      :match="match"
      :type="sheetType"
      @close="sheetVisible = false"
      @confirm="onConfirm"
    />
  </view>

  <view v-else class="loading">加载中…</view>
</template>

<style lang="scss" scoped>
@import "../../styles/tokens.scss";

.detail {
  padding: 24rpx;
}
.loading {
  text-align: center;
  color: $c-text2;
  padding: 120rpx 0;
}

.info-card {
  background: $c-card;
  border: 2rpx solid $c-border;
  border-radius: 24rpx;
  padding: 32rpx 28rpx;
  text-align: center;
  margin-bottom: 28rpx;
}
.status {
  font-size: 22rpx;
  padding: 6rpx 18rpx;
  border-radius: 40rpx;
}
.status.pending {
  background: rgba(25, 195, 125, 0.16);
  color: $c-green-bright;
}
.status.playing {
  background: rgba(245, 180, 49, 0.16);
  color: $c-gold;
}
.status.end {
  background: $c-line;
  color: $c-text2;
}
.teams {
  display: flex;
  align-items: center;
  margin: 26rpx 0 16rpx;
}
.team {
  flex: 1;
  min-width: 0;
  font-size: 36rpx;
  font-weight: 500;
  color: $c-text;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.team-right {
  text-align: right;
}
.vs {
  padding: 0 20rpx;
  font-size: 26rpx;
  color: $c-text3;
}
.score {
  padding: 0 20rpx;
  font-size: 40rpx;
  font-weight: 500;
  color: $c-text;
}
.time {
  font-size: 24rpx;
  color: $c-text2;
}
.closed {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: $c-gold;
}

.sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
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
.sec-sub {
  font-size: 24rpx;
  color: $c-text2;
}

.market {
  display: flex;
  gap: 20rpx;
  margin-bottom: 32rpx;
}
.cell {
  flex: 1;
  min-width: 0;
}

.records {
  background: $c-card;
  border: 2rpx solid $c-border;
  border-radius: 24rpx;
  overflow: hidden;
}
.record {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 26rpx;
  border-bottom: 2rpx solid $c-line;
}
.record:last-child {
  border-bottom: none;
}
.rec-left {
  min-width: 0;
  flex: 1;
}
.rec-name {
  display: block;
  font-size: 26rpx;
  color: $c-text;
}
.rec-odds {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: $c-text2;
}
.rec-right {
  text-align: right;
  flex-shrink: 0;
  margin-left: 16rpx;
}
.rec-amount {
  display: block;
  font-size: 22rpx;
  color: $c-text2;
}
.rec-settle {
  display: block;
  margin-top: 4rpx;
  font-size: 28rpx;
  font-weight: 500;
}
.rec-settle.win {
  color: $c-green-bright;
}
.rec-settle.loss {
  color: $c-red;
}
.rec-settle.pending,
.rec-settle.flat {
  color: $c-text2;
  font-weight: 400;
}
.rec-empty {
  text-align: center;
  color: $c-text2;
  font-size: 24rpx;
  padding: 48rpx 0;
}
</style>
```

- [ ] **Step 2: 手动验证（微信开发者工具）**

Run: `cd frontend && yarn dev`，开发者工具中从列表点入一场**可投注**比赛。
Expected：
- 信息卡、让球盘两按钮（队名+让球数）、胜平负三按钮（仅 `win_open` 时出现）正常渲染。
- 点赔率按钮弹出底部弹层；选中方向高亮带 ✓，可组内切换；输入金额（仅整数）/快捷金额联动；"预计可赢"随金额与方向变化；金额非 50–500 时确认按钮变灰不可点。
- 确认投注 → toast 成功 → 弹层关闭 → 记录列表刷新出现新记录（投注人显示姓名）。
- 进入一场**已结束/进行中**比赛：赔率按钮置灰不可点，信息卡显示"已封盘"；记录结算列绿盈/红亏/灰待结算。
- 长队名（如"托特纳姆热刺"）在按钮内两行省略不破版。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/pages/match/index.vue
git commit -m "feat(frontend): 比赛详情页（盘口/记录/投注弹层接线）"
```

---

## Task 10: 端到端联调与收尾

**Files:**
- 无新增（联调验证）

- [ ] **Step 1: 全量纯逻辑测试通过**

Run: `cd frontend && yarn test`
Expected: format 与 bet 两套测试全部 PASS。

- [ ] **Step 2: 前端类型检查**

Run: `cd frontend && npx vue-tsc --noEmit`
Expected: 无类型错误。

- [ ] **Step 3: 后端类型检查**

Run: `cd server && npx tsc --noEmit`
Expected: 无类型错误。

- [ ] **Step 4: 端到端走查（对照规范验收清单）**

启动后端（`cd server && yarn dev` 或既有启动方式）与前端 `yarn dev`，逐项核对 `docs/superpowers/specs/2026-06-20-football-betting-frontend-design.md` 第 13 节验收清单：列表三态/跳转/盘口队名/长名自适应/胜平负开关/记录配色/封盘/弹层高亮与可赢/投注成功刷新/-2 提示/投注人可见/深色壳层。
Expected: 全部勾选通过。

- [ ] **Step 5: 最终提交**

```bash
git add -A
git commit -m "chore: 前端三画面联调收尾"
```

---

## Self-Review 记录

- **Spec 覆盖**：列表→Task7；详情/盘口/记录→Task9；弹层→Task8；预计可赢/标签/校验→Task4；时间/状态/比分→Task3+Task7；深色壳层→Task5；后端 4 处修复→Task1；类型补齐→Task2。第 14 节 `result_profit` 假设落在 `settlement()`（Task4）与记录渲染（Task9）。
- **占位检查**：无 TBD/TODO；每个代码步骤含完整代码。
- **类型一致**：`BetType`、`directionLabel/oddsValue/potentialWin/betCondition/recordOddsText/settlement` 在 Task4 定义，Task8/Task9 按相同签名调用；`MatchDetail`/`BetRecord` 在 Task2 定义后于组件复用；`OddsButton` props（label/value/selected/disabled）在 Task6 定义、Task8/9 一致使用。

## 对抗性审查修订（双 agent 平台 + 逻辑两路）

已合入的修正：
- **scss `@import` 改相对路径** `../../styles/tokens.scss`（`@` 别名在 sass 编译阶段不解析，会导致首个 `yarn dev` 直接编译失败）。Task5 创建的 `src/styles/tokens.scss` 仅含 SCSS 变量，多组件各自 import 不产生重复 CSS。
- **赔率按钮等分**：mp-weixin 自定义组件会包一层节点，`flex:1` 落在组件内部根节点而非父 flex 直接子节点。改为父级用 `<view class="cell">`（`flex:1; min-width:0`）包裹每个 `<OddsButton>`，按钮根节点改 `width:100%`（Task6/8/9）。
- **两行省略防失效**：autoprefixer 会删 `-webkit-box-orient`，line-clamp 失效。`.label` 加 `/* autoprefixer: ignore next */` 并定宽（Task6）。
- **投注人关联显式别名**：`@BelongsTo(() => User, { foreignKey:"openid", targetKey:"openid", as:"user" })` + `include:[{model:User, as:"user"}]`，确保序列化 key 为 `user`（Task1）。
- **盘口快照**：快照逻辑移入 `BetSheet`（打开时深拷贝 `match`，弹层展示与下注 condition 均用快照，并 emit `condition`）；详情页 `onConfirm` 直接用 `payload.condition`，不再用轮询后的实时 `match` 重算——否则后端 `-2`「盘口已变化」永不触发（Task8/9）。
- **placeholder 颜色**：scoped 下 `placeholder-class` 不命中，改用内联 `placeholder-style`（Task8）。
- **轮询生命周期**：拆为 `refresh()`（仅取数）与 `startTimer()`（仅 onShow 启动一次、命中 `end` 自停），消除每个 tick 重建定时器与 `onConfirm` 的定时器竞争（Task9）。

已知风险（不阻塞、本次不做）：
- **赔率漂移不被 `-2` 拦截**：后端 `bet()` 只对 `condition`（让球数）做 `.eq` 校验返回 `-2`，对 `value`（水位/赔率）不校验，直接用服务端最新值落库。若让球数未变但水位变化，用户会按变化后的水位静默成交、"预计可赢"与实际结算可能不符。闭环需后端对 `value` 也做快照比较，超出"最小修复"范围，留作后续。
- **DECIMAL 字段**：经 `pg` 驱动 NUMERIC 默认以**字符串**返回，计划将 amount/value/condition/result_profit 等全标 `string` 并用字符串构造 `Decimal`、模板直显——已确认正确。
