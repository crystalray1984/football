import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from "sequelize";
import {
  AllowNull,
  Column,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from "sequelize-typescript";

/**
 * 投注记录
 */
@Table({ tableName: "f_user", underscored: false, timestamps: false })
export class User extends Model<
  InferAttributes<User>,
  InferCreationAttributes<User>
> {
  /**
   * openid
   */
  @PrimaryKey
  @Column(DataType.STRING)
  declare openid: string;

  /**
   * 昵称
   */
  @Column(DataType.STRING)
  declare name: string;
}
