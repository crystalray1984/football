import type {
  CreationOptional,
  InferAttributes,
  InferCreationAttributes,
} from "sequelize";
import {
  AutoIncrement,
  Column,
  CreatedAt,
  DataType,
  Model,
  PrimaryKey,
  Table,
} from "sequelize-typescript";

/**
 * 皇冠盘口记录表
 */
@Table({ tableName: "crown_odd_record", underscored: false, updatedAt: false })
export class CrownOddRecord extends Model<
  InferAttributes<CrownOddRecord>,
  InferCreationAttributes<CrownOddRecord>
> {
  /**
   * 盘口记录id
   */
  @AutoIncrement
  @PrimaryKey
  @Column(DataType.INTEGER)
  declare id: CreationOptional<number>;

  /**
   * 皇冠比赛id
   */
  @Column(DataType.STRING)
  declare crown_match_id: string;

  /**
   * 是否最新的盘口
   */
  @Column(DataType.SMALLINT)
  declare is_last: CreationOptional<0 | 1>;

  /**
   * 盘口类型
   */
  @Column(DataType.STRING)
  declare show_type: "early" | "today" | "live";

  /**
   * 盘口数据
   */
  @Column(DataType.JSONB)
  declare odd_data: CrownOddInfo[];

  /**
   * 数据创建时间
   */
  @CreatedAt
  @Column(DataType.DATE)
  declare created_at: CreationOptional<Date>;
}
