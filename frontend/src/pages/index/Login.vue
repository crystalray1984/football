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
    uni.showToast({
      title: ret.msg,
      icon: "fail",
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
  <view class="login-frame">
    <view class="nickname-wrapper">
      <input
        v-model="nickname"
        type="nickname"
        class="nickname-input"
        placeholder="输入姓名，不填真名不结账"
      />
    </view>

    <view class="btn-box">
      <button class="btn-submit" @click="submit">进入</button>
    </view>
  </view>
</template>
<style lang="scss" scoped>
.login-frame {
  display: flex;
  flex-direction: column;
  padding: 40rpx 0;
  box-sizing: border-box;
}

.avatar-wrapper {
  border: 0 none;
  padding: 0;
  margin: 0;
  width: 200rpx;
  height: 200rpx;
  border: 0 none;
  align-self: center;

  .avatar {
    width: 200rpx;
    height: 200rpx;
    border: 0 none;
    display: block;
  }
}

.avatar-tip {
  margin-top: 10rpx;
  font-size: 24rpx;
  text-align: center;
}

.nickname-wrapper {
  border-top: 1rpx solid #ebedf0;
  border-bottom: 1rpx solid #ebedf0;
  margin-top: 60rpx;
}

.nickname-input {
  text-align: center;
  height: 80rpx;
  background-color: #fff;
}

.btn-box {
  position: relative;
  margin: 60rpx 40rpx;

  .btn-submit {
    position: relative;
    color: #fff;
    background-color: #1989fa;
    border: 1rpx solid #1989fa;
    flex-shrink: 0;
    display: block;
    width: 100%;
  }
}
</style>
