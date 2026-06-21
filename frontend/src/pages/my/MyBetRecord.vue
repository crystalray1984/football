<script setup lang="ts">
import { recordOddsText, settlement } from "@/utils/bet";
import { formatTime } from "@/utils/format";
import { computed, type PropType } from "vue";

const props = defineProps({
  bet: {
    type: Object as PropType<MyBet>,
    required: true,
  },
});

const settle = computed(() => settlement(props.bet));
</script>

<template>
  <view class="record">
    <view class="rec-left">
      <text class="rec-match"
        >{{ bet.match.team1_name }} vs {{ bet.match.team2_name }}</text
      >
      <text class="rec-odds"
        >{{ formatTime(bet.match.match_time) }} ·
        {{ recordOddsText(bet, bet.match) }}</text
      >
    </view>
    <view class="rec-right">
      <text class="rec-amount">{{ Number(bet.amount) }}</text>
      <text class="rec-settle" :class="settle.state">
        {{ settle.text }}
      </text>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import "../../styles/tokens.scss";
.record {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 26rpx;
}
.rec-left {
  min-width: 0;
  flex: 1;
}
.rec-match {
  display: block;
  font-size: 26rpx;
  color: $c-text;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.rec-odds {
  display: block;
  margin-top: 4rpx;
  font-size: 22rpx;
  color: $c-text2;
}
.rec-right {
  text-align: right;
  flex-shrink: 0;
  margin-left: 16rpx;
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
</style>
