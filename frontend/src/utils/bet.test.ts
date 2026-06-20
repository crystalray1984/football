import { describe, expect, it } from "vitest";
import {
  betCondition,
  directionLabel,
  displayOdds,
  MAX_BET,
  MIN_BET,
  oddsValue,
  potentialWin,
  recordOddsText,
  settlement,
  validateAmount,
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
  it("让球：本金×(欧赔-1)", () => expect(potentialWin(100, "1.95")).toBe("95.00"));
  it("胜平负：本金×(欧赔-1)", () => expect(potentialWin(100, "2.10")).toBe("110.00"));
  it("空金额为0", () => expect(potentialWin(0, "2.10")).toBe("0.00"));
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
  it("盈利", () =>
    expect(settlement({ result_profit: "95" })).toEqual({ state: "win", text: "+95.00" }));
  it("亏损", () =>
    expect(settlement({ result_profit: "-50" })).toEqual({ state: "loss", text: "-50.00" }));
  it("持平", () =>
    expect(settlement({ result_profit: "0" })).toEqual({ state: "flat", text: "0.00" }));
});
