import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleGenAI, Type } from "@google/genai";
// Add .ts to all imports pointing to your source files
import { OcrResult, SummaryData, Unit, InflationData } from '../shared/types.js';
import { t } from '../shared/translations.js';
import { toJalaliDateString } from '../shared/jalali.js';

// --- Internal Handlers for each Gemini Task ---

async function handleParseReceipt(ai: GoogleGenAI, payload: { imageBase64: string, categories: string[] }): Promise<OcrResult> {
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

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: { parts: [{ text: prompt }, { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } }] },
    config: { responseMimeType: "application/json", responseSchema: receiptSchema }
  });

  let jsonText = (response.text ?? '').trim();
  if (jsonText.startsWith('```json')) {
    jsonText = jsonText.substring(7, jsonText.length - 3).trim();
  } else if (jsonText.startsWith('```')) {
    jsonText = jsonText.substring(3, jsonText.length - 3).trim();
  }
  const parsedJson = JSON.parse(jsonText);

  if (parsedJson.items && Array.isArray(parsedJson.items) && typeof parsedJson.date === 'string') {
      return {
          date: parsedJson.date,
          items: parsedJson.items.filter((item: any) => item.name && typeof item.quantity === 'number' && typeof item.price === 'number')
      };
  }
  throw new Error("Parsed JSON does not contain a valid 'items' array and 'date' string.");
}

async function handleGetAnalysisInsights(ai: GoogleGenAI, payload: { question: string, context: string, data: any[] }): Promise<string> {
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
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return (response.text ?? '').trim();
}

async function handleGenerateReportSummary(ai: GoogleGenAI, payload: { totalSpending: number, categorySpending: Record<string, number> }): Promise<string> {
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
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return (response.text ?? '').trim();
}

async function handleGenerateExecutiveSummary(ai: GoogleGenAI, payload: { summaryData: SummaryData }): Promise<string> {
    if (!payload || !payload.summaryData) {
        // Log the issue for debugging on the server
        console.error("handleGenerateExecutiveSummary called with invalid payload:", payload);
        // Throw a specific error that will be caught by the main handler
        throw new Error("Invalid payload: 'summaryData' is missing.");
    }
    const { kpis, charts, period } = payload.summaryData;
    const prompt = `
    You are a professional business consultant for a cafe owner, fluent in Persian. Your task is to provide a concise executive summary based on the following purchasing data for the period from ${toJalaliDateString(period.startDate.toISOString())} to ${toJalaliDateString(period.endDate.toISOString())}.

    **Key Performance Indicators (KPIs):**
    *   Total Spend: ${kpis.totalSpend.toLocaleString('fa-IR')} ${t.currency}
    *   Average Daily Spend: ${kpis.avgDailySpend.toLocaleString('fa-IR')} ${t.currency}
    *   Total Unique Items Purchased: ${kpis.totalItems.toLocaleString('fa-IR')}
    *   Top Spending Category: ${kpis.topCategory?.name || 'N/A'} (${kpis.topCategory?.amount.toLocaleString('fa-IR')} ${t.currency})
    *   Top Spending Vendor: ${kpis.topVendor?.name || 'N/A'} (${kpis.topVendor?.amount.toLocaleString('fa-IR')} ${t.currency})

    **Data Trends:**
    *   Spending by Category (% of total): ${JSON.stringify(charts.spendingByCategory.labels.map((label, index) => ({ category: label, percentage: ((charts.spendingByCategory.data[index] / kpis.totalSpend) * 100).toFixed(1) + '%' })), null, 2)}
    *   Spending Over Time (Trend): Analyze the daily spending data points to identify trends: ${JSON.stringify(charts.spendingOverTime.data)}

    **Your Task:**
    Provide a brief, insightful summary in Persian (max 3-4 paragraphs).
    1.  Start with a clear opening statement about the overall spending during the period.
    2.  Analyze the KPIs. What do they reveal? Is the spending high or low? Point out the most significant category and vendor.
    3.  Comment on the trends. Is spending increasing, decreasing, or volatile? Is it concentrated in a few categories?
    4.  Conclude with one key, actionable insight or a question for the owner to consider. For example, "The significant spend on 'Dairy' suggests it's a core cost center. It may be worthwhile to explore alternative suppliers for this category to optimize costs." or "Spending shows an upward trend towards the end of the period; is this due to increased business or rising prices?"

    Your tone should be helpful, professional, and data-driven.
    `;
    const response = await ai.models.generateContent({ model: 'gemini-2.5-pro', contents: prompt });
    return (response.text ?? '').trim();
}

async function handleAnalyzePriceTrend(ai: GoogleGenAI, payload: { itemName: string, priceHistory: { date: string, pricePerUnit: number }[] }): Promise<string> {
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
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return (response.text ?? '').trim();
}

async function handleGetInflationInsight(ai: GoogleGenAI, payload: { inflationData: InflationData }): Promise<string> {
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
    const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: prompt });
    return (response.text ?? '').trim();
}


// --- Main API Handler ---

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', ['POST']);
        return res.status(405).end(`Method ${req.method} Not Allowed`);
    }

    const { API_KEY } = process.env;
    if (!API_KEY) {
        return res.status(500).json({ error: 'Server configuration error: Missing API_KEY for Gemini.' });
    }

    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const { task, payload } = req.body;

    try {
        let data;
        switch (task) {
            case 'parseReceipt':
                data = await handleParseReceipt(ai, payload);
                break;
            case 'getAnalysisInsights':
                data = await handleGetAnalysisInsights(ai, payload);
                break;
            case 'generateReportSummary':
                data = await handleGenerateReportSummary(ai, payload);
                break;
            case 'generateExecutiveSummary':
                data = await handleGenerateExecutiveSummary(ai, payload);
                break;
            case 'analyzePriceTrend':
                data = await handleAnalyzePriceTrend(ai, payload);
                break;
            case 'getInflationInsight':
                data = await handleGetInflationInsight(ai, payload);
                break;
            default:
                return res.status(400).json({ error: 'Invalid task specified.' });
        }
        return res.status(200).json({ data });
    } catch (error: any) {
        console.error(`Error processing task "${task}":`, error);
        return res.status(500).json({ error: 'An internal server error occurred while processing the AI request.', details: error.message });
    }
}
