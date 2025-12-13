<template>
  <view class="input-modal-container" :class="{ 'visible': visible }">
    <view class="mask" @click="closeModal"></view>

    <view class="panel">
      <view class="panel-handle"></view>

      <view class="category-section">
        <view class="category-grid">
          
          <view 
            v-for="cat in currentCategoryList" 
            :key="cat.id"
            class="cat-item"
            :class="{ 'active': selectedCategoryId === cat.id }"
            @click="selectCategory(cat.id)"
            @longpress="handleLongPressCategory(cat)"
          >
            <text class="cat-icon">{{ cat.icon }}</text>
            <text class="cat-label">{{ cat.label }}</text>
          </view>

          <view class="cat-item add-btn" @click="handleInitiateCustom">
            <text class="cat-icon" style="filter: grayscale(1); opacity: 0.5;">➕</text>
            <text class="cat-label">自定义</text>
          </view>

        </view>
      </view>

      <view class="display-area">
        <view class="amount-group">
          <text 
            v-if="!showIconPicker"
            class="amount-text" 
            :class="mode === 'IN' ? 'text-blue' : 'text-orange'"
          >
            {{ displayAmount }}
          </text>
          <text v-else class="picker-title">请选择图标</text>
          <text v-if="!showIconPicker" class="unit-text">mL</text>
        </view>
        
        <view class="category-hint">
          {{ showIconPicker ? `为 "${tempCustomName}" 选择一个图标` : `已选: ${selectedCategoryLabel}` }}
        </view>

        <view class="note-section" v-if="!showIconPicker">
          <input 
            class="note-input" 
            type="text" 
            v-model="note" 
            placeholder="添加备注 (选填)..." 
            placeholder-class="note-placeholder"
            cursor-spacing="20"
          />
        </view>
      </view>

      <template v-if="!showIconPicker">
        <view class="chips-row">
          <view class="chip" v-for="val in [10, 50, 100, 500]" :key="val" @click="addQuickAmount(val)">
            <text>+{{ val }}</text>
          </view>
        </view>

        <view class="numpad-grid">
          <view v-for="key in keys" :key="key" class="key-cell" hover-class="key-hover" @click="handleInput(key)">
            <text class="key-text">{{ key }}</text>
          </view>
          <view class="key-cell key-del" hover-class="key-hover" @click="handleDelete">
            <text class="key-text">⌫</text>
          </view>
        </view>

        <view class="action-bar">
          <button 
            class="confirm-btn"
            :class="mode === 'IN' ? 'btn-blue' : 'btn-orange'"
            hover-class="btn-active"
            @click="handleSubmit"
          >
            确 认 (OK)
          </button>
        </view>
      </template>

      <template v-else>
        <scroll-view scroll-y class="icon-picker-scroll">
          <view class="icon-grid">
            <view 
              v-for="(icon, idx) in presetIcons" 
              :key="idx" 
              class="icon-cell"
              :class="{ 'icon-active': tempSelectedIcon === icon }"
              @click="handleIconSelect(icon)"
            >
              <text class="icon-text">{{ icon }}</text>
            </view>
          </view>
        </scroll-view>
        <view class="action-bar picker-actions">
           <button class="cancel-btn" hover-class="btn-active" @click="cancelCustom">取消</button>
          <button class="confirm-btn btn-blue" hover-class="btn-active" @click="confirmCustomCreation">确定</button>
        </view>
      </template>
      
      <view class="safe-area-bottom"></view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useFluidStore, MEDICAL_ICONS_PRESET } from '@/stores/fluidStore';
import { storeToRefs } from 'pinia';
import type { FluidType, Category } from '@/types/fluid';

const props = defineProps<{ visible: boolean; mode: FluidType; }>();
const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void;
  (e: 'submit', payload: { categoryId: string, amount: number, note: string }): void;
}>();

const store = useFluidStore();
const { categoryList } = storeToRefs(store);
const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0'];
const presetIcons = MEDICAL_ICONS_PRESET;

// State
const currentAmountStr = ref('');
const selectedCategoryId = ref<string | null>(null);
const showIconPicker = ref(false);
const tempCustomName = ref('');
const tempSelectedIcon = ref(presetIcons[0]); // [V6.4] Temp icon selection
const note = ref('');

// Computed
const currentCategoryList = computed(() => categoryList.value.filter(c => c.type === props.mode));
const displayAmount = computed(() => currentAmountStr.value === '' ? '0' : currentAmountStr.value);
const selectedCategoryLabel = computed(() => {
  const t = categoryList.value.find(c => c.id === selectedCategoryId.value);
  return t ? t.label : '请选择分类';
});

// Watchers
watch(() => props.visible, (newVal) => {
  if (newVal) {
    currentAmountStr.value = '';
    note.value = '';
    showIconPicker.value = false;
    if (currentCategoryList.value.length > 0) selectedCategoryId.value = currentCategoryList.value[0].id;
  }
});

// Helpers
const triggerHaptic = () => uni.vibrateShort({ success: () => {} });
const closeModal = () => emit('update:visible', false);

// Logic: Select
const selectCategory = (id: string) => { 
  if (showIconPicker.value) return; 
  triggerHaptic(); 
  selectedCategoryId.value = id; 
};

// Handle Long Press Delete
const handleLongPressCategory = (cat: Category) => {
  triggerHaptic();
  
  if (cat.isDefault) {
    uni.showToast({ title: '系统预设不可删除', icon: 'none' });
    return;
  }

  uni.showModal({
    title: '删除分类',
    content: `确定要删除自定义分类 "${cat.label}" 吗？`,
    confirmColor: '#FF5252',
    success: (res) => {
      if (res.confirm) {
        const success = store.removeCategory(cat.id);
        if (success) {
          uni.showToast({ title: '已删除', icon: 'none' });
          if (selectedCategoryId.value === cat.id && currentCategoryList.value.length > 0) {
            selectedCategoryId.value = currentCategoryList.value[0].id;
          }
        }
      }
    }
  });
};

// Logic: Custom Category
const handleInitiateCustom = () => {
  triggerHaptic();
  uni.showModal({
    title: '新增分类',
    placeholderText: `输入${props.mode === 'IN' ? '入量' : '出量'}名称`,
    editable: true,
    success: (res) => {
      if (res.confirm && res.content) {
        tempCustomName.value = res.content.trim();
        if(!tempCustomName.value) return;
        tempSelectedIcon.value = presetIcons[0]; // Reset to first icon
        showIconPicker.value = true; 
      }
    }
  });
};

// [V6.4] Updated Icon Selection Logic
const handleIconSelect = (icon: string) => {
  triggerHaptic();
  tempSelectedIcon.value = icon;
};

const confirmCustomCreation = () => {
  const newCat = store.addCustomCategory(tempCustomName.value, props.mode, tempSelectedIcon.value);
  selectedCategoryId.value = newCat.id;
  showIconPicker.value = false;
  uni.showToast({ title: '添加成功', icon: 'none' });
};

const cancelCustom = () => { showIconPicker.value = false; };

// Logic: Input
const handleInput = (key: string) => {
  triggerHaptic();
  if (key === '.' && currentAmountStr.value.includes('.')) return;
  if (currentAmountStr.value.length > 6) return;
  if (currentAmountStr.value === '0' && key !== '.') { currentAmountStr.value = key; return; }
  currentAmountStr.value += key;
};

const handleDelete = () => {
  triggerHaptic();
  if (currentAmountStr.value.length > 0) currentAmountStr.value = currentAmountStr.value.slice(0, -1);
};

const addQuickAmount = (val: number) => {
  triggerHaptic();
  const currentVal = parseFloat(currentAmountStr.value) || 0;
  const newVal = currentVal + val;
  if (newVal < 10000) currentAmountStr.value = newVal.toString();
};

const handleSubmit = () => {
  triggerHaptic();
  const amount = parseFloat(currentAmountStr.value);
  if (!amount || amount <= 0) { uni.showToast({ title: '请输入有效数值', icon: 'none' }); return; }
  if (!selectedCategoryId.value) { uni.showToast({ title: '请选择液体分类', icon: 'none' }); return; }
  
  emit('submit', { 
    categoryId: selectedCategoryId.value, 
    amount, 
    note: note.value
  });
  closeModal();
};
</script>

<style lang="scss" scoped>
/* Palette */
$bg-panel: #FFFFFF; $bg-keyboard: #F3F4F6; $bg-key: #FFFFFF; $bg-key-active: #E5E7EB;
$text-primary: #1F2937; $text-secondary: #6B7280; 
$color-blue: #2563EB; $color-orange: #DC2626;

.input-modal-container { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; z-index: 999; visibility: hidden; &.visible { visibility: visible; .mask { opacity: 1; } .panel { transform: translateY(0); } } }
.mask { position: absolute; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.4); opacity: 0; transition: opacity 0.3s; backdrop-filter: blur(2px); }
.panel { position: absolute; bottom: 0; left: 0; width: 100%; background-color: $bg-panel; border-radius: 40rpx 40rpx 0 0; transform: translateY(100%); transition: transform 0.3s; padding-bottom: 20rpx; display: flex; flex-direction: column; }
.panel-handle { width: 80rpx; height: 8rpx; background-color: #E5E7EB; border-radius: 4rpx; margin: 20rpx auto; }

/* Grid Layout */
.category-section { padding: 20rpx 30rpx; max-height: 35vh; overflow-y: auto; }
.category-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 20rpx 10rpx; justify-items: center; }

/* Category Item */
.cat-item {
  display: inline-flex; flex-direction: column; align-items: center; justify-content: center;
  width: 110rpx; height: 110rpx; border-radius: 28rpx; background-color: #F9FAFB;
  box-shadow: 0 0 0 2px transparent; transition: all 0.2s;
  
  .cat-icon { font-size: 44rpx; margin-bottom: 6rpx; transition: transform 0.2s;}
  .cat-label { 
    font-size: 24rpx; 
    color: $text-secondary; font-weight: 500; 
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; text-align: center; 
  }

  &.active {
    background-color: rgba($color-blue, 0.05);
    box-shadow: 0 0 0 2px rgba($color-blue, 0.12), 0 8px 20px -6px rgba($color-blue, 0.25);
    transform: scale(1.05) translateY(-2rpx);
    .cat-icon { transform: scale(1.1); }
    .cat-label { color: $color-blue; font-weight: 700; }
  }
}
.add-btn { background-color: #FFFFFF; border: 1px dashed #D1D5DB; &:active { background-color: #F3F4F6; } }

/* Display Area */
.display-area { padding: 20rpx 40rpx 30rpx 40rpx; display: flex; flex-direction: column; align-items: flex-end; justify-content: center; }
.amount-group { display: flex; align-items: baseline; .amount-text { font-size: 80rpx; font-family: 'Roboto Mono', monospace; font-weight: 700; } .picker-title { font-size: 48rpx; font-weight: 700; color: $text-primary; } .unit-text { font-size: 30rpx; color: $text-secondary; margin-left: 10rpx; } .text-blue { color: $color-blue; } .text-orange { color: $color-orange; } }
.category-hint { font-size: 24rpx; color: $text-secondary; margin-top: 4rpx; margin-bottom: 10rpx; }

/* Note Input Style */
.note-section {
  width: 100%; margin-top: 10rpx;
  .note-input {
    width: 100%; height: 70rpx; background-color: #F9FAFB; border-radius: 12rpx;
    padding: 0 20rpx; font-size: 28rpx; color: $text-primary; box-sizing: border-box;
    text-align: right; 
  }
  .note-placeholder { color: #D1D5DB; }
}

/* Numpad & Action Bar */
.chips-row { display: flex; justify-content: space-around; padding: 0 40rpx 20rpx 40rpx; }
.chip { background-color: #F3F4F6; padding: 12rpx 30rpx; border-radius: 30rpx; font-size: 26rpx; color: $text-primary; font-weight: 600; border: 1px solid rgba(0,0,0,0.03); &:active { background-color: #E5E7EB; } }
.numpad-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 2rpx; background-color: #F3F4F6; padding: 2rpx; }
.key-cell { background-color: $bg-key; height: 120rpx; display: flex; align-items: center; justify-content: center; .key-text { font-size: 48rpx; color: $text-primary; font-weight: 500; } }
.key-hover { background-color: $bg-key-active; }
.action-bar { padding: 30rpx 40rpx; }
.confirm-btn { height: 100rpx; border-radius: 50rpx; display: flex; align-items: center; justify-content: center; font-size: 32rpx; font-weight: bold; color: #fff; border: none; &::after { border: none; } &.btn-blue { background: linear-gradient(90deg, #2563EB, #3B82F6); box-shadow: 0 8rpx 20rpx rgba(37, 99, 235, 0.3); } &.btn-orange { background: linear-gradient(90deg, #DC2626, #EF4444); box-shadow: 0 8rpx 20rpx rgba(220, 38, 38, 0.3); } &.btn-active { opacity: 0.9; transform: scale(0.98); } }
.cancel-btn { height: 100rpx; border-radius: 50rpx; display: flex; align-items: center; justify-content: center; font-size: 30rpx; font-weight: 600; color: $text-primary; background-color: #F3F4F6; border: none; &::after { border: none; } }

/* [V6.4] New Icon Picker Styles */
.icon-picker-scroll { height: 400rpx; background: #F9FAFB; padding: 20rpx; box-sizing: border-box; }
.icon-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 24rpx; justify-items: center; padding-bottom: 20rpx; }
.icon-cell { 
  width: 100rpx; height: 100rpx; 
  display: flex; align-items: center; justify-content: center; 
  background: #FFFFFF; border-radius: 20rpx; 
  box-shadow: 0 2rpx 6rpx rgba(0,0,0,0.02);
  border: 2px solid transparent; /* Prepare for border transition */
  transition: all 0.2s ease;

  .icon-text { font-size: 48rpx; }

  /* Active State Styling */
  &.icon-active {
    border-color: $text-primary; /* Use text-primary (dark) or brand color */
    background-color: #FFFFFF;
    box-shadow: 0 4rpx 12rpx rgba(0,0,0,0.1);
    transform: scale(1.05);
  }
}

.picker-actions { display: flex; gap: 20rpx; button { flex: 1; } }

.safe-area-bottom { height: env(safe-area-inset-bottom); width: 100%; background-color: $bg-panel; }
</style>