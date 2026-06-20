/**
 * 接口响应数据结构
 */
declare interface ApiResp<T = void> {
  /**
   * 响应码
   * 0-调用成功
   * 非0-调用失败
   */
  code: number;
  /**
   * 错误信息
   */
  msg: string;
  /**
   * 接口数据
   */
  data: T;
}

/**
 * 比赛基础数据
 */
declare interface Match {
  /**
   * 比赛id
   */
  id: number;
  /**
   * 比赛时间
   */
  match_time: string;
  /**
   * 主队
   */
  team1_name: string;
  /**
   * 客队
   */
  team2_name: string;
  /**
   * 是否已有比分
   */
  has_score: number;
  /**
   * 主队得分
   */
  score1: number | null;
  /**
   * 客队得分
   */
  score2: number | null;
  /**
   * 比赛状态
   * pending-可投注
   * playing-进行中
   * end-已结束
   */
  state: "pending" | "playing" | "end";
}

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
