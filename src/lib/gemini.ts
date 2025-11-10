import { OcrResult, ShoppingItem, SummaryData, Unit, InflationData } from "../types";
import { t } from "../translations";

async function callGeminiApi(task: string, payload: any) {
    const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ task, payload }),
    });

    if (!response.ok) {
        const error = await response.json();
        console.error(`Gemini API call for task "${task}" failed:`, error.details);
        throw new Error(error.details || `Failed to call Gemini API for task: ${task}`);
    }
    const result = await response.json();
    return result.data;
}

export async function parseReceipt(imageBase64: string, categories: string[]): Promise<OcrResult> {
  return callGeminiApi('parseReceipt', { imageBase64, categories });
}

export async function getAnalysisInsights(
    question: string,
    context: string,
    data: any[]
): Promise<string> {
    return callGeminiApi('getAnalysisInsights', { question, context, data });
}

export async function generateReportSummary(
    totalSpending: number,
    categorySpending: Record<string, number>
): Promise<string> {
    return callGeminiApi('generateReportSummary', { totalSpending, categorySpending });
}

export async function generateExecutiveSummary(summaryData: SummaryData): Promise<string> {
    return callGeminiApi('generateExecutiveSummary', { summaryData });
}

export async function analyzePriceTrend(
    itemName: string,
    priceHistory: { date: string, pricePerUnit: number }[]
): Promise<string> {
    return callGeminiApi('analyzePriceTrend', { itemName, priceHistory });
}

export async function getInflationInsight(inflationData: InflationData): Promise<string> {
    return callGeminiApi('getInflationInsight', { inflationData });
}