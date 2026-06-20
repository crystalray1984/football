<script setup lang="ts">
import { recordOddsText, settlement, type SettlementState } from "@/utils/bet";
import { type PropType } from "vue";

const props = defineProps({
  bet: {
    type: Object as PropType<BetRecord>,
    required: true,
  },
  match: {
    type: Object as PropType<MatchDetail>,
    required: true,
  },
  emulate: {
    type: Object as PropType<{
      state: SettlementState;
      result_profit: string;
      text: string;
    }>,
  },
});
</script>
<template>
  <view class="record">
    <view class="rec-left">
      <text class="rec-name">{{ bet.user?.name || "匿名" }}</text>
      <text class="rec-odds">{{ recordOddsText(bet, match) }}</text>
    </view>
    <view class="rec-right">
      <template v-if="emulate">
        <text class="rec-amount">{{ Number(bet.amount) }}</text>
        <text class="rec-settle" :class="emulate.state">
          {{ emulate.text }}
        </text>
      </template>
      <template v-else-if="bet.result === null">
        <text class="rec-settle" :class="settlement(bet).state">
          {{ Number(bet.amount) }}
        </text>
      </template>
      <template v-else>
        <text class="rec-amount">{{ Number(bet.amount) }}</text>
        <text class="rec-settle" :class="settlement(bet).state">
          {{ settlement(bet).text }}
        </text>
      </template>
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
.rec-name {
  display: block;
  font-size: 26rpx;
  color: $c-text;
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
