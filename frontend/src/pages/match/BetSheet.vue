<script setup lang="ts">
import {
  directionLabel,
  displayOdds,
  isAsian,
  oddsValue,
  potentialWin,
  validateAmount,
  type BetType,
} from "@/utils/bet";
import { handicap } from "@/utils/format";
import { computed, ref, watch } from "vue";
import OddsButton from "./OddsButton.vue";

const props = defineProps<{
  visible: boolean;
  match: MatchDetail;
  /** 唤起时点击的方向 */
  type: BetType;
}>();

const emit = defineEmits<{
  close: [];
  confirm: [{ type: BetType; amount: number }];
}>();

const quickAmounts = [50, 100, 200, 500];

const selected = ref<BetType>(props.type);
const amountInput = ref("");

// 弹层不持有盘口数据，直接读页面（轮询源）的 props.match，盘口/赔率跟随页面实时更新
watch(
  () => props.visible,
  (v) => {
    if (v) {
      selected.value = props.type;
      amountInput.value = "";
    }
  },
);

/** 该弹层展示的方向组 */
const group = computed<BetType[]>(() =>
  isAsian(props.type) ? ["ah1", "ah2"] : ["win1", "draw", "win2"],
);
const isAh = computed(() => isAsian(props.type));

const amount = computed(() => parseInt(amountInput.value || "0", 10) || 0);
const valid = computed(() => validateAmount(amount.value));
const win = computed(() =>
  potentialWin(amount.value, oddsValue(selected.value, props.match)),
);

const subtitle = computed(() => {
  const base = `${props.match.team1_name} VS ${props.match.team2_name}`;
  if (isAh.value) {
    return `${base} · 让球 ${props.match.team1_name} ${handicap(
      props.match.ah_condition,
    )}`;
  }
  return base;
});

function onInput(e: any) {
  amountInput.value = String(e.detail.value).replace(/[^\d]/g, "");
}
function pick(v: number) {
  amountInput.value = String(v);
}
function confirm() {
  if (!valid.value) return;
  emit("confirm", { type: selected.value, amount: amount.value });
}

function btnLabel(t: BetType): string {
  return directionLabel(t, props.match);
}
function btnValue(t: BetType): string {
  return displayOdds(oddsValue(t, props.match));
}
</script>

<template>
  <view v-if="visible" class="sheet-mask" @click="emit('close')">
    <view class="sheet" @click.stop>
      <view class="grabber" />

      <view class="head">
        <text class="title">投注 · {{ isAh ? "让球盘" : "胜平负" }}</text>
        <text class="close" @click="emit('close')">✕</text>
      </view>
      <text class="subtitle">{{ subtitle }}</text>

      <view class="group" :class="{ three: !isAh }">
        <view v-for="t in group" :key="t" class="cell">
          <OddsButton
            :label="btnLabel(t)"
            :value="btnValue(t)"
            :selected="selected === t"
            @click="selected = t"
          />
        </view>
      </view>

      <text class="field-label">投注金额</text>
      <view class="amount-box">
        <text class="yen">¥</text>
        <input
          class="amount-input"
          type="number"
          :value="amountInput"
          placeholder="50 - 500"
          placeholder-style="color: #5d6b85"
          @input="onInput"
        />
        <text class="limit">限 50 - 500</text>
      </view>

      <view class="chips">
        <text
          v-for="q in quickAmounts"
          :key="q"
          class="chip"
          :class="{ active: amount === q }"
          @click="pick(q)"
        >
          {{ q }}
        </text>
      </view>

      <view class="win-row">
        <text class="win-label">预计可赢</text>
        <text class="win-value">¥{{ win }}</text>
      </view>

      <view class="confirm" :class="{ disabled: !valid }" @click="confirm">
        确认投注
      </view>
    </view>
  </view>
</template>

<style lang="scss" scoped>
@import "../../styles/tokens.scss";

.sheet-mask {
  position: fixed;
  left: 0;
  right: 0;
  top: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.55);
  z-index: 100;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.sheet {
  background: #161d2c;
  border-top: 2rpx solid $c-border;
  border-radius: 36rpx 36rpx 0 0;
  padding: 28rpx 32rpx calc(32rpx + env(safe-area-inset-bottom));
}

.grabber {
  width: 72rpx;
  height: 8rpx;
  background: $c-line2;
  border-radius: 40rpx;
  margin: 0 auto 28rpx;
}

.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.title {
  font-size: 30rpx;
  font-weight: 500;
  color: $c-text;
}
.close {
  font-size: 34rpx;
  color: $c-text2;
}
.subtitle {
  display: block;
  margin: 8rpx 0 28rpx;
  font-size: 24rpx;
  color: $c-text2;
}

.group {
  display: flex;
  gap: 20rpx;
  margin-bottom: 36rpx;
}
.cell {
  flex: 1;
  min-width: 0;
}

.field-label {
  display: block;
  font-size: 26rpx;
  color: $c-text;
  margin-bottom: 16rpx;
}

.amount-box {
  display: flex;
  align-items: center;
  background: $c-bg;
  border: 2rpx solid $c-line2;
  border-radius: 16rpx;
  padding: 20rpx 26rpx;
  margin-bottom: 20rpx;
}
.yen {
  font-size: 34rpx;
  color: $c-text2;
  margin-right: 14rpx;
}
.amount-input {
  flex: 1;
  font-size: 38rpx;
  font-weight: 500;
  color: $c-text;
}
.limit {
  font-size: 22rpx;
  color: $c-text3;
}

.chips {
  display: flex;
  gap: 16rpx;
  margin-bottom: 36rpx;
}
.chip {
  flex: 1;
  text-align: center;
  font-size: 26rpx;
  color: #b9c4d6;
  background: $c-odds;
  border: 2rpx solid $c-line2;
  border-radius: 16rpx;
  padding: 14rpx 0;
}
.chip.active {
  color: $c-green-bright;
  background: rgba(25, 195, 125, 0.14);
  border-color: $c-green;
}

.win-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 4rpx;
  margin-bottom: 28rpx;
}
.win-label {
  font-size: 24rpx;
  color: $c-text2;
}
.win-value {
  font-size: 30rpx;
  font-weight: 500;
  color: $c-green-bright;
}

.confirm {
  text-align: center;
  background: $c-green;
  color: #06231a;
  font-size: 30rpx;
  font-weight: 500;
  border-radius: 20rpx;
  padding: 26rpx;
}
.confirm.disabled {
  opacity: 0.45;
}
</style>
