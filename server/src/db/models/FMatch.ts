import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from "sequelize";
import {
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from "sequelize-typescript";

/**
 * 可投注的比赛表
 */
@Table({ tableName: "f_match", underscored: false })
export class FMatch extends Model<
  InferAttributes<FMatch>,
  InferCreationAttributes<FMatch>
> {
  /**
   * 比赛id
   */
  @PrimaryKey
  @Column(DataType.INTEGER)
  declare match_id: number;

  /**
   * 让球
   */
  @Column(DataType.DECIMAL)
  declare ah_condition: string;

  /**
   * 让球主队赔率（欧赔）
   */
  @Column(DataType.DECIMAL)
  declare ah1_value: string;

  /**
   * 让球客队赔率（欧赔）
   */
  @Column(DataType.DECIMAL)
  declare ah2_value: string;

  /**
   * 是否开启胜平负投注
   */
  @Column(DataType.TINYINT)
  declare win_open: number;

  /**
   * 胜平负主胜赔率（欧赔）
   */
  @Column(DataType.DECIMAL)
  declare win1_value: CreationOptional<string>;

  /**
   * 胜平负客胜赔率（欧赔）
   */
  @Column(DataType.DECIMAL)
  declare win2_value: CreationOptional<string>;

  /**
   * 胜平负平局赔率（欧赔）
   */
  @Column(DataType.DECIMAL)
  declare draw_value: CreationOptional<string>;

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
  declare under_value: CreationOptional<string>;

  /**
   * 大小球大球赔率（欧赔）
   */
  @Column(DataType.DECIMAL)
  declare over_value: CreationOptional<string>;
}
