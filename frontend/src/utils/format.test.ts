import { describe, expect, it } from "vitest";
import {
  dayKey,
  formatDay,
  formatHandicap,
  formatMatchTime,
  formatMoney,
  formatTime,
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
  it("整数无小数", () => expect(formatMoney("95")).toBe("95"));
  it("接受数字", () => expect(formatMoney(50)).toBe("50"));
  it("去掉末尾多余的 0", () => expect(formatMoney("95.50")).toBe("95.5"));
  it("保留有效两位", () => expect(formatMoney("95.55")).toBe("95.55"));
  it("超过两位四舍五入", () => expect(formatMoney("95.555")).toBe("95.56"));
  it("零显示 0", () => expect(formatMoney("0")).toBe("0"));
});

describe("matchStatusText", () => {
  it("pending", () => expect(matchStatusText("pending")).toBe("可投注"));
  it("playing", () => expect(matchStatusText("playing")).toBe("进行中"));
  it("end", () => expect(matchStatusText("end")).toBe("已结束"));
});

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
