import { describe, expect, it } from "vitest";
import {
  betCondition,
  directionLabel,
  displayOdds,
  groupBetsByDay,
  groupUserDailyProfit,
  MAX_BET,
  MIN_BET,
  oddsValue,
  potentialWin,
  recordOddsText,
  settlement,
  sortRanking,
  sumSettledProfit,
  validateAmount,
  profitDisplay,
} from "./bet";

// 注意：后端所有赔率（含让球）均存欧赔（含本金），前端一律展示为 欧赔-1（亚赔）
const match = {
  team1_name: "曼城",
  team2_name: "利物浦",
  ah_condition: "-0.5",
  ah1_value: "1.95",
  ah2_value: "1.88",
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
  it("ah1 返回原始欧赔", () => expect(oddsValue("ah1", match)).toBe("1.95"));
  it("draw 返回原始欧赔", () => expect(oddsValue("draw", match)).toBe("3.20"));
});

describe("displayOdds", () => {
  it("欧赔减 1 得亚赔，两位小数", () => expect(displayOdds("1.95")).toBe("0.95"));
  it("胜平负欧赔", () => expect(displayOdds("2.10")).toBe("1.10"));
  it("平局欧赔", () => expect(displayOdds("3.20")).toBe("2.20"));
});

describe("potentialWin", () => {
  it("让球：本金×(欧赔-1)", () => expect(potentialWin(100, "1.95")).toBe("95"));
  it("胜平负：本金×(欧赔-1)", () => expect(potentialWin(100, "2.10")).toBe("110"));
  it("空金额为 0", () => expect(potentialWin(0, "2.10")).toBe("0"));
  it("最多两位小数", () => expect(potentialWin(150, "1.333")).toBe("49.95"));
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
  it("让球主队（@亚赔）", () =>
    expect(recordOddsText({ type: "ah1", condition: "-0.5", value: "1.95" }, match)).toBe(
      "让球 曼城 -0.5 @0.95",
    ));
  it("让球客队（@亚赔）", () =>
    expect(recordOddsText({ type: "ah2", condition: "0.5", value: "1.88" }, match)).toBe(
      "让球 利物浦 +0.5 @0.88",
    ));
  it("主胜（@亚赔）", () =>
    expect(recordOddsText({ type: "win1", condition: "0", value: "2.10" }, match)).toBe(
      "曼城 胜 @1.10",
    ));
  it("平局（@亚赔）", () =>
    expect(recordOddsText({ type: "draw", condition: "0", value: "3.20" }, match)).toBe(
      "平局 @2.20",
    ));
});

describe("settlement", () => {
  it("未结算", () =>
    expect(settlement({ result_profit: null })).toEqual({ state: "pending", text: "待结算" }));
  it("盈利（带 +）", () =>
    expect(settlement({ result_profit: "95" })).toEqual({ state: "win", text: "+95" }));
  it("亏损", () =>
    expect(settlement({ result_profit: "-50" })).toEqual({ state: "loss", text: "-50" }));
  it("持平", () =>
    expect(settlement({ result_profit: "0" })).toEqual({ state: "flat", text: "0" }));
  it("去掉末尾 0", () =>
    expect(settlement({ result_profit: "95.50" })).toEqual({ state: "win", text: "+95.5" }));
  it("超过两位四舍五入", () =>
    expect(settlement({ result_profit: "95.555" })).toEqual({ state: "win", text: "+95.56" }));
});

describe("sumSettledProfit", () => {
  it("空列表为 0", () => expect(sumSettledProfit([])).toBe("0"));
  it("仅未结算（null）不计入，结果 0", () =>
    expect(
      sumSettledProfit([{ result_profit: null }, { result_profit: null }]),
    ).toBe("0"));
  it("混合：跳过未结算，累加已结算净盈亏", () =>
    expect(
      sumSettledProfit([
        { result_profit: "95" },
        { result_profit: null },
        { result_profit: "-50" },
        { result_profit: "0" },
      ]),
    ).toBe("45"));
  it("小数累加精确", () =>
    expect(
      sumSettledProfit([{ result_profit: "10.5" }, { result_profit: "20.25" }]),
    ).toBe("30.75"));
  it("净亏损为负", () =>
    expect(
      sumSettledProfit([{ result_profit: "10" }, { result_profit: "-30" }]),
    ).toBe("-20"));
});

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
  it("小数收益累加精确", () => {
    const g = groupUserDailyProfit([
      row("o1", "张三", "2026-06-21T18:00:00", "10.5"),
      row("o1", "张三", "2026-06-21T19:00:00", "-7.25"),
      row("o2", "李四", "2026-06-21T20:00:00", "20.75"),
    ]);
    expect(g[0].users).toEqual([
      { name: "李四", profit: "20.75" },
      { name: "张三", profit: "3.25" },
    ]);
    expect(g[0].total).toBe("24");
  });
});

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

describe("sortRanking", () => {
  const mk = (name: string, winRate: number, profit: string): RankRow => ({
    openid: "o-" + name,
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
