<script setup lang="ts">
import { onLaunch, onShow, onHide } from "@dcloudio/uni-app";
onLaunch(() => {
  console.log("App Launch");
});
onShow(() => {
  console.log("App Show");
});
onHide(() => {
  console.log("App Hide");
});
</script>
<style lang="scss">
@import "./styles/tokens.scss";

page {
  background-color: $c-bg;
  color: $c-text;
}

.flex-1 {
  flex: 1;
}
</style>
