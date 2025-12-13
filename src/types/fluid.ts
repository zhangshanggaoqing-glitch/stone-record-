// src/types/fluid.ts

/**
 * 液体流向类型
 */
export type FluidType = 'IN' | 'OUT';

/**
 * 动态分类对象接口
 */
export interface Category {
  id: string;
  label: string;
  type: FluidType;
  icon: string;
  isDefault: boolean;
}

/**
 * 单条液体记录接口
 */
export interface FluidRecord {
  id: string;
  timestamp: number;
  type: FluidType;
  categoryId: string;
  amount: number;
  temperature?: number;
  note?: string;
}

/**
 * [V6.0] 每日总结报告接口
 * 移除了 estimatedIWL，仅保留客观出入量
 */
export interface DailyBalanceReport {
  totalIn: number;
  totalOut: number;
  balance: number;          // totalIn - totalOut
  unit: 'mL';
}