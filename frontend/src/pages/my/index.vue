<script setup lang="ts">
import { api, getToken } from "@/api";
import { groupBetsByDay, profitDisplay, sumSettledProfit } from "@/utils/bet";
import { onShareAppMessage, onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import MyBetDayGroup from "./MyBetDayGroup.vue";

const bets = ref<MyBet[]>([]);

/**
 * 每次进入刷新；未登录不请求接口
 */
const refresh = async () => {
  if (!getToken()) {
    bets.value = [];
    return;
  }
  try {
    const ret = await api<MyBet[]>({ url: "/api/my/bets" });
    if (ret.code === 0) {
      bets.value = ret.data || [];
    }
  } catch (e) {
    uni.showToast({ title: "网络异常，请重试", icon: "none" });
  }
};

/**
 * 合计收益（已结算净盈亏之和）
 */
const total = computed(() => profitDisplay(sumSettledProfit(bets.value)));

/**
 * 按比赛日期分组
 */
const groups = computed(() => groupBetsByDay(bets.value));

/**
 * 未结算笔数
 */
const pendingCount = computed(
  () => bets.value.filter((b) => b.result_profit === null).length,
);

onShow(() => {
  refresh();
});

onShareAppMessage(() => {
  return {};
});
</script>

<template>
  <view class="mine">
    <view class="summary">
      <text class="summary-label">合计收益</text>
      <text class="summary-value" :class="total.state">{{ total.text }}</text>
      <text v-if="pendingCount > 0" class="summary-tip"
        >未结算 {{ pendingCount }} 笔不计入</text
      >
    </view>

    <view class="sec-head">
      <text class="sec-title"><text class="bar gray" />投注记录</text>
    </view>

    <view v-if="groups.length > 0">
      <MyBetDayGroup v-for="g in groups" :key="g.date" :group="g" />
    </view>
    <view v-else class="rec-empty">暂无投注记录</view>
  </view>
</template>

<style lang="scss" scoped>
@import "../../styles/tokens.scss";

.mine {
  padding: 24rpx;
}

.summary {
  background: $c-card;
  border: 2rpx solid $c-border;
  border-radius: 24rpx;
  padding: 48rpx 28rpx;
  text-align: center;
  margin-bottom: 28rpx;
}
.summary-label {
  display: block;
  font-size: 24rpx;
  color: $c-text2;
}
.summary-value {
  display: block;
  margin-top: 12rpx;
  font-size: 72rpx;
  font-weight: 600;
  color: $c-text;
}
.summary-value.win {
  color: $c-green-bright;
}
.summary-value.loss {
  color: $c-red;
}
.summary-value.flat {
  color: $c-text;
}
.summary-tip {
  display: block;
  margin-top: 12rpx;
  font-size: 22rpx;
  color: $c-text3;
}

.sec-head {
  display: flex;
  align-items: center;
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

.rec-empty {
  text-align: center;
  color: $c-text2;
  font-size: 24rpx;
  padding: 80rpx 0;
}
</style>
