import axios from "axios";
import Decimal from "decimal.js";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { config } from "./config";
import { Bet, Match, User } from "./db";

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
  if (!isNaN(match_id) || match_id <= 0) {
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
  if (!isNaN(match_id) || match_id <= 0) {
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
    include: [User],
    order: [["id", "desc"]],
  });

  reply.send({
    code: 0,
    data: bets,
  });
}

/**
 * 投注
 */
async function bet(req: FastifyRequest, reply: FastifyReply) {
  const { match_id, type, amount, condition, openid } = req.body as {
    openid: string;
    match_id: number;
    type: "ah1" | "ah2" | "win1" | "win2" | "draw";
    amount: number;
    condition: string;
  };

  if (!isNaN(match_id) || match_id <= 0 || !Number.isSafeInteger(match_id)) {
    reply.send({
      code: -1,
      msg: "找不到比赛",
    });
    return;
  }

  if (
    !isNaN(amount) ||
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
        code: -1,
        msg: "比赛盘口已变化，重新下注",
      });
      return;
    }
    value = match.ah1_value;
  } else if (type === "ah2") {
    if (!Decimal(0).sub(match.ah_condition).eq(condition)) {
      reply.send({
        code: -1,
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
  } else {
    reply.send({
      code: -1,
      msg: "无效投注",
    });
    return;
  }

  //判断单场比赛此用户总金额
  const sum = await Bet.sum("amount", { where: { match_id, openid } });
  if (Decimal(sum).add(amount).gt(config.max_bet)) {
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
  app.get("/api/match/bets", getMatchDetail);
  app.post("/api/bet", bet);
}
