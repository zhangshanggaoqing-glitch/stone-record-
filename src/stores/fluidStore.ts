import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { FluidRecord, Category, DailyBalanceReport, FluidType } from '../types/fluid';
import { calculateBalance } from '../utils/stone-algo';

const STORAGE_KEY_RECORDS = 'STONE_RECORDS';
const STORAGE_KEY_CATEGORIES = 'STONE_CATEGORIES_V4';
const STORAGE_KEY_LIMIT = 'STONE_DAILY_LIMIT';

// 临床图标预设
export const MEDICAL_ICONS_PRESET = [
  '🥣', '🥤', '🍵', '🥛', '🧴', '🫙', '🥡',
  '💧', '💦', '🩸', '🥥', '🍋',
  '💉', '💊', '🧪', '🩹', '🫁', '🌡️'
];

// 默认分类
const DEFAULT_CATEGORIES: Category[] = [
  { id: 'sys_diet', label: '饮食', type: 'IN', icon: '🥣', isDefault: true },
  { id: 'sys_water', label: '饮水', type: 'IN', icon: '🥤', isDefault: true },
  { id: 'sys_infusion', label: '输液', type: 'IN', icon: '💉', isDefault: true },
  { id: 'sys_blood', label: '输血', type: 'IN', icon: '🩸', isDefault: true },
  { id: 'sys_urine', label: '尿液', type: 'OUT', icon: '💧', isDefault: true },
  { id: 'sys_stool', label: '大便', type: 'OUT', icon: '💩', isDefault: true },
  { id: 'sys_vomit', label: '呕吐', type: 'OUT', icon: '🤮', isDefault: true },
  { id: 'sys_sputum', label: '痰量', type: 'OUT', icon: '🫁', isDefault: true },
  { id: 'sys_drainage', label: '引流', type: 'OUT', icon: '🧴', isDefault: true },
  { id: 'sys_other_out', label: '其他排出', type: 'OUT', icon: '📉', isDefault: true },
];

const isSameDay = (ts1: number, ts2: number) => {
  const d1 = new Date(ts1);
  const d2 = new Date(ts2);
  return d1.toDateString() === d2.toDateString();
};

export const useFluidStore = defineStore('fluid', () => {
  
  const recordList = ref<FluidRecord[]>([]);
  const categoryList = ref<Category[]>([]); 
  const selectedDate = ref<number>(Date.now());
  const dailyLimit = ref<number>(2000);

  // --- Getters ---
  const realTimeBalance = computed<DailyBalanceReport>(() => {
    const now = Date.now();
    const todayRecords = recordList.value.filter(r => isSameDay(r.timestamp, now));
    return calculateBalance(todayRecords);
  });

  const limitStatus = computed(() => {
    const totalIn = realTimeBalance.value.totalIn;
    const limit = dailyLimit.value > 0 ? dailyLimit.value : 2000;
    const percent = Math.min((totalIn / limit) * 100, 100);
    const remaining = limit - totalIn;
    let level: 'safe' | 'warning' | 'danger' = 'safe';
    if ((totalIn / limit) >= 1) level = 'danger';
    else if ((totalIn / limit) >= 0.8) level = 'warning';
    return { percent, remaining, limit, level };
  });

  const currentDateRecords = computed(() => {
    return recordList.value
      .filter(r => isSameDay(r.timestamp, selectedDate.value))
      .sort((a, b) => b.timestamp - a.timestamp);
  });

  const currentDateReport = computed<DailyBalanceReport>(() => {
    return calculateBalance(currentDateRecords.value);
  });

  const weeklyTrend = computed(() => {
    const days = 7;
    const result = [];
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const oneDayMs = 24 * 60 * 60 * 1000;
    for (let i = days - 1; i >= 0; i--) {
      const targetStart = todayStart - (i * oneDayMs);
      const targetEnd = targetStart + oneDayMs;
      const dayRecords = recordList.value.filter(r => r.timestamp >= targetStart && r.timestamp < targetEnd);
      const totalIn = dayRecords.filter(r => r.type === 'IN').reduce((sum, r) => sum + r.amount, 0);
      const totalOut = dayRecords.filter(r => r.type === 'OUT').reduce((sum, r) => sum + r.amount, 0);
      const balance = totalIn - totalOut;
      const dateObj = new Date(targetStart);
      const dateStr = `${(dateObj.getMonth() + 1).toString().padStart(2, '0')}-${dateObj.getDate().toString().padStart(2, '0')}`;
      result.push({ date: dateStr, timestamp: targetStart, balance: Math.round(balance), totalIn: Math.round(totalIn), totalOut: Math.round(totalOut) });
    }
    return result;
  });

  const getCategoryById = (id: string): Category => {
    return categoryList.value.find(c => c.id === id) || {
      id: 'unknown', label: '未知', type: 'IN', icon: '❓', isDefault: true
    };
  };

  // --- Actions ---

  // 1. 生成报表数据
  function getReportData(days: number) {
    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59).getTime();
    const startDate = endDate - (days * 24 * 60 * 60 * 1000) + 1;

    const rangeRecords = recordList.value
      .filter(r => r.timestamp >= startDate && r.timestamp <= endDate)
      .sort((a, b) => b.timestamp - a.timestamp);

    const totalIn = rangeRecords.filter(r => r.type === 'IN').reduce((s, r) => s + r.amount, 0);
    const totalOut = rangeRecords.filter(r => r.type === 'OUT').reduce((s, r) => s + r.amount, 0);
    const netBalance = totalIn - totalOut;
    const avgBalance = days > 0 ? Math.round(netBalance / days) : 0;

    const groupedDays: Record<string, FluidRecord[]> = {};
    rangeRecords.forEach(r => {
      const d = new Date(r.timestamp);
      const dateKey = `${d.getFullYear()}-${(d.getMonth()+1).toString().padStart(2,'0')}-${d.getDate().toString().padStart(2,'0')}`;
      if (!groupedDays[dateKey]) groupedDays[dateKey] = [];
      groupedDays[dateKey].push(r);
    });

    const dayGroups = Object.keys(groupedDays)
      .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())
      .map(date => {
        const dailyRecs = groupedDays[date];
        const dailyIn = dailyRecs.filter(r => r.type === 'IN').reduce((s, r) => s + r.amount, 0);
        const dailyOut = dailyRecs.filter(r => r.type === 'OUT').reduce((s, r) => s + r.amount, 0);
        return {
          date,
          records: dailyRecs,
          dailyIn,
          dailyOut,
          dailyBalance: dailyIn - dailyOut
        };
      });

    return {
      period: `${days} Days`,
      startDate: new Date(startDate).toLocaleDateString(),
      endDate: new Date(endDate).toLocaleDateString(),
      totalIn, totalOut, netBalance, avgBalance, dayGroups
    };
  }

  // 2. 导出 JSON 备份
  function exportDataJSON(): string {
    const backupData = {
      version: '1.0.0',
      timestamp: Date.now(),
      dailyLimit: dailyLimit.value,
      categories: categoryList.value,
      records: recordList.value
    };
    return JSON.stringify(backupData);
  }

  // 3. 导入 JSON 备份
  function importDataJSON(jsonStr: string): boolean {
    try {
      const data = JSON.parse(jsonStr);
      if (!data.records || !Array.isArray(data.records) || !data.categories) {
        throw new Error('Invalid Data Format');
      }
      recordList.value = data.records;
      categoryList.value = data.categories;
      if (data.dailyLimit) dailyLimit.value = data.dailyLimit;
      _persistRecords();
      _persistCategories();
      uni.setStorageSync(STORAGE_KEY_LIMIT, dailyLimit.value);
      return true;
    } catch (e) {
      console.error('Import Failed:', e);
      return false;
    }
  }

  // 4. 清空数据
  function clearAllData() {
    recordList.value = [];
    categoryList.value = [...DEFAULT_CATEGORIES];
    dailyLimit.value = 2000;
    uni.removeStorageSync(STORAGE_KEY_RECORDS);
    uni.removeStorageSync(STORAGE_KEY_CATEGORIES);
    uni.removeStorageSync(STORAGE_KEY_LIMIT);
    _persistCategories();
  }

  // 基础数据加载与操作
  function loadRecords() {
    try {
      const storedRecords = uni.getStorageSync(STORAGE_KEY_RECORDS);
      const storedCats = uni.getStorageSync(STORAGE_KEY_CATEGORIES);
      const storedLimit = uni.getStorageSync(STORAGE_KEY_LIMIT);
      if (storedRecords) recordList.value = JSON.parse(storedRecords);
      if (storedLimit) dailyLimit.value = Number(storedLimit);
      if (storedCats && storedCats !== '[]') {
        categoryList.value = JSON.parse(storedCats);
      } else {
        categoryList.value = [...DEFAULT_CATEGORIES];
        _persistCategories();
      }
    } catch (e) { console.error('Init failed', e); }
  }
  function addRecord(record: FluidRecord) { recordList.value.push(record); _persistRecords(); }
  function removeRecord(id: string) {
    const index = recordList.value.findIndex(r => r.id === id);
    if (index !== -1) { recordList.value.splice(index, 1); _persistRecords(); }
  }
  function addCustomCategory(label: string, type: FluidType, icon: string = '✨'): Category {
    const newCat: Category = { id: `custom_${Date.now()}`, label, type, icon, isDefault: false };
    categoryList.value.push(newCat); _persistCategories(); return newCat;
  }
  function removeCategory(id: string): boolean {
    const index = categoryList.value.findIndex(c => c.id === id);
    if (index !== -1 && !categoryList.value[index].isDefault) {
      categoryList.value.splice(index, 1); _persistCategories(); return true;
    } return false;
  }
  function updateDailyLimit(amount: number) { dailyLimit.value = amount; uni.setStorageSync(STORAGE_KEY_LIMIT, amount); }
  function setDate(ts: number) { selectedDate.value = ts; }
  function _persistRecords() { uni.setStorageSync(STORAGE_KEY_RECORDS, JSON.stringify(recordList.value)); }
  function _persistCategories() { uni.setStorageSync(STORAGE_KEY_CATEGORIES, JSON.stringify(categoryList.value)); }

  return {
    recordList, categoryList, selectedDate, dailyLimit,
    realTimeBalance, limitStatus, currentDateReport, currentDateRecords, weeklyTrend, getCategoryById,
    loadRecords, addRecord, removeRecord, addCustomCategory, removeCategory, updateDailyLimit, setDate,
    getReportData, exportDataJSON, importDataJSON, clearAllData
  };
});