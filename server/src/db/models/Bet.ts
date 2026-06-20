import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from "sequelize";
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
import { User } from "./User";
import { Match } from "./Match";

/**
 * 投注记录
 */
@Table({ tableName: "f_bet", underscored: false })
export class Bet extends Model<
  InferAttributes<Bet>,
  InferCreationAttributes<Bet>
> {
  /**
   * 投注id
   */
  @AutoIncrement
  @PrimaryKey
  @Column(DataType.INTEGER)
  declare id: CreationOptional<number>;

  /**
   * openid
   */
  @Column(DataType.STRING)
  declare openid: string;

  /**
   * 用户信息
   */
  @BelongsTo(() => User, { foreignKey: "openid", targetKey: "openid", as: "user" })
  declare user?: User;

  /**
   * 比赛信息
   */
  @BelongsTo(() => Match, { foreignKey: "match_id", as: "match" })
  declare match?: Match;

  /**
   * 比赛id
   */
  @Column(DataType.INTEGER)
  declare match_id: number;

  /**
   * 投注类型
   */
  @Column(DataType.STRING)
  declare type: string;

  /**
   * 盘口
   */
  @Column(DataType.DECIMAL)
  declare condition: string;

  /**
   * 赔率
   */
  @Column(DataType.DECIMAL)
  declare value: string;

  /**
   * 投注金额
   */
  @Column(DataType.DECIMAL)
  declare amount: string;

  /**
   * 赛果
   */
  @AllowNull
  @Column(DataType.INTEGER)
  declare result: CreationOptional<number | null>;

  /**
   * 结算
   */
  @AllowNull
  @Column(DataType.DECIMAL)
  declare result_profit: CreationOptional<string | null>;

  @CreatedAt
  @Column(DataType.DATE)
  declare created_at: CreationOptional<Date>;

  @UpdatedAt
  @Column(DataType.DATE)
  declare updated_at: CreationOptional<Date>;
}
