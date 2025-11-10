// This file contains a subset of types from src/types.ts,
// duplicated to make the /api functions self-contained for Vercel deployment.

export enum Unit {
  Kg = 'کیلوگرم',
  Gram = 'گرم',
  Liter = 'لیتر',
  Ml = 'میلی‌لیتر',
  Piece = 'عدد',
  Pack = 'بسته',
  Box = 'جعبه',
  Bottle = 'بطری',
  Can = 'قوطی',
  Jar = 'شیشه',
  Dozen = 'دوجین',
  Sheet = 'برگ',
  Roll = 'رول',
  Bag = 'کیسه',
  Bunch = 'دسته',
  Carton = 'کارتن',
  Sachet = 'ساشه',
  Bar = 'قالب',
}

export interface OcrParsedItem {
    name: string;
    quantity: number;
    price: number;
    unit?: Unit;
    suggestedCategory?: string;
}

export interface OcrResult {
  date: string; // Jalali date string YYYY/MM/DD
  items: OcrParsedItem[];
}

export interface SummaryData {
  kpis: {
    totalSpend: number;
    totalItems: number;
    avgDailySpend: number;
    topCategory: { name: string; amount: number } | null;
    topVendor: { name: string; amount: number } | null;
  };
  charts: {
    spendingOverTime: { labels: string[]; data: number[] };
    spendingByCategory: { labels: string[]; data: number[] };
  };
  period: {
    startDate: Date;
    endDate: Date;
  };
}

export interface InflationPoint {
  period: string;
  priceIndex: number;
}

export interface InflationDetail {
    name: string;
    startPrice: number;
    endPrice: number;
    changePercentage: number;
}

export interface InflationData {
    overallChange: number;
    priceIndexHistory: InflationPoint[];
    topItemRises: InflationDetail[];
    topCategoryRises: InflationDetail[];
}