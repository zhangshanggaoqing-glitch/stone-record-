<template>
  <view class="stone-container">
    <view class="status-bar-placeholder"></view>

    <view class="top-header">
      <view class="text-group">
        <text class="greeting">Stone Record</text>
        <text class="sub-greeting">液体平衡监测</text>
      </view>
      <view class="settings-btn" @click="goToSettings">
        <text class="gear-icon">⚙️</text>
      </view>
    </view>

    <view class="dashboard-section">
      <view class="balance-card">
        <text class="card-label">今日实时 (Real-time Today)</text>
        
        <view class="balance-value-box">
          <text class="balance-num" :class="isRealTimePositive ? 'text-emerald' : 'text-amber'">
            {{ formatBalance(realTimeBalance.balance) }}
          </text>
          <text class="balance-unit" :class="isRealTimePositive ? 'text-emerald' : 'text-amber'">mL</text>
        </view>

        <view class="limit-module" @click="goToSettings">
          <view class="limit-header">
            <text class="limit-label">摄入目标</text>
            <view class="limit-target-box">
              <text class="limit-target-text">{{ store.dailyLimit }} mL ›</text>
            </view>
          </view>
          <view class="progress-track">
            <view class="progress-fill" :style="{ width: store.limitStatus.percent + '%', backgroundColor: progressColor }"></view>
          </view>
          <text v-if="store.limitStatus.level === 'danger'" class="limit-alert">⚠️ 已超出目标限制</text>
        </view>

        <view class="detail-grid">
          <view class="detail-item"><text class="detail-label">总入量</text><text class="detail-val text-blue">{{ Math.round(realTimeBalance.totalIn) }}</text></view>
          <view class="divider"></view>
          <view class="detail-item"><text class="detail-label">总出量</text><text class="detail-val text-orange">{{ Math.round(realTimeBalance.totalOut) }}</text></view>
        </view>
      </view>
    </view>

    <view class="chart-section" style="margin-top: 40rpx; margin-bottom: 20rpx;">
      <StoneChart :data="weeklyTrend" :active-date="selectedDate" @date-change="handleChartDateChange" />
    </view>

    <view class="timeline-section">
      <view class="section-header">
        <text class="section-title">记录明细</text>
        <view class="date-switcher">
          <view class="arrow-btn" @click="changeDay(-1)">‹</view>
          <text class="current-date">{{ displayDateText }}</text>
          <view class="arrow-btn" @click="changeDay(1)">›</view>
        </view>
      </view>
      
      <view v-if="currentDateRecords.length > 0" class="record-list">
        <view v-for="record in currentDateRecords" :key="record.id" class="record-item" @longpress="handleDelete(record)">
          <text class="item-pct" v-if="getPercentage(record)">{{ getPercentage(record) }}</text>
          <view class="item-time"><text class="time-text">{{ formatTime(record.timestamp) }}</text></view>
          <view class="item-info">
            <view class="info-main">
              <text class="category-icon">{{ store.getCategoryById(record.categoryId).icon }}</text>
              <text class="category-name">{{ store.getCategoryById(record.categoryId).label }}</text>
            </view>
            <text v-if="record.note" class="info-note">{{ record.note }}</text>
          </view>
          <view class="item-amount">
            <text class="amount-val" :class="record.type === 'IN' ? 'text-blue' : 'text-orange'">{{ record.type === 'IN' ? '+' : '-' }}{{ record.amount }}</text>
          </view>
        </view>
        <view class="list-spacer"></view>
      </view>
      <view v-else class="empty-state">
        <view class="empty-icon-box"><text class="empty-emoji">📅</text></view>
        <text class="empty-text">该日暂无记录</text>
        <text class="empty-sub">点击下方按钮添加</text>
      </view>
    </view>

    <view class="action-dock">
      <view class="capsule-bar glass-effect">
        <button class="stone-btn btn-in" hover-class="btn-hover" @click="handleRecordIn"><text class="btn-icon">+</text><text class="btn-text">记入量 IN</text></button>
        <view class="vertical-line"></view>
        <button class="stone-btn btn-out" hover-class="btn-hover" @click="handleRecordOut"><text class="btn-icon">-</text><text class="btn-text">记出量 OUT</text></button>
      </view>
    </view>
    <StoneInput v-model:visible="showInput" :mode="inputMode" @submit="handleFormSubmit" />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onShow } from '@dcloudio/uni-app';
import { storeToRefs } from 'pinia';
import { useFluidStore } from '@/stores/fluidStore';
import StoneInput from '@/components/StoneInput.vue';
import StoneChart from '@/components/StoneChart.vue';
import type { FluidRecord, FluidType } from '@/types/fluid';

const store = useFluidStore();
const { 
  realTimeBalance, currentDateReport, currentDateRecords, weeklyTrend, selectedDate, limitStatus 
} = storeToRefs(store);

const showInput = ref(false);
const inputMode = ref<FluidType>('IN');

onShow(() => { store.loadRecords(); });

// [V10.0] Navigation
const goToSettings = () => {
  uni.navigateTo({ url: '/pages/settings/index' });
};

const isRealTimePositive = computed(() => realTimeBalance.value.balance >= 0);
const displayDateText = computed(() => { const d = new Date(selectedDate.value); const now = new Date(); if (d.toDateString() === now.toDateString()) return '今天 (Today)'; return `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`; });
const progressColor = computed(() => { const level = limitStatus.value.level; if (level === 'danger') return '#FF5252'; if (level === 'warning') return '#FFB300'; return '#00D26A'; });
const formatBalance = (num: number) => (num > 0 ? `+${num}` : `${num}`);
const formatTime = (ts: number) => { const d = new Date(ts); return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`; };
const getPercentage = (record: FluidRecord): string => { const total = record.type === 'IN' ? currentDateReport.value.totalIn : currentDateReport.value.totalOut; if (total === 0) return ''; const pct = Math.round((record.amount / total) * 100); return pct > 0 ? `${pct}%` : ''; };
const generateUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => { const r = (Math.random() * 16) | 0; const v = c === 'x' ? r : (r & 0x3) | 0x8; return v.toString(16); });
const getRecordTimestamp = () => { const now = new Date(); const target = new Date(selectedDate.value); if (target.toDateString() === now.toDateString()) return now.getTime(); target.setHours(now.getHours(), now.getMinutes(), now.getSeconds()); return target.getTime(); };

const handleChartDateChange = (ts: number) => { store.setDate(ts); };
const changeDay = (offset: number) => { const oneDay = 24 * 60 * 60 * 1000; const newDate = selectedDate.value + (offset * oneDay); store.setDate(newDate); uni.vibrateShort(); };
const handleDelete = (record: FluidRecord) => { uni.vibrateShort(); const catName = store.getCategoryById(record.categoryId).label; uni.showModal({ title: '删除记录', content: `确定要删除这条 ${catName} ${record.amount}mL 的记录吗？`, confirmText: '删除', confirmColor: '#FF5252', success: (res) => { if (res.confirm) store.removeRecord(record.id); } }); };
const handleRecordIn = () => { inputMode.value = 'IN'; showInput.value = true; uni.vibrateShort(); };
const handleRecordOut = () => { inputMode.value = 'OUT'; showInput.value = true; uni.vibrateShort(); };
const handleFormSubmit = (data: { categoryId: string, amount: number, note: string }) => { const newRecord: FluidRecord = { id: generateUUID(), timestamp: getRecordTimestamp(), type: inputMode.value, categoryId: data.categoryId, amount: data.amount, temperature: 37.0, note: data.note }; store.addRecord(newRecord); uni.vibrateShort(); uni.showToast({ title: '记录已保存', icon: 'success' }); };
</script>

<style lang="scss" scoped>
$bg-color: #F5F7FA; $card-bg: #FFFFFF; $item-bg: #FFFFFF; $text-primary: #1F2937; $text-secondary: #858C94; $divider-color: #E5E7EB; $color-emerald: #059669; $color-amber: #D97706; $color-blue: #2563EB; $color-orange: #DC2626; $shadow-soft: 0 4rpx 20rpx rgba(0,0,0,0.05);

.stone-container { min-height: 100vh; background-color: $bg-color; padding: 0 40rpx; display: flex; flex-direction: column; }
.status-bar-placeholder { height: var(--status-bar-height); width: 100%; }

.top-header {
  display: flex; justify-content: space-between; align-items: center; margin-top: 20rpx; margin-bottom: 20rpx;
  .greeting { font-size: 44rpx; font-weight: 800; color: $text-primary; letter-spacing: -1rpx; display: block;}
  .sub-greeting { font-size: 24rpx; color: $text-secondary; letter-spacing: 2rpx; text-transform: uppercase; margin-top: 4rpx; display: block;}
  .settings-btn { padding: 10rpx; .gear-icon { font-size: 40rpx; } opacity: 0.8; &:active { opacity: 0.5; } }
}

.dashboard-section { margin-bottom: 10rpx; }
.balance-card { background-color: $card-bg; border-radius: 32rpx; padding: 50rpx 40rpx; box-shadow: $shadow-soft; display: flex; flex-direction: column; align-items: center; border: 1px solid rgba(0,0,0,0.02); .card-label { font-size: 26rpx; color: $text-secondary; margin-bottom: 20rpx; font-weight: 500; } .balance-value-box { display: flex; align-items: baseline; margin-bottom: 30rpx; .balance-num { font-size: 96rpx; font-weight: 700; line-height: 1; font-family: 'Roboto Mono', monospace; letter-spacing: -2rpx; } .balance-unit { font-size: 32rpx; font-weight: 600; margin-left: 10rpx; } .text-emerald { color: $color-emerald; } .text-amber { color: $color-amber; } } }
.limit-module { width: 100%; margin-bottom: 40rpx; padding: 20rpx 0; .limit-header { display: flex; justify-content: space-between; margin-bottom: 12rpx; .limit-label { font-size: 22rpx; color: $text-secondary; } .limit-target-text { font-size: 22rpx; color: $color-blue; font-weight: 600; font-family: 'Roboto Mono', monospace; } } .progress-track { width: 100%; height: 16rpx; background-color: #F3F4F6; border-radius: 8rpx; overflow: hidden; } .progress-fill { height: 100%; border-radius: 8rpx; transition: width 0.5s, background-color 0.3s; } .limit-alert { font-size: 20rpx; color: $color-orange; margin-top: 10rpx; display: block; text-align: center; font-weight: 500; } }
.detail-grid { width: 100%; display: flex; justify-content: space-around; align-items: center; padding-top: 30rpx; border-top: 1px solid $divider-color; .detail-item { display: flex; flex-direction: column; align-items: center; flex: 1; } .divider { width: 1px; height: 30rpx; background-color: $divider-color; } .detail-label { font-size: 22rpx; color: $text-secondary; margin-bottom: 8rpx; font-weight: 500;} .detail-val { font-size: 34rpx; font-weight: 600; font-family: 'Roboto Mono', monospace; } .text-blue { color: $color-blue; } .text-orange { color: $color-orange; } }
.chart-section { width: 100%; margin-bottom: 40rpx; }
.timeline-section { flex: 1; display: flex; flex-direction: column; }
.section-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; padding: 0 10rpx; .section-title { font-size: 30rpx; font-weight: 700; color: $text-primary; } .date-switcher { display: flex; align-items: center; background: #FFFFFF; padding: 8rpx 16rpx; border-radius: 30rpx; box-shadow: $shadow-soft; border: 1px solid rgba(0,0,0,0.02); .arrow-btn { font-size: 32rpx; color: $text-secondary; padding: 0 10rpx; font-weight: bold; } .current-date { font-size: 24rpx; color: $text-primary; font-weight: 600; margin: 0 10rpx; font-family: 'Roboto Mono', monospace; min-width: 160rpx; text-align: center;} } }
.record-item { position: relative; display: flex; align-items: center; justify-content: space-between; background-color: $item-bg; border-radius: 24rpx; padding: 30rpx; margin-bottom: 20rpx; box-shadow: 0 2rpx 10rpx rgba(0,0,0,0.03); border: 1px solid rgba(0,0,0,0.02); transition: all 0.2s; &:active { background-color: #F9FAFB; transform: scale(0.99); } .item-pct { position: absolute; top: 10rpx; right: 16rpx; font-size: 18rpx; color: #9CA3AF; background-color: #F3F4F6; padding: 2rpx 8rpx; border-radius: 6rpx; font-family: 'Roboto Mono', monospace; font-weight: 500; } .item-time { width: 90rpx; .time-text { font-size: 26rpx; color: $text-secondary; font-family: 'Roboto Mono', monospace; font-weight: 500; } } .item-info { flex: 1; display: flex; flex-direction: column; padding: 0 20rpx; .info-main { display: flex; align-items: center; .category-icon { font-size: 32rpx; margin-right: 12rpx; } .category-name { font-size: 28rpx; color: $text-primary; font-weight: 600; } } .info-note { font-size: 22rpx; color: #9CA3AF; margin-top: 6rpx; } } .item-amount { .amount-val { font-size: 36rpx; font-weight: 700; font-family: 'Roboto Mono', monospace; } } }
.list-spacer { height: 200rpx; }
.empty-state { display: flex; flex-direction: column; align-items: center; justify-content: center; padding-top: 80rpx; opacity: 0.8; .empty-icon-box { width: 120rpx; height: 120rpx; background: #E5E7EB; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin-bottom: 24rpx; .empty-emoji { font-size: 60rpx; opacity: 0.6; } } .empty-text { font-size: 28rpx; color: $text-primary; font-weight: 600; margin-bottom: 8rpx; } .empty-sub { font-size: 24rpx; color: $text-secondary; } }
.action-dock { position: fixed; bottom: 80rpx; left: 0; width: 100%; display: flex; justify-content: center; padding: 0 40rpx; box-sizing: border-box; z-index: 100; }
.capsule-bar { display: flex; align-items: center; width: 100%; height: 110rpx; border-radius: 55rpx; background: rgba(255, 255, 255, 0.9); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); box-shadow: $shadow-soft; border: 1px solid rgba(255,255,255,0.5); .vertical-line { width: 1px; height: 40%; background: #E5E7EB; } }
.stone-btn { flex: 1; height: 100%; background: transparent; display: flex; justify-content: center; align-items: center; border: none; padding: 0; &::after { border: none; } .btn-icon { font-size: 40rpx; margin-right: 15rpx; font-weight: 400; } .btn-text { font-size: 30rpx; font-weight: 700; letter-spacing: 0.5rpx; } }
.btn-in { color: $color-blue; } .btn-out { color: $color-orange; } .btn-hover { background-color: rgba(255,255,255,0.05); }
</style>