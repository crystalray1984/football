<script setup lang="ts">
defineProps<{
  /** 按钮标题（队名/平局，可含让球数） */
  label: string;
  /** 赔率/水位 */
  value: string;
  /** 是否选中（弹层内高亮） */
  selected?: boolean;
  /** 是否封盘禁用 */
  disabled?: boolean;
}>();

const emit = defineEmits<{ click: [] }>();

function onTap() {
  // 透传点击，禁用态不响应
  emit("click");
}
</script>

<template>
  <view
    class="odds-btn"
    :class="{ 'is-selected': selected, 'is-disabled': disabled }"
    @click="!disabled && onTap()"
  >
    <text v-if="selected" class="check">✓</text>
    <view class="label">{{ label }}</view>
    <view class="value">{{ value }}</view>
  </view>
</template>

<style lang="scss" scoped>
@import "../../styles/tokens.scss";

.odds-btn {
  width: 100%;
  min-width: 0;
  position: relative;
  background: $c-odds;
  border: 2rpx solid $c-line2;
  border-radius: 16rpx;
  padding: 20rpx 8rpx;
  box-sizing: border-box;
  text-align: center;
}

.odds-btn.is-selected {
  border-color: $c-green;
  background: rgba(25, 195, 125, 0.14);
}

.odds-btn.is-disabled {
  opacity: 0.45;
}

.check {
  position: absolute;
  top: 6rpx;
  right: 12rpx;
  font-size: 22rpx;
  color: $c-green-bright;
}

.label {
  width: 100%;
  font-size: 24rpx;
  line-height: 1.25;
  color: $c-text2;
  overflow: hidden;
  text-overflow: ellipsis;
  /* autoprefixer: ignore next */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.value {
  margin-top: 6rpx;
  font-size: 34rpx;
  font-weight: 500;
  color: $c-odds-text;
}

.odds-btn.is-selected .value {
  color: $c-green-bright;
}
</style>
