declare interface AppConfig {
  /**
   * 监听的http端口
   */
  port?: number;

  /**
   * 数据库设置
   */
  db: {
    host: string;
    port?: number;
    username: string;
    password: string;
    database: string;
    pool?: {
      max?: number;
      min?: number;
      acquire?: number;
      idle?: number;
    };
  };

  app_id: string;
  app_secret: string;

  /**
   * 单笔最小投注
   */
  min_bet: number;
  /**
   * 单笔最大投注
   */
  max_bet: number;
}

declare interface CrownOddInfo {
  game_id: string;
  variety: "goal" | "corner";
  type: "r" | "hr" | "ou" | "hou" | "m" | "hm" | "ts" | "hts";
  condition: string;
  value_h: string;
  value_c: string;
  value_n: string;
}
