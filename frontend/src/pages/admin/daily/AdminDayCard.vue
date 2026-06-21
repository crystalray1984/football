<script setup lang="ts">
import { profitDisplay, type DailyUserProfit } from "@/utils/bet";
import { formatDay } from "@/utils/format";
import { computed, type PropType } from "vue";

const props = defineProps({
  group: {
    type: Object as PropType<DailyUserProfit>,
    required: true,
  },
});

const summary = computed(() => profitDisplay(props.group.total));
</script>

<template>
  <view class="day-group">
    <view class="day-head">
      <text class="day-date">{{ formatDay(group.date) }}</text>
      <text class="day-sum" :class="summary.state">{{ summary.text }}</text>
    </view>
    <view class="day-body">
      <view v-for="(u, i) in group.users" :key="i" class="user-row">
        <text class="user-name">{{ u.name }}</text>
        <text class="user-profit" :class="profitDisplay(u.profit).state">{{
          profitDisplay(u.profit).text
        }}</text>
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import "../../../styles/tokens.scss";
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
.user-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 22rpx 26rpx;
  border-bottom: 2rpx solid $c-line;
}
.user-row:last-child {
  border-bottom: none;
}
.user-name {
  font-size: 28rpx;
  color: $c-text;
}
.user-profit {
  font-size: 28rpx;
  font-weight: 500;
}
.user-profit.win {
  color: $c-green-bright;
}
.user-profit.loss {
  color: $c-red;
}
.user-profit.flat {
  color: $c-text2;
}
</style>
