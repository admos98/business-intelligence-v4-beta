import { OcrResult, SummaryData, InflationData } from "../../shared/types";

type GeminiSuccessResponse<T> = { data: T };
type GeminiErrorResponse = { error?: string; details?: string };

async function callGeminiApi<T>(task: string, payload: unknown): Promise<T> {
    const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ task, payload }),
    });

    if (!response.ok) {
        let details: string | undefined;
        try {
            const errorBody = (await response.json()) as GeminiErrorResponse;
            details = errorBody.details ?? errorBody.error;
        } catch {
            details = await response.text();
        }
        console.error(`Gemini API call for task "${task}" failed:`, details);
        throw new Error(details || `Failed to call Gemini API for task: ${task}`);
    }

    const result = (await response.json()) as GeminiSuccessResponse<T>;
    if (result && Object.prototype.hasOwnProperty.call(result, 'data')) {
        return result.data;
    }

    throw new Error(`Unexpected response shape from Gemini API for task: ${task}`);
}

export async function parseReceipt(imageBase64: string, categories: string[]): Promise<OcrResult> {
  return callGeminiApi<OcrResult>('parseReceipt', { imageBase64, categories });
}

export async function getAnalysisInsights(
    question: string,
    context: string,
    data: any[]
): Promise<string> {
    return callGeminiApi<string>('getAnalysisInsights', { question, context, data });
}

export async function generateReportSummary(
    totalSpending: number,
    categorySpending: Record<string, number>
): Promise<string> {
    return callGeminiApi<string>('generateReportSummary', { totalSpending, categorySpending });
}

export async function generateExecutiveSummary(summaryData: SummaryData): Promise<string> {
    return callGeminiApi<string>('generateExecutiveSummary', { summaryData });
}
export async function analyzePriceTrend(
    itemName: string,
    priceHistory: { date: string, pricePerUnit: number }[]
): Promise<string> {
    return callGeminiApi<string>('analyzePriceTrend', { itemName, priceHistory });
}

export async function getInflationInsight(inflationData: InflationData): Promise<string> {
    return callGeminiApi<string>('getInflationInsight', { inflationData });
}
