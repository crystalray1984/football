<script setup lang="ts">
import { profitDisplay, type BetDayGroup } from "@/utils/bet";
import { formatDay } from "@/utils/format";
import { computed, type PropType } from "vue";
import MyBetRecord from "./MyBetRecord.vue";

const props = defineProps({
  group: {
    type: Object as PropType<BetDayGroup>,
    required: true,
  },
});

const summary = computed(() => profitDisplay(props.group.profit));
</script>

<template>
  <view class="day-group">
    <view class="day-head">
      <text class="day-date">{{ formatDay(group.date) }}</text>
      <text class="day-sum" :class="summary.state">{{ summary.text }}</text>
    </view>
    <view class="day-body">
      <MyBetRecord
        v-for="bet in group.bets"
        :key="bet.id"
        :bet="bet"
        class="record-item"
      />
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import "../../styles/tokens.scss";
.day-group {
  background: $c-card;
  border: 2rpx solid $c-border;
  border-radius: 24rpx;
  overflow: hidden;
  margin-bottom: 24rpx;
}
.day-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 26rpx;
  border-bottom: 2rpx solid $c-line;
}
.day-date {
  font-size: 24rpx;
  color: $c-text2;
}
.day-sum {
  font-size: 28rpx;
  font-weight: 600;
}
.day-sum.win {
  color: $c-green-bright;
}
.day-sum.loss {
  color: $c-red;
}
.day-sum.flat {
  color: $c-text2;
}
.record-item {
  border-bottom: 2rpx solid $c-line;
}
.record-item:last-child {
  border-bottom: none;
}
</style>
