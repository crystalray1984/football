import { Sequelize } from "sequelize-typescript";
import { config } from "../config";
import { Bet } from "./models/Bet";
import { CrownOddRecord } from "./models/CrownOddRecord";
import { FMatch } from "./models/FMatch";
import { Match } from "./models/Match";
import { User } from "./models/User";

export const db = new Sequelize({
  ...config.db,
  dialect: "postgres",
  dialectOptions: {},
  models: [Match, User, Bet, CrownOddRecord, FMatch],
});

export { Bet } from "./models/Bet";
export { CrownOddRecord } from "./models/CrownOddRecord";
export { FMatch } from "./models/FMatch";
export { Match } from "./models/Match";
export { User } from "./models/User";
