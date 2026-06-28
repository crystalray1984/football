import axios from "axios";
import Decimal from "decimal.js";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config";
import { Bet, Match, User } from "./db";
import { Op } from "sequelize";

function getMatchState(match: Pick<Match, "match_time" | "has_score">) {
  let state: string;
  let state_sort: number;
  if (match.match_time.valueOf() > Date.now()) {
    state = "pending";
    state_sort = 0;
  } else if (match.has_score) {
    state = "end";
    state_sort = 2;
  } else {
    state = "playing";
    state_sort = 1;
  }
  return {
    state,
    state_sort,
  };
}

/**
 * 恢复登陆状态
 * @param req
 * @param reply
 * @returns
 */
async function auth(req: FastifyRequest, reply: FastifyReply) {
  const { code } = req.body as {
    code: string;
  };

  const ret = await axios.request<{
    session_key: string;
    openid: string;
  }>({
    url: "https://api.weixin.qq.com/sns/jscode2session",
    params: {
      appid: config.app_id,
      secret: config.app_secret,
      js_code: code,
      grant_type: "authorization_code",
    },
  });

  if (!ret.data || !ret.data.openid) {
    reply.send({
      code: -1,
    });
    return;
  }

  //查询用户是否存在
  const user = await User.findOne({
    where: {
      openid: ret.data.openid,
    },
  });

  if (!user) {
    reply.send({
      code: -2,
    });
    return;
  }

  reply.send({
    code: 0,
    data: ret.data.openid,
  });
}

/**
 * 新用户注册
 * @param req
 * @param reply
 * @returns
 */
async function register(req: FastifyRequest, reply: FastifyReply) {
  const { code, name } = req.body as {
    code: string;
    name: string;
  };

  if (!code || !name) {
    reply.send({
      code: -1,
      msg: "注册失败",
    });
    return;
  }

  const ret = await axios.request<{
    session_key: string;
    openid: string;
  }>({
    url: "https://api.weixin.qq.com/sns/jscode2session",
    params: {
      appid: config.app_id,
      secret: config.app_secret,
      js_code: code,
      grant_type: "authorization_code",
    },
  });

  if (!ret.data || !ret.data.openid) {
    reply.send({
      code: -1,
      msg: "注册失败",
    });
    return;
  }

  //查询用户是否存在
  const user = await User.findOne({
    where: {
      openid: ret.data.openid,
    },
  });

  if (user) {
    user.name = name;
    await user.save();
  } else {
    await User.create({
      openid: ret.data.openid,
      name,
    });
  }

  reply.send({
    code: 0,
    data: ret.data.openid,
  });
}

/**
 * 获取比赛列表
 * @param _req
 * @param reply
 */
async function getMatchList(_req: FastifyRequest, reply: FastifyReply) {
  const rows = await Match.findAll({
    order: [
      ["match_time", "DESC"],
      ["id", "ASC"],
    ],
    attributes: [
      "id",
      "team1_name",
      "team2_name",
      "match_time",
      "has_score",
      "score1",
      "score2",
    ],
  });

  //构建比赛状态参数
  const matches = rows.map((row) => {
    return {
      id: row.id,
      match_time: row.match_time,
      team1_name: row.team1_name,
      team2_name: row.team2_name,
      has_score: row.has_score,
      score1: row.score1,
      score2: row.score2,
      ...getMatchState(row),
    };
  });

  //排序比赛
  matches.sort((match1, match2) => {
    if (match1.state_sort !== match2.state_sort) {
      return match1.state_sort - match2.state_sort;
    }
    if (match1.state === "end") {
      return match2.match_time.valueOf() - match1.match_time.valueOf();
    } else {
      return match1.match_time.valueOf() - match2.match_time.valueOf();
    }
  });

  reply.send({
    code: 0,
    data: matches,
  });
}

/**
 * 获取比赛详情
 */
async function getMatchDetail(req: FastifyRequest, reply: FastifyReply) {
  const query = req.query as Record<string, string>;
  const match_id = parseInt(query?.match_id);
  if (isNaN(match_id) || match_id <= 0) {
    reply.send({
      code: -1,
      msg: "找不到比赛",
    });
    return;
  }

  //读取比赛信息
  const match = await Match.findOne({
    where: {
      id: match_id,
    },
  });
  if (!match) {
    reply.send({
      code: -1,
      msg: "找不到比赛",
    });
    return;
  }

  const matchInfo = {
    ...match.toJSON(),
    ...getMatchState(match),
  };

  reply.send({
    code: 0,
    data: matchInfo,
  });
}

/**
 * 获取比赛已投注的列表
 */
async function getMatchBets(req: FastifyRequest, reply: FastifyReply) {
  const query = req.query as Record<string, string>;
  const match_id = parseInt(query?.match_id);
  if (isNaN(match_id) || match_id <= 0) {
    reply.send({
      code: 0,
      data: [],
    });
    return;
  }

  const bets = await Bet.findAll({
    where: {
      match_id,
    },
    include: [{ model: User, as: "user" }],
    order: [["id", "desc"]],
  });

  reply.send({
    code: 0,
    data: bets,
  });
}

/**
 * 获取当前用户的投注记录（含比赛信息）
 */
async function getMyBets(req: FastifyRequest, reply: FastifyReply) {
  const openid = req.headers.token as string;

  if (!openid) {
    reply.send({
      code: 0,
      data: [],
    });
    return;
  }

  const bets = await Bet.findAll({
    where: { openid },
    include: [
      {
        model: Match,
        as: "match",
        attributes: ["id", "team1_name", "team2_name", "match_time"],
        // INNER JOIN：保证每条记录都带得到比赛，避免前端 bet.match 为 null 崩溃。
        // v_f_match 视图保留全部比赛（含已结束），正常不会丢记录。
        required: true,
      },
    ],
    order: [["id", "desc"]],
  });

  reply.send({
    code: 0,
    data: bets,
  });
}

/**
 * 管理员：全部用户的已结算投注（精简投影），前端按日/用户聚合。
 * 注意：仅客户端做管理员鉴权，本接口不做服务端鉴权（与其它读接口一致）。
 */
async function getDailyProfit(_req: FastifyRequest, reply: FastifyReply) {
  const bets = await Bet.findAll({
    where: { result_profit: { [Op.not]: null } },
    include: [
      { model: User, as: "user", attributes: ["name"] },
      { model: Match, as: "match", attributes: ["match_time"], required: true },
    ],
    order: [["id", "desc"]],
  });

  const data = bets.map((b) => ({
    openid: b.openid,
    name: b.user?.name ?? "",
    match_time: b.match!.match_time,
    result_profit: b.result_profit,
  }));

  reply.send({ code: 0, data });
}

/**
 * 排行榜：全部用户累计收益 / 胜率（后端预聚合，每人一行）。
 * 口径：仅有效投注（result ∈ {1,-1}）；胜率为百分比数值（1 位小数，不含 %）。
 * 与其它读接口一致，不做服务端鉴权。
 */
async function getRank(_req: FastifyRequest, reply: FastifyReply) {
  const bets = await Bet.findAll({
    where: { result: { [Op.in]: [1, -1] } },
    include: [{ model: User, as: "user", attributes: ["name"] }],
    attributes: ["openid", "result", "result_profit"],
  });

  const map = new Map<
    string,
    { name: string; valid: number; win: number; profit: Decimal }
  >();
  for (const b of bets) {
    let u = map.get(b.openid);
    if (!u) {
      u = {
        name: b.user?.name ?? "",
        valid: 0,
        win: 0,
        profit: new Decimal(0),
      };
      map.set(b.openid, u);
    }
    u.valid += 1;
    if (b.result === 1) u.win += 1;
    u.profit = u.profit.add(b.result_profit ?? 0);
  }

  const data = [...map.entries()].map(([openid, u]) => ({
    openid,
    name: u.name,
    winRate: new Decimal(u.win)
      .div(u.valid)
      .mul(100)
      .toDecimalPlaces(1)
      .toNumber(),
    profit: u.profit.toString(),
  }));

  //添加庄家收益
  if (data.length > 0) {
    data.push({
      openid: "",
      name: "庄家",
      winRate: 0,
      profit: Decimal(0)
        .sub(data.reduce((total, row) => total.add(row.profit), Decimal(0)))
        .toString(),
    });
  }

  reply.send({ code: 0, data });
}

/**
 * 投注
 */
async function bet(req: FastifyRequest, reply: FastifyReply) {
  const { match_id, type, amount, condition } = req.body as {
    match_id: number;
    type: "ah1" | "ah2" | "win1" | "win2" | "draw" | "over" | "under";
    amount: number;
    condition: string;
  };
  const openid = req.headers.token as string;

  if (!openid) {
    reply.send({
      code: -1,
      msg: "未登录",
    });
    return;
  }

  if (isNaN(match_id) || match_id <= 0 || !Number.isSafeInteger(match_id)) {
    reply.send({
      code: -1,
      msg: "找不到比赛",
    });
    return;
  }

  if (
    isNaN(amount) ||
    !Number.isSafeInteger(amount) ||
    amount < config.min_bet ||
    amount > config.max_bet
  ) {
    reply.send({
      code: -1,
      msg: "无效投注金额",
    });
    return;
  }

  //读取比赛信息
  const match = await Match.findOne({
    where: {
      id: match_id,
    },
  });
  if (!match) {
    reply.send({
      code: -1,
      msg: "找不到比赛",
    });
    return;
  }

  //判断比赛时间
  if (match.match_time.valueOf() < Date.now()) {
    reply.send({
      code: -1,
      msg: "比赛已开始",
    });
    return;
  }

  //判断投注
  let value: string;
  if (type === "ah1") {
    if (!Decimal(match.ah_condition).eq(condition)) {
      reply.send({
        code: -2,
        msg: "比赛盘口已变化，重新下注",
      });
      return;
    }
    value = match.ah1_value;
  } else if (type === "ah2") {
    if (!Decimal(0).sub(match.ah_condition).eq(condition)) {
      reply.send({
        code: -2,
        msg: "比赛盘口已变化，重新下注",
      });
      return;
    }
    value = match.ah2_value;
  } else if (["win1", "win2", "draw"].includes(type)) {
    if (!match.win_open) {
      reply.send({
        code: -1,
        msg: "未开放胜平负盘口",
      });
      return;
    }
    switch (type) {
      case "win1":
        value = match.win1_value;
        break;
      case "win2":
        value = match.win2_value;
        break;
      default:
        value = match.draw_value;
        break;
    }
  } else if (type === "over" || type === "under") {
    if (!match.ou_open) {
      reply.send({
        code: -1,
        msg: "未开放大小球盘口",
      });
      return;
    }
    if (!Decimal(match.ou_condition).eq(condition)) {
      reply.send({
        code: -2,
        msg: "比赛盘口已变化，重新下注",
      });
      return;
    }
    value = type === "over" ? match.over_value : match.under_value;
  } else {
    reply.send({
      code: -1,
      msg: "无效投注",
    });
    return;
  }

  //判断单场比赛此用户总金额
  const sum = await Bet.sum("amount", { where: { match_id, openid } });
  if (
    Decimal(sum || 0)
      .add(amount)
      .gt(config.max_bet)
  ) {
    reply.send({
      code: -1,
      msg: "单场比赛投注超限",
    });
    return;
  }

  //插入投注
  await Bet.create({
    match_id,
    openid,
    type,
    value,
    amount: amount.toString(),
    condition,
  });

  reply.send({
    code: 0,
  });
}

export default function routes(app: FastifyInstance) {
  app.post("/api/auth", auth);
  app.post("/api/register", register);
  app.get("/api/match/list", getMatchList);
  app.get("/api/match/detail", getMatchDetail);
  app.get("/api/match/bets", getMatchBets);
  app.get("/api/my/bets", getMyBets);
  app.get("/api/admin/daily-profit", getDailyProfit);
  app.get("/api/rank", getRank);
  app.post("/api/bet", bet);
}
