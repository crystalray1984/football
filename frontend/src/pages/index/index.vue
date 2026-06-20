<template>
  <Login v-if="scene === 'login'" @success="scene = 'matches'" />
  <Matches v-else-if="scene === 'matches'" :active="active" />
</template>

<script setup lang="ts">
import { onMounted, ref } from "vue";
import { api, setToken } from "@/api";
import Login from "./Login.vue";
import Matches from "./Matches.vue";
import { onHide, onShow } from "@dcloudio/uni-app";

/**
 * 显示的内容组件
 */
const scene = ref("");
/**
 * 页面是否处于激活状态
 */
const active = ref(true);

onShow(() => {
  active.value = true;
});
onHide(() => {
  active.value = false;
});

onMounted(async () => {
  const res = await uni.login();
  const retAuth = await api<string>({
    method: "POST",
    url: "/api/auth",
    data: {
      code: res.code,
    },
  });

  if (retAuth.code === 0) {
    setToken(retAuth.data);
    //进入比赛列表页
    scene.value = "matches";
    return;
  }

  if (retAuth.code !== -2) {
    return;
  }

  //登录
  scene.value = "login";
});
</script>

<style lang="scss"></style>
