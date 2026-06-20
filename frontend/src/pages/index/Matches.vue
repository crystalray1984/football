<script setup lang="ts">
import { api } from "@/api";
import { ref, watch } from "vue";
import dayjs from "dayjs";

const props = defineProps({
  /**
   * 当前页面是否激活
   */
  active: {
    type: Boolean,
    default: false,
  },
});

/**
 * 比赛列表
 */
const matches = ref<Match[]>([]);

/**
 * 读取比赛列表
 */
const getList = async () => {
  const ret = await api<Match[]>({
    url: "/api/match/list",
  });
  if (!ret.code) {
    matches.value = ret.data;
  }
};

let timer: any;

watch(
  () => props.active,
  (active) => {
    if (active) {
      //页面处于激活状态
      getList();
      timer = setInterval(getList, 10000);
    } else {
      //页面处于非激活状态
      clearInterval(timer);
    }
  },
  { immediate: true },
);
</script>
<template></template>
<style lang="scss" scoped></style>
