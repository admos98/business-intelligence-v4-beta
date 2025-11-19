import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from "@google/genai";
// Add .ts to all imports pointing to your source files
import { OcrResult, OcrParsedItem, SummaryData, Unit, InflationData } from '../shared/types.js';
import { t } from '../shared/translations.js';
import { toJalaliDateString } from '../shared/jalali.js';

const extractJsonPayload = (rawText: string): string => {
    const trimmed = rawText.trim();
    if (!trimmed) {
        throw new Error('Gemini response was empty.');
    }
    if (trimmed.startsWith('```')) {
        const fence = trimmed.startsWith('```json') ? '```json' : '```';
        const closingFenceIndex = trimmed.lastIndexOf('```');
        if (closingFenceIndex === -1) {
            throw new Error('Gemini response did not contain a closing code fence.');
        }
        return trimmed.slice(fence.length, closingFenceIndex).trim();
    }
    return trimmed;
};

const parseGeminiJson = <T>(rawText: string, context: string): T => {
    const normalized = extractJsonPayload(rawText);
    try {
        return JSON.parse(normalized) as T;
    } catch (error) {
        throw new Error(`Failed to parse Gemini JSON for ${context}: ${(error as Error).message}`);
    }
};

const isValidReceiptItem = (value: unknown): value is OcrParsedItem => {
    if (!value || typeof value !== 'object') return false;
    const candidate = value as Record<string, unknown>;
    const unitValue = candidate.unit;
    const isUnitValid =
        unitValue === undefined ||
        (typeof unitValue === 'string' && Object.values(Unit).includes(unitValue as Unit));
    return (
        typeof candidate.name === 'string' &&
        typeof candidate.quantity === 'number' &&
        Number.isFinite(candidate.quantity) &&
        typeof candidate.price === 'number' &&
        Number.isFinite(candidate.price) &&
        isUnitValid &&
        (candidate.suggestedCategory === undefined || typeof candidate.suggestedCategory === 'string')
    );
};

// Retry wrapper for Gemini API calls with exponential backoff
async function retryGeminiCall<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelayMs: number = 1000
): Promise<T> {
    let lastError: Error | unknown;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error: unknown) {
            lastError = error;

            // Only retry on 503/overload errors
            const errorMessage = error instanceof Error ? error.message : String(error);
            const errorCause = error instanceof Error && error.cause instanceof Error ? error.cause.message : '';

            const isRetryable =
                errorMessage.includes('overloaded') ||
                errorMessage.includes('UNAVAILABLE') ||
                errorMessage.includes('503') ||
                errorMessage.includes('Service Unavailable') ||
                errorCause.includes('503') ||
                errorCause.includes('UNAVAILABLE');

            if (!isRetryable || attempt === maxRetries) {
                throw error;
            }

            // Exponential backoff: 1s, 2s, 4s
            const delayMs = baseDelayMs * Math.pow(2, attempt);
            console.log(`Gemini API 503 error on attempt ${attempt + 1}/${maxRetries + 1}. Retrying in ${delayMs}ms...`);
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    if (lastError instanceof Error) {
        throw lastError;
    }
    throw new Error('Unknown error occurred in retryGeminiCall');
}

// --- Internal Handlers for each Gemini Task ---

async function handleParseReceipt(ai: GoogleGenAI, payload: { imageBase64: string, categories: string[] }): Promise<OcrResult> {
  // Validate payload structure
  if (
    !payload ||
    typeof payload.imageBase64 !== 'string' ||
    payload.imageBase64.length === 0 ||
    !Array.isArray(payload.categories) ||
    !payload.categories.every(cat => typeof cat === 'string')
  ) {
    throw new Error("Invalid payload: parseReceipt requires 'imageBase64' (non-empty string) and 'categories' (array of strings).");
  }

  const { imageBase64, categories } = payload;
  const itemSchema = { type: Type.OBJECT, properties: { name: { type: Type.STRING }, quantity: { type: Type.NUMBER }, price: { type: Type.NUMBER }, unit: { type: Type.STRING }, suggestedCategory: { type: Type.STRING } }, required: ["name", "quantity", "price"] };
  const receiptSchema = { type: Type.OBJECT, properties: { date: { type: Type.STRING, description: "The date from the receipt in YYYY/MM/DD Jalali format." }, items: { type: Type.ARRAY, items: itemSchema } }, required: ["date", "items"] };

  const unitValues = Object.values(Unit).join(', ');
  const prompt = `
    You are an expert receipt and invoice analyzer for a cafe, fluent in Persian.
    The user has provided an image of a receipt. Meticulously extract all items AND the date of the receipt.
    For each item, provide its name, quantity, and total price.

    IMPORTANT - UNIT: Determine the unit of measurement for each item based on the receipt text (e.g., 'kg', 'عدد'). Choose the most appropriate unit from this list: [${unitValues}]. If no unit is specified or clear, you can use "${Unit.Piece}".

    IMPORTANT - CATEGORY: Based on the item name, suggest the most relevant category from the following list: [${categories.join(', ')}]. If no category fits, use "${t.other}".

    IMPORTANT - DATE: Extract the date from the receipt. You MUST return it in the Jalali calendar format of YYYY/MM/DD. For example, '1403/05/01'.

    IMPORTANT - PRICES: Prices on Iranian receipts are in Rials. Extract the price exactly as it appears on the receipt. The final price in the JSON output MUST be in Rials.

    Return the output ONLY as a JSON object matching the provided schema. Do not include any extra text or explanations.
  `;

  const response = await retryGeminiCall(() =>
    ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }] },
      config: { responseMimeType: "application/json", responseSchema: receiptSchema }
    })
  );

  const parsedJson = parseGeminiJson<{ date: unknown; items: unknown }>(response.text ?? '', 'parseReceipt');

  if (typeof parsedJson.date === 'string' && Array.isArray(parsedJson.items)) {
      const validItems = parsedJson.items.filter(isValidReceiptItem);
      if (validItems.length === 0) {
          throw new Error("Gemini response validation failed: no valid receipt items.");
      }
      return {
          date: parsedJson.date,
          items: validItems
      };
  }
  throw new Error("Gemini response validation failed: missing items array or date.");
}

async function handleGetAnalysisInsights(ai: GoogleGenAI, payload: { question: string, context: string, data: unknown[] }): Promise<string> {
    // Validate payload structure
    if (
        !payload ||
        typeof payload.question !== 'string' ||
        payload.question.trim().length === 0 ||
        typeof payload.context !== 'string' ||
        !Array.isArray(payload.data)
    ) {
        throw new Error("Invalid payload: getAnalysisInsights requires 'question' (non-empty string), 'context' (string), and 'data' (array).");
    }

    const { question, context, data } = payload;
    const prompt = `
    You are an expert business analyst for a cafe owner, fluent in Persian. Your task is to answer the user's question based *only* on the provided data and context. Do not use any external knowledge.

    **Context of the Analysis:**
    ${context}

    **Data for Analysis (in JSON format):**
    ${JSON.stringify(data, null, 2)}

    **User's Question:**
    "${question}"

    **Your Task:**
    1.  Carefully analyze the provided JSON data.
    2.  Answer the user's question directly and concisely in Persian.
    3.  If the data supports it, provide a brief "Insight" or "Recommendation" in a new paragraph. For example, if they ask for the most expensive vendor, you could recommend comparing prices.
    4.  If the data is insufficient to answer the question, clearly state that the answer cannot be determined from the current data view.

    Be factual, data-driven, and professional.
    `;
    const response = await retryGeminiCall(() =>
        ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt })
    );
    return (response.text ?? '').trim();
}

async function handleGenerateReportSummary(ai: GoogleGenAI, payload: { totalSpending: number, categorySpending: Record<string, number> }): Promise<string> {
    // Validate payload structure
    if (
        !payload ||
        typeof payload.totalSpending !== 'number' ||
        !Number.isFinite(payload.totalSpending) ||
        typeof payload.categorySpending !== 'object' ||
        payload.categorySpending === null
    ) {
        throw new Error("Invalid payload: generateReportSummary requires 'totalSpending' (finite number) and 'categorySpending' (object).");
    }

    const { totalSpending, categorySpending } = payload;
    const prompt = `
    You are an expert financial analyst creating a summary for a cafe's periodic purchasing report. Analyze the provided data and generate a detailed, insightful summary in Persian. The tone should be professional and analytical.

    Data:
    - Total Spending for the period: ${totalSpending.toLocaleString('fa-IR')} ${t.currency}
    - Spending breakdown by Category: ${JSON.stringify(Object.entries(categorySpending).sort(([,a],[,b]) => b-a).reduce((r, [k, v]) => ({ ...r, [k]: v }), {}))}

    Your analysis should include:
    1.  An introduction stating the total expenditure for the period.
    2.  A detailed breakdown of the main spending categories. Identify the top 3-4 categories and discuss their significance as a percentage of the total budget.
    3.  Identify any notable patterns or anomalies. For example, is spending concentrated in one area? Are there any unexpectedly high costs?
    4.  Provide one or two strategic concluding remarks or points of focus for the cafe owner based on this data. For instance, areas where cost control might be beneficial or where spending aligns with business goals (e.g., high spending on quality produce).

    Format the output clearly with paragraphs for each section.
    `;
    const response = await retryGeminiCall(() =>
        ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt })
    );
    return (response.text ?? '').trim();
}

// In /api/gemini.ts

async function handleGenerateExecutiveSummary(ai: GoogleGenAI, payload: { summaryData: SummaryData }): Promise<string> {
    // FIX #1: Validate that the payload and summaryData exist (You've already done this!)
    if (!payload || !payload.summaryData) {
        console.error("handleGenerateExecutiveSummary called with invalid payload:", payload);
        throw new Error("Invalid payload: 'summaryData' is missing.");
    }

    const { kpis, charts, period } = payload.summaryData;

    // FIX #2: Convert date strings from the payload into actual Date objects
    const startDate = new Date(period.startDate);
    const endDate = new Date(period.endDate);

    // Now, ensure they are valid dates before using them
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        throw new Error("Invalid date format in payload.summaryData.period");
    }

    const prompt = `
    You are a professional business consultant for a cafe owner, fluent in Persian. Your task is to provide a concise executive summary based on the following purchasing data for the period from ${toJalaliDateString(startDate.toISOString())} to ${toJalaliDateString(endDate.toISOString())}.

    **Key Performance Indicators (KPIs):**
    *   Total Spend: ${kpis.totalSpend.toLocaleString('fa-IR')} ${t.currency}
    *   Average Daily Spend: ${kpis.avgDailySpend.toLocaleString('fa-IR')} ${t.currency}
    *   Total Unique Items Purchased: ${kpis.totalItems.toLocaleString('fa-IR')}
    *   Top Spending Category: ${kpis.topCategory?.name || 'N/A'} (${kpis.topCategory?.amount.toLocaleString('fa-IR')} ${t.currency})
    *   Top Spending Vendor: ${kpis.topVendor?.name || 'N/A'} (${kpis.topVendor?.amount.toLocaleString('fa-IR')} ${t.currency})

    **Data Trends:**
    *   Spending by Category (% of total): ${JSON.stringify(charts.spendingByCategory.labels.map((label, index) => ({ category: label, percentage: kpis.totalSpend > 0 ? ((charts.spendingByCategory.data[index] / kpis.totalSpend) * 100).toFixed(1) + '%' : '0%' })), null, 2)}
    *   Spending Over Time (Trend): Analyze the daily spending data points to identify trends: ${JSON.stringify(charts.spendingOverTime.data)}

    **Your Task:**
    Provide a brief, insightful summary in Persian (max 3-4 paragraphs).
    1.  Start with a clear opening statement about the overall spending during the period.
    2.  Analyze the KPIs. What do they reveal? Is the spending high or low? Point out the most significant category and vendor.
    3.  Comment on the trends. Is spending increasing, decreasing, or volatile? Is it concentrated in a few categories?
    4.  Conclude with one key, actionable insight or a question for the owner to consider. For example, "The significant spend on 'Dairy' suggests it's a core cost center. It may be worthwhile to explore alternative suppliers for this category to optimize costs." or "Spending shows an upward trend towards the end of the period; is this due to increased business or rising prices?"

    Your tone should be helpful, professional, and data-driven.
    `;
    const response = await retryGeminiCall(() =>
        ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt })
    );
    return (response.text ?? '').trim();
}

async function handleAnalyzePriceTrend(ai: GoogleGenAI, payload: { itemName: string, priceHistory: { date: string, pricePerUnit: number }[] }): Promise<string> {
    // Validate payload structure
    if (
        !payload ||
        typeof payload.itemName !== 'string' ||
        payload.itemName.trim().length === 0 ||
        !Array.isArray(payload.priceHistory) ||
        !payload.priceHistory.every(
            point =>
                point &&
                typeof point.date === 'string' &&
                typeof point.pricePerUnit === 'number' &&
                Number.isFinite(point.pricePerUnit)
        )
    ) {
        throw new Error("Invalid payload: analyzePriceTrend requires 'itemName' (non-empty string) and 'priceHistory' (array of {date: string, pricePerUnit: number}).");
    }

    const { itemName, priceHistory } = payload;
    if (priceHistory.length < 2) {
        return t.notEnoughDataForTrend;
    }

    const firstPoint = priceHistory[0];
    const lastPoint = priceHistory[priceHistory.length - 1];

    const formattedHistory = priceHistory.map(p => ({
        date: toJalaliDateString(p.date),
        price: p.pricePerUnit.toFixed(0)
    }));

    const prompt = `
    You are a professional purchasing analyst for a cafe owner in Iran, fluent in Persian. Your task is to analyze the price trend for a specific item based on its purchase history and provide a concise, actionable insight.

    **Item:** ${itemName}

    **Price History (Date in Jalali, Price in Rials):**
    ${JSON.stringify(formattedHistory, null, 2)}

    **Your Task:**
    1.  Start by stating the overall trend (e.g., increasing, decreasing, stable).
    2.  Calculate the percentage change from the first recorded price (${firstPoint.pricePerUnit.toFixed(0)} ریال) to the last recorded price (${lastPoint.pricePerUnit.toFixed(0)} ریال). Mention this percentage in your analysis.
    3.  Provide a short, actionable insight or recommendation in a new paragraph. For example: "This sharp increase suggests it may be beneficial to explore alternative suppliers," or "The price has remained stable, indicating a reliable supplier relationship."
    4.  Keep the entire response concise, professional, and in Persian. The response should be 2-3 sentences long.
    `;
    const response = await retryGeminiCall(() =>
        ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt })
    );
    return (response.text ?? '').trim();
}

async function handleGetInflationInsight(ai: GoogleGenAI, payload: { inflationData: InflationData }): Promise<string> {
    // Validate payload structure
    if (
        !payload ||
        typeof payload.inflationData !== 'object' ||
        payload.inflationData === null ||
        typeof payload.inflationData.overallChange !== 'number' ||
        !Number.isFinite(payload.inflationData.overallChange) ||
        !Array.isArray(payload.inflationData.topItemRises) ||
        !Array.isArray(payload.inflationData.topCategoryRises)
    ) {
        throw new Error("Invalid payload: getInflationInsight requires 'inflationData' with numeric 'overallChange' and arrays 'topItemRises' and 'topCategoryRises'.");
    }

    const { inflationData } = payload;
    const prompt = `
    You are a business analyst for a cafe owner, fluent in Persian.
    Based on the following inflation data for the cafe's purchases, provide a summary and one key recommendation.

    **Data:**
    - Overall Price Change: ${inflationData.overallChange.toFixed(1)}%
    - Top Item with Price Rise: ${inflationData.topItemRises.length > 0 ? `${inflationData.topItemRises[0].name} (+${inflationData.topItemRises[0].changePercentage.toFixed(0)}%)` : 'N/A'}
    - Top Category with Price Rise: ${inflationData.topCategoryRises.length > 0 ? `${inflationData.topCategoryRises[0].name} (+${inflationData.topCategoryRises[0].changePercentage.toFixed(0)}%)` : 'N/A'}

    **Your Task:**
    1. Write a short, 2-3 sentence summary in Persian analyzing this data.
    2. Mention the overall trend and highlight the specific item or category that is driving the inflation the most.
    3. Conclude with one actionable recommendation. For example, "کنترل هزینه در دسته 'لبنیات' و یافتن تامین‌کننده جایگزین برای 'شیر' می‌تواند به مدیریت هزینه‌ها کمک کند."

    Be concise, data-driven, and professional.
    `;
    const response = await retryGeminiCall(() =>
        ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt })
    );
    return (response.text ?? '').trim();
}


// --- Main API Handler ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // 1. Standard method check
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    // 2. Environment variable check
    const { API_KEY } = process.env;
    if (!API_KEY) {
        console.error("Server configuration error: Missing API_KEY for Gemini.");
        return res.status(500).json({ error: 'Server configuration error.' });
    }

    // 3. Basic payload validation
    if (!req.body || typeof req.body !== 'object') {
        return res.status(400).json({ error: 'Bad Request: Body must be a JSON object.' });
    }

    const { task, payload } = req.body as { task?: unknown; payload?: unknown };
    if (typeof task !== 'string' || task.trim().length === 0) {
        return res.status(400).json({ error: 'Bad Request: "task" field is missing.' });
    }
    if (payload === undefined) {
        return res.status(400).json({ error: 'Bad Request: "payload" field is missing.' });
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });

    try {
        let data;
        // 4. Route the request based on the task
        switch (task) {
            case 'parseReceipt':
                data = await handleParseReceipt(ai, payload as { imageBase64: string; categories: string[] });
                break;
            case 'getAnalysisInsights':
                data = await handleGetAnalysisInsights(ai, payload as { question: string; context: string; data: unknown[] });
                break;
            case 'generateReportSummary':
                data = await handleGenerateReportSummary(ai, payload as { totalSpending: number; categorySpending: Record<string, number> });
                break;
            case 'generateExecutiveSummary':
                data = await handleGenerateExecutiveSummary(ai, payload as { summaryData: SummaryData });
                break;
            case 'analyzePriceTrend':
                data = await handleAnalyzePriceTrend(ai, payload as { itemName: string; priceHistory: { date: string; pricePerUnit: number }[] });
                break;
            case 'getInflationInsight':
                data = await handleGetInflationInsight(ai, payload as { inflationData: InflationData });
                break;
            default:
                return res.status(400).json({ error: `Invalid task specified: "${task}"` });
        }
        // Success case: return 200 with data
        return res.status(200).json({ data });

    } catch (error: unknown) {
        // 5. Advanced Error Handling
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`Error processing task "${task}":`, errorMessage);

        // Case A: The Google Gemini API is overloaded or unavailable
        if (errorMessage.includes('overloaded') || errorMessage.includes('UNAVAILABLE') || errorMessage.includes('503')) {
            return res.status(503).json({
                error: 'The AI service is currently unavailable or overloaded. Please try again in a few moments.',
                details: errorMessage
            });
        }

        // Case B: The AI returned an invalid response that could not be parsed
        if (errorMessage.includes('Failed to parse Gemini JSON') || errorMessage.includes('Gemini response validation failed')) {
            return res.status(502).json({
                error: 'The AI service returned an invalid response.',
                details: errorMessage
            });
        }

        // Case C: The client sent a malformed payload (e.g., missing summaryData, bad date format)
        // This relies on your helper functions throwing specific error messages.
        if (errorMessage.includes('Invalid payload') || errorMessage.includes('Invalid date format')) {
            return res.status(400).json({
                error: 'Bad Request: The provided data was malformed.',
                details: errorMessage
            });
        }

        // Case D: Any other unexpected error in your code
        return res.status(500).json({
            error: 'An internal server error occurred while processing the AI request.',
            details: errorMessage
        });
    }
}
