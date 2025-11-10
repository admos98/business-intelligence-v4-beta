interface StoredData {
    lists: any[];
    customCategories: string[];
    vendors: any[];
    categoryVendorMap: Record<string, string>;
    itemInfoMap: Record<string, any>;
}

export const fetchData = async (): Promise<StoredData | null> => {
    try {
        const response = await fetch('/api/data');

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to fetch data: ${errorData.details || response.statusText}`);
        }
        
        return await response.json();

    } catch (error) {
        console.error("Error in fetchData:", error);
        throw error;
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
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Failed to save data: ${errorData.details || response.statusText}`);
        }
    } catch (error) {
        console.error("Error in saveData:", error);
        throw error;
    }
};