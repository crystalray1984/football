<script setup lang="ts">
import { api } from "@/api";
import { sortRanking, profitDisplay, type RankSortKey } from "@/utils/bet";
import { formatPercent } from "@/utils/format";
import { onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";

const rows = ref<RankRow[]>([]);
const sortKey = ref<RankSortKey>("profit"); // 默认收益倒序

const refresh = async () => {
  try {
    const ret = await api<RankRow[]>({ url: "/api/rank" });
    if (ret.code === 0) {
      rows.value = ret.data || [];
    }
  } catch (e) {
    uni.showToast({ title: "网络异常，请重试", icon: "none" });
  }
};

const sorted = computed(() => sortRanking(rows.value, sortKey.value));

const setSort = (key: RankSortKey) => {
  sortKey.value = key;
};

onShow(() => {
  refresh();
});
</script>

<template>
  <view class="rank">
    <view class="rank-card">
      <view class="head">
        <text class="col-name th">名称</text>
        <text
          class="col-metric th"
          :class="{ active: sortKey === 'winRate' }"
          @click="setSort('winRate')"
          >胜率<text v-if="sortKey === 'winRate'" class="arrow">▼</text></text
        >
        <text
          class="col-metric th"
          :class="{ active: sortKey === 'profit' }"
          @click="setSort('profit')"
          >收益<text v-if="sortKey === 'profit'" class="arrow">▼</text></text
        >
      </view>

      <view v-if="sorted.length > 0" class="body">
        <view v-for="(r, i) in sorted" :key="i" class="row">
          <text class="col-name name">{{ r.name || "匿名" }}</text>
          <text class="col-metric rate">{{ formatPercent(r.winRate) }}</text>
          <text
            class="col-metric profit"
            :class="profitDisplay(r.profit).state"
            >{{ profitDisplay(r.profit).text }}</text
          >
        </view>
      </view>
      <view v-else class="empty">暂无数据</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import "../../styles/tokens.scss";
.rank {
  padding: 24rpx;
}
.rank-card {
  background: $c-card;
  border: 2rpx solid $c-border;
  border-radius: 24rpx;
  overflow: hidden;
}
.head {
  display: flex;
  align-items: center;
  padding: 22rpx 26rpx;
  border-bottom: 2rpx solid $c-line;
}
.th {
  font-size: 24rpx;
  color: $c-text2;
}
.th.active {
  color: $c-green-bright;
}
.arrow {
  margin-left: 6rpx;
  font-size: 20rpx;
}
.col-name {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.col-metric {
  width: 180rpx;
  text-align: right;
}
.row {
  display: flex;
  align-items: center;
  padding: 24rpx 26rpx;
  border-bottom: 2rpx solid $c-line;
}
.row:last-child {
  border-bottom: none;
}
.name {
  font-size: 28rpx;
  color: $c-text;
}
.rate {
  font-size: 28rpx;
  color: $c-text;
}
.profit {
  font-size: 28rpx;
  font-weight: 500;
}
.profit.win {
  color: $c-green-bright;
}
.profit.loss {
  color: $c-red;
}
.profit.flat {
  color: $c-text2;
}
</style>
