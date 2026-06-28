import type { InferAttributes } from "sequelize";
import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from "sequelize-typescript";

/**
 * 比赛视图
 */
@Table({ tableName: "v_f_match", underscored: false, timestamps: false })
export class Match extends Model<InferAttributes<Match>> {
  /**
   * 比赛id
   */
  @PrimaryKey
  @Column(DataType.INTEGER)
  declare id: number;

  /**
   * 比赛时间
   */
  @Column(DataType.DATE)
  declare match_time: Date;

  /**
   * 主队
   */
  @Column(DataType.STRING)
  declare team1_name: string;

  /**
   * 客队
   */
  @Column(DataType.STRING)
  declare team2_name: string;

  /**
   * 是否已有赛果
   */
  @Column(DataType.TINYINT)
  declare has_score: number;

  /**
   * 主队得分
   */
  @Column(DataType.INTEGER)
  declare score1: number | null;

  /**
   * 客队得分
   */
  @Column(DataType.INTEGER)
  declare score2: number | null;

  /**
   * 让球
   */
  @Column(DataType.DECIMAL)
  declare ah_condition: string;

  /**
   * 让球主队水位
   */
  @Column(DataType.DECIMAL)
  declare ah1_value: string;

  /**
   * 让球客队水位
   */
  @Column(DataType.DECIMAL)
  declare ah2_value: string;

  @Column(DataType.STRING)
  declare ah_hash: string;

  @Column(DataType.TINYINT)
  declare win_open: number;

  @Column(DataType.STRING)
  declare win_hash: string;

  @Column(DataType.DECIMAL)
  declare win1_value: string;

  @Column(DataType.DECIMAL)
  declare win2_value: string;

  @Column(DataType.DECIMAL)
  declare draw_value: string;

  /**
   * 是否开启大小球投注
   */
  @Column(DataType.TINYINT)
  declare ou_open: number;

  /**
   * 大小球临界点
   */
  @Column(DataType.DECIMAL)
  declare ou_condition: string;

  /**
   * 大小球小球赔率（欧赔）
   */
  @Column(DataType.DECIMAL)
  declare under_value: string;

  /**
   * 大小球大球赔率（欧赔）
   */
  @Column(DataType.DECIMAL)
  declare over_value: string;
}
