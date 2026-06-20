<script setup lang="ts">
import { api, setToken } from "@/api";
import { ref } from "vue";

const emit = defineEmits<{
  success: [];
}>();

const nickname = ref("");

const submit = async () => {
  if (nickname.value.trim() === "") {
    uni.showToast({
      title: "需要输入姓名",
      icon: "none",
    });
    return;
  }

  uni.showLoading();

  const resCode = await uni.login();

  const ret = await api<string>({
    method: "POST",
    url: "/api/register",
    data: {
      name: nickname.value.trim(),
      code: resCode.code,
    },
  });

  if (ret.code) {
    uni.hideLoading();
    uni.showToast({
      title: ret.msg,
      icon: "none",
    });
    return;
  }

  setToken(ret.data);

  uni.hideLoading();
  uni.showToast({
    title: "登录成功",
    icon: "success",
  });
  setTimeout(() => emit("success"), 1500);
};
</script>

<template>
  <view class="login">
    <view class="brand">
      <view class="badge"><text class="badge-text">球</text></view>
      <text class="title">足球竞猜</text>
      <text class="subtitle">输入姓名，进入今日盘口</text>
    </view>

    <view class="form">
      <view class="field">
        <input
          v-model="nickname"
          type="nickname"
          class="name-input"
          placeholder="输入姓名，不填真名不结账"
          placeholder-style="color: #5d6b85"
        />
      </view>
      <view class="btn-enter" @click="submit">进入</view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import "../../styles/tokens.scss";

.login {
  padding: 140rpx 48rpx 0;
}

.brand {
  text-align: center;
  margin-bottom: 72rpx;
}
.badge {
  width: 120rpx;
  height: 120rpx;
  margin: 0 auto 28rpx;
  border-radius: 32rpx;
  background: rgba(25, 195, 125, 0.16);
  border: 2rpx solid $c-green;
  display: flex;
  align-items: center;
  justify-content: center;
}
.badge-text {
  font-size: 56rpx;
  font-weight: 500;
  color: $c-green-bright;
}
.title {
  display: block;
  font-size: 48rpx;
  font-weight: 500;
  color: $c-text;
}
.subtitle {
  display: block;
  margin-top: 12rpx;
  font-size: 26rpx;
  color: $c-text2;
}

.form {
  margin-top: 20rpx;
}
.field {
  background: $c-card;
  border: 2rpx solid $c-line2;
  border-radius: 16rpx;
  padding: 6rpx 28rpx;
  margin-bottom: 28rpx;
}
.name-input {
  height: 88rpx;
  font-size: 30rpx;
  color: $c-text;
}
.btn-enter {
  text-align: center;
  background: $c-green;
  color: #06231a;
  font-size: 32rpx;
  font-weight: 500;
  border-radius: 20rpx;
  padding: 26rpx;
}
</style>
