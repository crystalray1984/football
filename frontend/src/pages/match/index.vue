<script setup lang="ts">
import { api } from "@/api";
import { isAdmin } from "@/utils/admin";
import {
  betCondition,
  directionLabel,
  displayOdds,
  getBetResult,
  oddsValue,
  SettlementState,
  type BetType,
} from "@/utils/bet";
import { formatMatchTime, matchStatusText } from "@/utils/format";
import {
  onHide,
  onLoad,
  onShareAppMessage,
  onShow,
  onUnload,
} from "@dcloudio/uni-app";
import Decimal from "decimal.js";
import { computed, reactive, ref } from "vue";
import BetRecord from "./BetRecord.vue";
import BetSheet from "./BetSheet.vue";
import OddsButton from "./OddsButton.vue";

const matchId = ref(0);
const match = ref<MatchDetail | null>(null);
const bets = ref<BetRecord[]>([]);

const sheetVisible = ref(false);
const sheetType = ref<BetType>("ah1");

let timer: any;

const refresh = async () => {
  if (!matchId.value) return;
  try {
    const [d, b] = await Promise.all([
      api<MatchDetail>({ url: `/api/match/detail?match_id=${matchId.value}` }),
      api<BetRecord[]>({ url: `/api/match/bets?match_id=${matchId.value}` }),
    ]);
    if (d.code !== 0) {
      uni.showToast({ title: d.msg || "找不到比赛", icon: "none" });
      clearInterval(timer);
      setTimeout(() => uni.navigateBack(), 1200);
      return;
    }
    match.value = d.data;
    if (b.code === 0) bets.value = b.data;
  } catch (e) {
    uni.showToast({ title: "网络异常，请重试", icon: "none" });
  }
};

const startTimer = () => {
  clearInterval(timer);
  timer = setInterval(() => {
    if (match.value?.state === "end") {
      clearInterval(timer);
      return;
    }
    refresh();
  }, 10000);
};

const canBet = () => match.value?.state === "pending";

const openBet = (type: BetType) => {
  if (!canBet()) return;
  sheetType.value = type;
  sheetVisible.value = true;
};

const onConfirm = async (payload: { type: BetType; amount: number }) => {
  const m = match.value;
  if (!m) return;
  uni.showLoading();
  const ret = await api({
    url: "/api/bet",
    method: "POST",
    data: {
      match_id: m.id,
      type: payload.type,
      amount: payload.amount,
      condition: betCondition(payload.type, m),
    },
  });
  if (ret.code === 0) {
    sheetVisible.value = false;
    uni.showToast({ title: "投注成功", icon: "success" });
    refresh();
  } else if (ret.code === -2) {
    uni.showToast({ title: "盘口已变化，请重新下注", icon: "none" });
    refresh();
  } else {
    uni.showToast({ title: ret.msg || "投注失败", icon: "none" });
  }
};

// 模板辅助
const label = (t: BetType) =>
  match.value ? directionLabel(t, match.value) : "";
const odds = (t: BetType) =>
  match.value ? displayOdds(oddsValue(t, match.value)) : "";

onLoad((query) => {
  matchId.value = Number(query?.match_id) || 0;
});
onShow(() => {
  refresh();
  startTimer();
});
onHide(() => clearInterval(timer));
onUnload(() => clearInterval(timer));
onShareAppMessage(() => {
  return {};
});

const emulateScore = reactive({
  active: false,
  score1: 0,
  score2: 0,
});

const toggleEmulate = () => {
  if (isAdmin()) {
    emulateScore.active = !emulateScore.active;
  }
};

const onClickTeam1 = () => {
  if (!emulateScore.active) return;
  emulateScore.score1++;
};

const onClickTeam2 = () => {
  if (!emulateScore.active) return;
  emulateScore.score2++;
};

const getEmulateResult = (bet: BetRecord) => {
  if (!emulateScore.active) return;
  return getBetResult(bet, emulateScore.score1, emulateScore.score2);
};

const emulateTotal = computed(() => {
  if (!emulateScore.active) {
    return {
      state: "flat",
      text: "0",
    };
  }
  if (bets.value.length === 0) {
    return {
      state: "flat",
      text: "0",
    };
  }
  const result_profit = bets.value.reduce((prev, bet) => {
    const result = getBetResult(bet, emulateScore.score1, emulateScore.score2);
    return Decimal(prev)
      .add(result.result_profit ?? "0")
      .toString();
  }, "0");

  let state: SettlementState;
  if (Decimal(result_profit).gt(0)) {
    state = "win";
  } else if (Decimal(result_profit).lt(0)) {
    state = "loss";
  } else {
    state = "flat";
  }

  return {
    state,
    text: state === "win" ? `+${result_profit}` : result_profit,
  };
});
</script>

<template>
  <view v-if="match" class="detail">
    <!-- 信息卡 -->
    <view class="info-card">
      <text class="status" :class="match.state" @click="toggleEmulate">{{
        matchStatusText(match.state)
      }}</text>
      <view class="teams">
        <text class="team" @click="onClickTeam1">{{ match.team1_name }}</text>
        <text v-if="match.has_score && match.score1 !== null" class="score"
          >{{ match.score1 }} : {{ match.score2 }}</text
        >
        <text v-else-if="emulateScore.active" class="score"
          >{{ emulateScore.score1 }} : {{ emulateScore.score2 }}</text
        >
        <text v-else class="vs">VS</text>
        <text class="team team-right" @click="onClickTeam2">{{
          match.team2_name
        }}</text>
      </view>
      <text class="time">{{ formatMatchTime(match.match_time) }}</text>
    </view>

    <!-- 让球盘 -->
    <view class="sec-head">
      <text class="sec-title"><text class="bar" />让球盘</text>
    </view>
    <view class="market">
      <view class="cell"
        ><OddsButton
          :label="label('ah1')"
          :value="odds('ah1')"
          :disabled="!canBet()"
          @click="openBet('ah1')"
      /></view>
      <view class="cell"
        ><OddsButton
          :label="label('ah2')"
          :value="odds('ah2')"
          :disabled="!canBet()"
          @click="openBet('ah2')"
      /></view>
    </view>

    <!-- 胜平负 -->
    <template v-if="match.win_open">
      <view class="sec-head">
        <text class="sec-title"><text class="bar" />胜平负</text>
      </view>
      <view class="market three">
        <view class="cell"
          ><OddsButton
            :label="label('win1')"
            :value="odds('win1')"
            :disabled="!canBet()"
            @click="openBet('win1')"
        /></view>
        <view class="cell"
          ><OddsButton
            :label="label('draw')"
            :value="odds('draw')"
            :disabled="!canBet()"
            @click="openBet('draw')"
        /></view>
        <view class="cell"
          ><OddsButton
            :label="label('win2')"
            :value="odds('win2')"
            :disabled="!canBet()"
            @click="openBet('win2')"
        /></view>
      </view>
    </template>

    <!-- 投注记录 -->
    <view class="sec-head">
      <text class="sec-title"><text class="bar gray" />投注记录</text>
    </view>
    <view class="records">
      <BetRecord
        v-for="bet in bets"
        :key="bet.id"
        :bet="bet"
        :match="match"
        :emulate="getEmulateResult(bet)"
        class="record-item"
      />
      <view
        v-if="bets.length > 0 && emulateScore.active"
        class="record-item emulate"
      >
        <view class="rec-left">
          <text class="rec-name">合计</text>
        </view>
        <view class="rec-right">
          <text class="rec-settle" :class="emulateTotal.state">
            {{ emulateTotal.text }}
          </text>
        </view>
      </view>
      <view v-if="bets.length === 0" class="rec-empty">还没有人投注</view>
    </view>

    <BetSheet
      :visible="sheetVisible"
      :match="match"
      :type="sheetType"
      @close="sheetVisible = false"
      @confirm="onConfirm"
    />
  </view>

  <view v-else class="loading">加载中…</view>
</template>

<style lang="scss" scoped>
@import "../../styles/tokens.scss";

.detail {
  padding: 24rpx;
}
.loading {
  text-align: center;
  color: $c-text2;
  padding: 120rpx 0;
}

.info-card {
  background: $c-card;
  border: 2rpx solid $c-border;
  border-radius: 24rpx;
  padding: 32rpx 28rpx;
  text-align: center;
  margin-bottom: 28rpx;
}
.status {
  font-size: 22rpx;
  padding: 6rpx 18rpx;
  border-radius: 40rpx;
}
.status.pending {
  background: rgba(25, 195, 125, 0.16);
  color: $c-green-bright;
}
.status.playing {
  background: rgba(245, 180, 49, 0.16);
  color: $c-gold;
}
.status.end {
  background: $c-line;
  color: $c-text2;
}
.teams {
  display: flex;
  align-items: center;
  margin: 26rpx 0 16rpx;
}
.team {
  flex: 1;
  min-width: 0;
  font-size: 36rpx;
  font-weight: 500;
  color: $c-text;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.team-right {
  text-align: right;
}
.vs {
  padding: 0 20rpx;
  font-size: 26rpx;
  color: $c-text3;
}
.score {
  padding: 0 20rpx;
  font-size: 40rpx;
  font-weight: 500;
  color: $c-text;
}
.time {
  font-size: 24rpx;
  color: $c-text2;
}
.closed {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: $c-gold;
}

.sec-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 4rpx 14rpx;
}
.sec-title {
  display: flex;
  align-items: center;
  font-size: 26rpx;
  color: $c-text;
}
.bar {
  width: 6rpx;
  height: 24rpx;
  background: $c-green;
  border-radius: 4rpx;
  margin-right: 12rpx;
}
.bar.gray {
  background: $c-text2;
}
.sec-sub {
  font-size: 24rpx;
  color: $c-text2;
}

.market {
  display: flex;
  gap: 20rpx;
  margin-bottom: 32rpx;
}
.cell {
  flex: 1;
  min-width: 0;
}

.records {
  background: $c-card;
  border: 2rpx solid $c-border;
  border-radius: 24rpx;
  overflow: hidden;
}

.record-item {
  border-bottom: 2rpx solid $c-line;

  &.emulate {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 22rpx 26rpx;
  }

  .rec-left {
    min-width: 0;
    flex: 1;
  }
  .rec-name {
    display: block;
    font-size: 26rpx;
    color: $c-text;
  }

  .rec-amount {
    display: block;
    font-size: 22rpx;
    color: $c-text2;
  }
  .rec-settle {
    display: block;
    margin-top: 4rpx;
    font-size: 28rpx;
    font-weight: 500;
  }
  .rec-settle.win {
    color: $c-green-bright;
  }
  .rec-settle.loss {
    color: $c-red;
  }
  .rec-settle.pending,
  .rec-settle.flat {
    color: $c-text2;
    font-weight: 400;
  }
}

.record-item:last-child {
  border-bottom: none;
}

.rec-empty {
  text-align: center;
  color: $c-text2;
  font-size: 24rpx;
  padding: 48rpx 0;
}
</style>
