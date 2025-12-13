// src/utils/stone-algo.ts
import type { FluidRecord, DailyBalanceReport } from '../types/fluid';

/**
 * [V6.0] 计算液体平衡 (Fluid Balance)
 * 逻辑：Balance = Total In - Total Out
 * 已移除 IWL 相关逻辑
 */
export function calculateBalance(records: FluidRecord[]): DailyBalanceReport {
  
  // 1. Calculate Total In
  const totalIn = records
    .filter(r => r.type === 'IN')
    .reduce((sum, r) => sum + r.amount, 0);

  // 2. Calculate Total Out
  const totalOut = records
    .filter(r => r.type === 'OUT')
    .reduce((sum, r) => sum + r.amount, 0);

  // 3. Final Balance Logic
  // Pure record based: In - Out
  const balance = totalIn - totalOut;

  return {
    totalIn,
    totalOut,
    balance: Math.round(balance * 100) / 100,
    unit: 'mL'
  };
}