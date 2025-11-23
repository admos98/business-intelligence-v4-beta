import { OcrResult, SummaryData, InflationData } from "../../shared/types";
import { logger } from "../utils/logger";
import { geminiCache } from "./geminiCache";

type GeminiSuccessResponse<T> = { data: T };
type GeminiErrorResponse = { error?: string; details?: string };

// Rate limiting: track last call time and enforce minimum delay
let lastCallTime = 0;
const MIN_CALL_INTERVAL_MS = 1000; // Minimum 1 second between calls

// Rate limiting helper
const checkRateLimit = (): void => {
    const now = Date.now();
    const timeSinceLastCall = now - lastCallTime;

    if (timeSinceLastCall < MIN_CALL_INTERVAL_MS) {
        const delay = MIN_CALL_INTERVAL_MS - timeSinceLastCall;
        throw new Error(`Rate limit: Please wait ${Math.ceil(delay / 1000)} second(s) before making another AI request.`);
    }

    lastCallTime = now;
};

async function callGeminiApi<T>(task: string, payload: unknown): Promise<T> {
    // Check cache first
    try {
        const cachedResponse = await geminiCache.get<T>(task, payload);
        if (cachedResponse !== null) {
            logger.debug(`Returning cached response for task: ${task}`);
            return cachedResponse;
        }
    } catch (error) {
        // If cache check fails, continue with API call
        logger.warn('Cache check failed, proceeding with API call:', error);
    }

    // Enforce rate limiting
    checkRateLimit();

    const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ task, payload }),
        signal: AbortSignal.timeout(60000), // 60 second timeout for AI operations
    });

    if (!response.ok) {
        let details: string | undefined;
        try {
            const errorBody = (await response.json()) as GeminiErrorResponse;
            details = errorBody.details ?? errorBody.error;
        } catch {
            details = await response.text();
        }
        logger.error(`Gemini API call for task "${task}" failed:`, details);
        throw new Error(details || `Failed to call Gemini API for task: ${task}`);
    }

    const result = (await response.json()) as GeminiSuccessResponse<T>;
    if (result && Object.prototype.hasOwnProperty.call(result, 'data')) {
        const responseData = result.data;

        // Store in cache after successful API call
        try {
            await geminiCache.set(task, payload, responseData);
        } catch (error) {
            // If cache store fails, log but don't fail the request
            logger.warn('Failed to cache response:', error);
        }

        return responseData;
    }

    throw new Error(`Unexpected response shape from Gemini API for task: ${task}`);
}

export async function parseReceipt(imageBase64: string, categories: string[]): Promise<OcrResult> {
  return callGeminiApi<OcrResult>('parseReceipt', { imageBase64, categories });
}

export async function getAnalysisInsights(
    question: string,
    context: string,
    data: unknown[]
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
