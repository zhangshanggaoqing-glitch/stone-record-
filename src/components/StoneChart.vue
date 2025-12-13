<template>
  <view class="chart-wrapper">
    
    <view class="info-panel">
      <view class="info-date">
        <text class="icon">📅</text>
        <text class="text">{{ currentInfo.date }}</text>
      </view>
      <view class="info-stats">
        <view class="stat-item">
          <text class="label">入 In</text>
          <text class="val text-blue">+{{ currentInfo.totalIn }}</text>
        </view>
        <view class="divider"></view>
        <view class="stat-item">
          <text class="label">出 Out</text>
          <text class="val text-orange">-{{ currentInfo.totalOut }}</text>
        </view>
        <view class="divider"></view>
        <view class="stat-item">
          <text class="label">平 Bal</text>
          <text 
            class="val"
            :class="currentInfo.balance >= 0 ? 'text-emerald' : 'text-amber'"
          >
            {{ currentInfo.balance > 0 ? '+' : '' }}{{ currentInfo.balance }}
          </text>
        </view>
      </view>
    </view>

    <view class="chart-body">
      <view class="y-axis-col">
        <text 
          v-for="tick in yTicks" 
          :key="tick.val" 
          class="y-label"
          :class="{ 'bold-label': tick.val === 0 }"
          :style="{ top: tick.pct + '%' }"
        >
          {{ tick.val }}
        </text>
      </view>

      <view class="chart-content">
        <view class="svg-box">
          <view 
            v-for="tick in yTicks" 
            :key="`grid-${tick.val}`"
            class="html-grid-line"
            :class="{ 'zero-line': tick.val === 0 }"
            :style="{ top: tick.pct + '%' }"
          ></view>

          <svg 
            width="100%" 
            height="100%" 
            viewBox="0 0 100 100" 
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
            class="stone-svg"
          >
            <defs>
              <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stop-color="#059669" stop-opacity="0.15" />
                <stop :offset="zeroOffsetPercent" stop-color="#059669" stop-opacity="0" />
                <stop :offset="zeroOffsetPercent" stop-color="#D97706" stop-opacity="0" />
                <stop offset="100%" stop-color="#D97706" stop-opacity="0.15" />
              </linearGradient>
            </defs>

            <path :d="areaPath" fill="url(#chartGradient)" stroke="none" />
            <path :d="linePath" fill="none" stroke="#4B5563" stroke-width="1.5" vector-effect="non-scaling-stroke" />

            <line 
              v-if="points.length > 0 && selectedIndex >= 0"
              :x1="points[selectedIndex].x + '%'" 
              y1="0" 
              :x2="points[selectedIndex].x + '%'" 
              y2="100%" 
              stroke="#1F2937" 
              stroke-width="1"
              stroke-opacity="0.5"
              stroke-dasharray="4,4"
              vector-effect="non-scaling-stroke"
            />
          </svg>
          
          <view class="touch-overlay">
            <view 
              v-for="(item, idx) in data" 
              :key="idx" 
              class="touch-col"
              @click.stop="handleTouch(idx)"
            ></view>
          </view>
        </view>

        <view class="x-axis-row">
          <text 
            v-for="(pt, idx) in points" 
            :key="idx" 
            class="x-label"
            :class="{ 'active': idx === selectedIndex }"
            :style="{ left: pt.x + '%' }"
          >
            {{ props.data[idx].date }}
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

interface DailyData {
  date: string;
  timestamp: number; // Important for linking
  balance: number;
  totalIn: number;
  totalOut: number;
}

const props = defineProps<{ 
  data: DailyData[],
  activeDate: number // [New] Controlled Prop
}>();

const emit = defineEmits<{
  (e: 'date-change', timestamp: number): void
}>();

const selectedIndex = ref(-1);

// Helper
const isSameDay = (ts1: number, ts2: number) => {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return d1.toDateString() === d2.toDateString();
};

// [Core] Watch activeDate prop to sync chart selection
watch(() => props.activeDate, (newDate) => {
  if (props.data && props.data.length > 0) {
    const idx = props.data.findIndex(item => isSameDay(item.timestamp, newDate));
    selectedIndex.value = idx; // If -1 (not found), highlight disappears, which is correct behavior
  }
}, { immediate: true });

const currentInfo = computed(() => {
  // Show info for selected day, OR last available day if nothing selected
  if (!props.data || props.data.length === 0) {
    return { date: '--', balance: 0, totalIn: 0, totalOut: 0 };
  }
  if (selectedIndex.value >= 0) {
    return props.data[selectedIndex.value];
  }
  return props.data[props.data.length - 1];
});

// --- Axis Logic (Same as V5) ---
const axisStats = computed(() => {
  if (!props.data.length) return { min: -500, max: 500, range: 1000 };
  const values = props.data.map(d => d.balance);
  let minData = Math.min(...values);
  let maxData = Math.max(...values);
  minData = Math.min(minData, 0);
  maxData = Math.max(maxData, 0);
  if (maxData - minData < 100) { maxData += 100; minData -= 100; }

  const calculateNiceStep = (rawRange: number, targetTicks: number) => {
    const roughStep = rawRange / targetTicks;
    const magnitude = Math.pow(10, Math.floor(Math.log10(roughStep)));
    const normalizedStep = roughStep / magnitude;
    let niceStep;
    if (normalizedStep < 1.5) niceStep = 1;
    else if (normalizedStep < 3) niceStep = 2;
    else if (normalizedStep < 7) niceStep = 5;
    else niceStep = 10;
    return niceStep * magnitude;
  };
  const step = calculateNiceStep(maxData - minData, 4);
  const niceMin = Math.floor(minData / step) * step;
  const niceMax = Math.ceil(maxData / step) * step;
  return { min: niceMin, max: niceMax, range: niceMax - niceMin || 100 };
});

const yTicks = computed(() => {
  const { min, max } = axisStats.value;
  const step = (max - min) / 4;
  const ticks = [];
  for (let val = min; val <= max + 0.001; val += step) {
    const normalized = (val - min) / (max - min); 
    const pct = (1 - normalized) * 100;
    ticks.push({ val: Math.round(val), pct });
  }
  return ticks;
});

const zeroOffsetPercent = computed(() => {
  const { min, max } = axisStats.value;
  const normalizedZero = (0 - min) / (max - min);
  const ratio = 1 - normalizedZero; 
  return `${Math.max(0, Math.min(1, ratio)) * 100}%`;
});

const points = computed(() => {
  const { min, max } = axisStats.value;
  const count = props.data.length;
  const SIDE_PADDING = 6;
  const AVAILABLE_WIDTH = 100 - (SIDE_PADDING * 2);

  return props.data.map((d, i) => {
    const x = SIDE_PADDING + (i / (count - 1)) * AVAILABLE_WIDTH;
    const normalized = (d.balance - min) / (max - min);
    const y = (1 - normalized) * 100;
    return { x, y, val: d.balance };
  });
});

const getSmoothPath = (pts: typeof points.value) => {
  if (pts.length < 2) return '';
  let d = `M ${pts[0].x} ${pts[0].y}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const curr = pts[i];
    const next = pts[i+1];
    const cx = (curr.x + next.x) / 2;
    d += ` C ${cx} ${curr.y}, ${cx} ${next.y}, ${next.x} ${next.y}`;
  }
  return d;
};
const linePath = computed(() => getSmoothPath(points.value));
const areaPath = computed(() => {
  if (!points.value.length) return '';
  const first = points.value[0];
  const last = points.value[points.value.length - 1];
  return `${linePath.value} L ${last.x} 100 L ${first.x} 100 Z`;
});

// [Core] Handle Touch -> Emit Change
const handleTouch = (idx: number) => {
  // Update local visual instantly for responsiveness
  selectedIndex.value = idx; 
  // Emit event to parent to update Global Store
  uni.vibrateShort({ success: () => {} });
  emit('date-change', props.data[idx].timestamp);
};
</script>

<style lang="scss" scoped>
/* Design Tokens */
$text-primary: #1F2937;
$text-secondary: #6B7280;
$color-emerald: #059669;
$color-amber: #D97706;
$color-blue: #2563EB;
$color-orange: #DC2626;

.chart-wrapper { display: flex; flex-direction: column; width: 100%; }

/* Info Panel */
.info-panel {
  display: flex; justify-content: space-between; align-items: center; 
  padding: 20rpx 30rpx; margin-bottom: 20rpx; border-radius: 20rpx;
  background: rgba(255, 255, 255, 0.7); border: 1px solid rgba(0, 0, 0, 0.05);
  box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.03);

  .info-date {
    display: flex; align-items: center;
    .icon { margin-right: 10rpx; font-size: 24rpx; }
    .text { font-size: 26rpx; color: $text-primary; font-weight: 600; font-family: monospace; }
  }
  .info-stats {
    display: flex; align-items: center;
    .stat-item {
      display: flex; flex-direction: column; align-items: flex-end;
      .label { font-size: 18rpx; color: $text-secondary; margin-bottom: 4rpx; }
      .val { font-size: 26rpx; font-weight: 700; font-family: monospace; }
    }
    .divider { width: 1px; height: 20rpx; background: #E5E7EB; margin: 0 20rpx; }
    .text-blue { color: $color-blue; }
    .text-orange { color: $color-orange; }
    .text-emerald { color: $color-emerald; }
    .text-amber { color: $color-amber; }
  }
}

/* Hybrid Chart Body */
.chart-body { display: flex; flex-direction: row; height: 360rpx; width: 100%; }

.y-axis-col { width: 70rpx; position: relative; height: 300rpx; margin-right: 10rpx; }
.y-label {
  position: absolute; width: 100%; text-align: right; font-size: 22rpx; color: $text-secondary; font-family: monospace; transform: translateY(-50%);
  &.bold-label { color: $text-primary; font-weight: 700; }
}

.chart-content { flex: 1; display: flex; flex-direction: column; }

.svg-box { position: relative; height: 300rpx; width: 100%; }
.html-grid-line {
  position: absolute; left: 0; width: 100%; height: 1px; border-top: 1px dashed #E5E7EB; z-index: 1;
  &.zero-line { border-top: 1px solid #9CA3AF; }
}
.stone-svg { position: relative; width: 100%; height: 100%; display: block; z-index: 2; pointer-events: none; }
.touch-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; display: flex; z-index: 99; }
.touch-col { flex: 1; height: 100%; }

/* X-Axis */
.x-axis-row {
  height: 60rpx; width: 100%; position: relative; margin-top: 10rpx;
}
.x-label {
  position: absolute; top: 0; font-size: 22rpx; color: $text-secondary; font-family: monospace; white-space: nowrap; transition: all 0.2s;
  transform: translateX(-50%);
  &.active { color: $text-primary; font-weight: 700; }
}
</style>