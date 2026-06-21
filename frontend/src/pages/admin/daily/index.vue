<script setup lang="ts">
import { api } from "@/api";
import { isAdmin } from "@/utils/admin";
import { groupUserDailyProfit } from "@/utils/bet";
import { onShow } from "@dcloudio/uni-app";
import { computed, ref } from "vue";
import AdminDayCard from "./AdminDayCard.vue";

const rows = ref<AdminBetRow[]>([]);

const refresh = async () => {
  try {
    const ret = await api<AdminBetRow[]>({ url: "/api/admin/daily-profit" });
    if (ret.code === 0) {
      rows.value = ret.data || [];
    }
  } catch (e) {
    uni.showToast({ title: "网络异常，请重试", icon: "none" });
  }
};

const groups = computed(() => groupUserDailyProfit(rows.value));

onShow(() => {
  if (!isAdmin()) {
    uni.showToast({ title: "无权限", icon: "none" });
    setTimeout(() => uni.navigateBack(), 800);
    return;
  }
  refresh();
});
</script>

<template>
  <view class="admin-daily">
    <view v-if="groups.length > 0">
      <AdminDayCard v-for="g in groups" :key="g.date" :group="g" />
    </view>
    <view v-else class="empty">暂无数据</view>
  </view>
</template>

<style lang="scss" scoped>
@import "../../../styles/tokens.scss";
.admin-daily {
  padding: 24rpx;
}
.empty {
  text-align: center;
  color: $c-text2;
  font-size: 24rpx;
  padding: 80rpx 0;
}
</style>
