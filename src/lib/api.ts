import { ShoppingList, Vendor, POSItem, SellTransaction, Recipe, StockEntry } from '../../shared/types';

interface StoredData {
    lists: ShoppingList[];
    customCategories: string[];
    vendors: Vendor[];
    categoryVendorMap: Record<string, string>;
    itemInfoMap: Record<string, { unit: string; category: string }>;
    posItems?: POSItem[];
    posCategories?: string[];
    sellTransactions?: SellTransaction[];
    recipes?: Recipe[];
    stockEntries?: Record<string, StockEntry>;
}

interface ApiErrorResponse {
    error?: string;
    details?: string;
}

export const fetchData = async (): Promise<StoredData | null> => {
    try {
        const response = await fetch('/api/data', {
            signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        if (!response.ok) {
            let errorMessage = response.statusText;
            try {
                const errorData = await response.json() as ApiErrorResponse;
                errorMessage = errorData.details || errorData.error || errorMessage;
            } catch {
                // If JSON parsing fails, use status text
            }
            throw new Error(`Failed to fetch data: ${errorMessage}`);
        }

        // Vercel's response for an empty body might be a 204 No Content
        if (response.status === 204) {
            return null;
        }

        return await response.json() as StoredData;

    } catch (error) {
        if (error instanceof Error) {
            console.error("Error in fetchData:", error.message);
            throw error;
        }
        throw new Error("Unknown error occurred while fetching data");
    }
};

export const saveData = async (data: StoredData): Promise<void> => {
    try {
        const response = await fetch('/api/data', {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
            signal: AbortSignal.timeout(30000), // 30 second timeout
        });

        if (!response.ok) {
            let errorMessage = response.statusText;
            try {
                const errorData = await response.json() as ApiErrorResponse;
                errorMessage = errorData.details || errorData.error || errorMessage;
            } catch {
                // If JSON parsing fails, use status text
            }
            throw new Error(`Failed to save data: ${errorMessage}`);
        }
    } catch (error) {
        if (error instanceof Error) {
            console.error("Error in saveData:", error.message);
            throw error;
        }
        throw new Error("Unknown error occurred while saving data");
    }
};
