<script setup lang="ts">
import { api } from "@/api";
import { ref, watch } from "vue";
import { formatMatchTime, matchStatusText } from "@/utils/format";

const props = defineProps({
  /** 当前页面是否激活 */
  active: {
    type: Boolean,
    default: false,
  },
});

/** 比赛列表 */
const matches = ref<Match[]>([]);

/** 读取比赛列表 */
const getList = async () => {
  const ret = await api<Match[]>({ url: "/api/match/list" });
  if (!ret.code) {
    matches.value = ret.data;
  }
};

const goDetail = (id: number) => {
  uni.navigateTo({ url: `/pages/match/index?match_id=${id}` });
};

let timer: any;

watch(
  () => props.active,
  (active) => {
    if (active) {
      getList();
      timer = setInterval(getList, 10000);
    } else {
      clearInterval(timer);
    }
  },
  { immediate: true },
);
</script>

<template>
  <view class="match-list">
    <view
      v-for="m in matches"
      :key="m.id"
      class="match-card"
      @click="goDetail(m.id)"
    >
      <view class="row-top">
        <text class="time">{{ formatMatchTime(m.match_time) }}</text>
        <text class="status" :class="m.state">{{ matchStatusText(m.state) }}</text>
      </view>
      <view class="row-teams">
        <text class="team">{{ m.team1_name }}</text>
        <text v-if="m.has_score && m.score1 !== null" class="score">
          {{ m.score1 }} : {{ m.score2 }}
        </text>
        <text v-else class="vs">VS</text>
        <text class="team team-right">{{ m.team2_name }}</text>
        <text class="chevron">›</text>
      </view>
    </view>

    <view v-if="matches.length === 0" class="empty">暂无比赛</view>
  </view>
</template>

<style lang="scss" scoped>
@import "../../styles/tokens.scss";

.match-list {
  padding: 24rpx;
}

.match-card {
  background: $c-card;
  border: 2rpx solid $c-border;
  border-radius: 24rpx;
  padding: 24rpx 28rpx;
  margin-bottom: 20rpx;
}

.row-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22rpx;
}

.time {
  font-size: 24rpx;
  color: $c-text2;
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

.row-teams {
  display: flex;
  align-items: center;
}

.team {
  flex: 1;
  min-width: 0;
  font-size: 32rpx;
  font-weight: 500;
  color: $c-text;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.team-right {
  text-align: right;
}

.vs {
  padding: 0 24rpx;
  font-size: 24rpx;
  color: $c-text3;
}

.score {
  padding: 0 20rpx;
  font-size: 36rpx;
  font-weight: 500;
  color: $c-text;
}

.chevron {
  margin-left: 12rpx;
  font-size: 32rpx;
  color: $c-text3;
}

.empty {
  text-align: center;
  color: $c-text2;
  font-size: 26rpx;
  padding: 80rpx 0;
}
</style>
