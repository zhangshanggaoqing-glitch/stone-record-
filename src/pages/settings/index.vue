<template>
  <view class="settings-container">
    
    <view class="nav-header">
      <view class="back-btn" @click="goBack">‹</view>
      <text class="page-title">设置与数据</text>
      <view class="placeholder"></view>
    </view>

    <view class="setting-group">
      <view class="group-title">健康目标</view>
      <view class="setting-item" hover-class="item-hover" @click="handleEditLimit">
        <view class="item-left">
          <text class="icon">🎯</text>
          <text class="label">每日摄入限额</text>
        </view>
        <view class="item-right">
          <text class="value">{{ store.dailyLimit }} mL</text>
          <text class="arrow">›</text>
        </view>
      </view>
    </view>

    <view class="setting-group">
      <view class="group-title">数据管理</view>
      
      <view class="setting-item" hover-class="item-hover" @click="showExportModal = true">
        <view class="item-left">
          <text class="icon">📄</text>
          <text class="label">导出 PDF 报告</text>
        </view>
        <view class="item-right"><text class="arrow">›</text></view>
      </view>

      <view class="setting-item" hover-class="item-hover" @click="handleBackupJSON">
        <view class="item-left">
          <text class="icon">💾</text>
          <text class="label">备份数据 (复制)</text>
        </view>
        <view class="item-right"><text class="arrow">›</text></view>
      </view>

      <view class="setting-item" hover-class="item-hover" @click="openRestoreModal">
        <view class="item-left">
          <text class="icon">📂</text>
          <text class="label">恢复数据 (粘贴)</text>
        </view>
        <view class="item-right"><text class="arrow">›</text></view>
      </view>

      <view class="setting-item" hover-class="item-hover" @click="handleClearData">
        <view class="item-left">
          <text class="icon">🗑️</text>
          <text class="label text-red">清空所有数据</text>
        </view>
        <view class="item-right"><text class="arrow">›</text></view>
      </view>
    </view>

    <view class="setting-group">
      <view class="group-title">关于</view>
      <view class="setting-item">
        <view class="item-left">
          <text class="icon">🛡️</text>
          <text class="label">隐私政策</text>
        </view>
        <view class="item-right">
          <text class="value">本地存储，无云端</text>
        </view>
      </view>
      <view class="setting-item">
        <view class="item-left">
          <text class="icon">ℹ️</text>
          <text class="label">版本号</text>
        </view>
        <view class="item-right">
          <text class="value">v1.0.0</text>
        </view>
      </view>
    </view>

    <view class="footer-note">Stone Record - Your Fluid Guardian</view>

    <view v-if="showExportModal" class="modal-mask">
      <view class="modal-card">
        <text class="modal-title">导出 PDF 报告</text>
        <view class="date-row">
          <text>开始:</text>
          <picker mode="date" :value="exportStartDate" @change="e => exportStartDate = e.detail.value">
            <view class="picker">{{ exportStartDate }}</view>
          </picker>
        </view>
        <view class="date-row">
          <text>结束:</text>
          <picker mode="date" :value="exportEndDate" @change="e => exportEndDate = e.detail.value">
            <view class="picker">{{ exportEndDate }}</view>
          </picker>
        </view>
        <view class="modal-btns">
          <button class="btn cancel" @click="showExportModal = false">取消</button>
          <button class="btn confirm" :loading="isGenerating" @click="handleGenerateReport">生成</button>
        </view>
      </view>
    </view>

    <view v-if="showRestoreModal" class="modal-mask">
      <view class="modal-card restore-card">
        <text class="modal-title">恢复数据</text>
        <text class="modal-subtitle">请在下方粘贴备份的 JSON 字符串：</text>
        
        <textarea 
          class="restore-textarea" 
          v-model="restoreJsonStr" 
          placeholder="长按粘贴..." 
          maxlength="-1" 
          :auto-height="false"
        />
        
        <view class="modal-btns">
          <button class="btn cancel" @click="showRestoreModal = false">取消</button>
          <button class="btn confirm" @click="confirmRestore">确认恢复</button>
        </view>
      </view>
    </view>

  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useFluidStore } from '@/stores/fluidStore';
import { generatePDF, type PdfReportData } from '@/utils/pdf-generator';

const store = useFluidStore();

// UI States
const showExportModal = ref(false);
const showRestoreModal = ref(false); // 新增
const restoreJsonStr = ref(''); // 新增
const isGenerating = ref(false);

// Date States
const todayStr = new Date().toISOString().split('T')[0];
const exportStartDate = ref(todayStr);
const exportEndDate = ref(todayStr);

const goBack = () => uni.navigateBack();

// --- Handlers ---

const handleEditLimit = () => {
  uni.showModal({
    title: '设置限额',
    placeholderText: '请输入每日目标 (mL)',
    content: store.dailyLimit.toString(),
    editable: true,
    success: (res) => {
      if (res.confirm && res.content) {
        store.updateDailyLimit(parseInt(res.content) || 2000);
      }
    }
  });
};

const handleBackupJSON = () => {
  const json = store.exportDataJSON();
  uni.setClipboardData({
    data: json,
    success: () => uni.showToast({ title: '数据已复制到剪贴板', icon: 'none' })
  });
};

// 打开恢复弹窗
const openRestoreModal = () => {
  restoreJsonStr.value = ''; // 清空上次内容
  showRestoreModal.value = true;
};

// 确认恢复逻辑
const confirmRestore = () => {
  if (!restoreJsonStr.value.trim()) {
    uni.showToast({ title: '内容不能为空', icon: 'none' });
    return;
  }

  // 二次确认，防止手滑
  uni.showModal({
    title: '最后确认',
    content: '恢复数据将覆盖当前所有记录，确定继续吗？',
    success: (res) => {
      if (res.confirm) {
        const success = store.importDataJSON(restoreJsonStr.value);
        if (success) {
          uni.showToast({ title: '恢复成功', icon: 'success' });
          showRestoreModal.value = false;
        } else {
          uni.showToast({ title: 'JSON 格式错误', icon: 'none' });
        }
      }
    }
  });
};

const handleClearData = () => {
  uni.showModal({
    title: '危险操作',
    content: '确定要清空所有记录和设置吗？此操作无法撤销。',
    confirmColor: '#DC2626',
    success: (res) => {
      if (res.confirm) {
        store.clearAllData();
        uni.showToast({ title: '已重置', icon: 'none' });
      }
    }
  });
};

const handleGenerateReport = async () => {
  isGenerating.value = true;
  try {
    const startTs = new Date(exportStartDate.value).getTime();
    const endTs = new Date(exportEndDate.value).setHours(23,59,59);
    const oneDay = 86400000;
    const daysDiff = Math.ceil((endTs - startTs) / oneDay);
    
    const rawData = store.getReportData(daysDiff || 1); 
    const printableData: PdfReportData = {
      period: rawData.period, startDate: rawData.startDate, endDate: rawData.endDate,
      totalIn: rawData.totalIn, totalOut: rawData.totalOut, netBalance: rawData.netBalance, avgBalance: rawData.avgBalance,
      days: rawData.dayGroups.map((d: any) => ({
        date: d.date,
        summary: `In: ${d.dailyIn} | Out: ${d.dailyOut} | Bal: ${d.dailyBalance > 0 ? '+' : ''}${d.dailyBalance}`,
        records: d.records.map((r: any) => [
          new Date(r.timestamp).toTimeString().slice(0,5), r.type, store.getCategoryById(r.categoryId).label, r.amount.toString(), r.note || ''
        ])
      }))
    };

    const fileName = `StoneRecord_${exportStartDate.value}`;
    await generatePDF(printableData, fileName);
    uni.showToast({ title: '导出成功', icon: 'success' });
    showExportModal.value = false;
  } catch (e) {
    uni.showToast({ title: '生成失败', icon: 'none' });
  } finally {
    isGenerating.value = false;
  }
};
</script>

<style lang="scss" scoped>
$bg-color: #F5F7FA; $text-primary: #1F2937; $text-secondary: #858C94; $color-blue: #2563EB; $color-red: #DC2626;

.settings-container { min-height: 100vh; background-color: $bg-color; padding-bottom: 40rpx; }

.nav-header {
  padding: 100rpx 40rpx 30rpx 40rpx; background: #fff; display: flex; align-items: center; justify-content: space-between;
  .back-btn { font-size: 40rpx; color: $text-primary; width: 60rpx; }
  .page-title { font-size: 34rpx; font-weight: 700; color: $text-primary; }
  .placeholder { width: 60rpx; }
}

.setting-group { margin-top: 30rpx; }
.group-title { padding: 0 40rpx; margin-bottom: 16rpx; font-size: 24rpx; color: $text-secondary; font-weight: 600; text-transform: uppercase; }

.setting-item {
  background: #fff; padding: 30rpx 40rpx; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #F3F4F6;
  &:last-child { border-bottom: none; }
}
.item-hover { background-color: #F9FAFB; }

.item-left { display: flex; align-items: center; .icon { font-size: 32rpx; margin-right: 20rpx; } .label { font-size: 30rpx; color: $text-primary; } .text-red { color: $color-red; } }
.item-right { display: flex; align-items: center; .value { font-size: 28rpx; color: $text-secondary; margin-right: 10rpx; } .arrow { color: #D1D5DB; font-size: 32rpx; } }

.footer-note { text-align: center; margin-top: 60rpx; font-size: 22rpx; color: #D1D5DB; }

/* --- Modals --- */
.modal-mask { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); display: flex; justify-content: center; align-items: center; z-index: 999; }
.modal-card { background: #fff; width: 600rpx; border-radius: 24rpx; padding: 40rpx; }

.modal-title { font-size: 32rpx; font-weight: 700; text-align: center; margin-bottom: 30rpx; display: block; color: $text-primary; }
.modal-subtitle { font-size: 26rpx; color: $text-secondary; margin-bottom: 20rpx; display: block; }

.date-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20rpx; font-size: 28rpx; .picker { background: #f3f4f6; padding: 10rpx 20rpx; border-radius: 8rpx; } }
.modal-btns { display: flex; justify-content: space-between; margin-top: 40rpx; .btn { width: 45%; font-size: 28rpx; &.confirm { background: $color-blue; color: #fff; } } }

/* --- New Restore Textarea Styles --- */
.restore-textarea {
  width: 100%;
  height: 400rpx; /* 大号高度 */
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 12rpx;
  padding: 20rpx;
  box-sizing: border-box;
  font-size: 24rpx;
  font-family: monospace;
  line-height: 1.5;
  color: $text-primary;
}
</style>