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
  score1: number;
  /**
   * 客队得分
   */
  score2: number;
  /**
   * 比赛状态
   * pending-可投注
   * playing-进行中
   * end-已结束
   */
  state: "pending" | "playing" | "end";
}
