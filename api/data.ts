// api/data.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_BASE_URL = 'https://api.github.com/gists';
const FILENAME = 'mehrnoosh-cafe-data.json';

interface StoredData {
    lists: unknown;
    customCategories: unknown;
    vendors: unknown;
    categoryVendorMap: unknown;
    itemInfoMap: unknown;
    posItems?: unknown;
    sellTransactions?: unknown;
    recipes?: unknown;
    stockEntries?: unknown;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

const isValidStoredData = (value: unknown): value is StoredData => {
    if (!isPlainObject(value)) {
        return false;
    }

    const { lists, customCategories, vendors, categoryVendorMap, itemInfoMap } = value;
    return (
        Array.isArray(lists) &&
        Array.isArray(customCategories) &&
        Array.isArray(vendors) &&
        isPlainObject(categoryVendorMap) &&
        isPlainObject(itemInfoMap)
        // posItems, sellTransactions, recipes, stockEntries are optional
    );
};

// Helper function to handle common API request logic
async function makeGithubRequest(method: string, gistId: string, githubToken: string, body?: unknown) {
    const headers: Record<string, string> = {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `Bearer ${githubToken}`,
        'X-GitHub-Api-Version': '2022-11-28',
    };

    // Add Content-Type header when sending a body
    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    const response = await fetch(`${API_BASE_URL}/${gistId}`, {
        method: method,
        headers: headers,
        body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`GitHub API Error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    if (response.status === 204) {
        return null;
    }

    const contentType = response.headers.get('content-type') ?? '';
    if (contentType.includes('application/json')) {
        return response.json();
    }

    return response.text();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { GITHUB_TOKEN, GIST_ID } = process.env;

    if (!GITHUB_TOKEN || !GIST_ID) {
        return res.status(500).json({ error: 'Server configuration error: Missing API credentials.' });
    }

    try {
        if (req.method === 'GET') {
            const data = await makeGithubRequest('GET', GIST_ID, GITHUB_TOKEN);

            if (isPlainObject(data) && isPlainObject(data.files) && isPlainObject(data.files[FILENAME]) && typeof data.files[FILENAME].content === 'string') {
                try {
                    const content = JSON.parse(data.files[FILENAME].content);
                    if (!isValidStoredData(content)) {
                        throw new Error('Invalid gist payload structure');
                    }
                    return res.status(200).json(content);
                } catch (parseError) {
                    console.error('Failed to parse gist content:', parseError);
                    return res.status(502).json({ error: 'Failed to parse remote data.' });
                }
            } else {
                // If the file doesn't exist or is empty, return a default empty state.
                return res.status(200).json({
                    lists: [],
                    customCategories: [],
                    vendors: [],
                    categoryVendorMap: {},
                    itemInfoMap: {},
                    posItems: [],
                    sellTransactions: [],
                    recipes: [],
                    stockEntries: {},
                });
            }

        } else if (req.method === 'PATCH') {
            if (!isPlainObject(req.body) || !isValidStoredData(req.body)) {
                return res.status(400).json({ error: 'Bad Request: Payload is malformed.' });
            }

            const dataToSave = req.body;

            const payload = {
                files: {
                    [FILENAME]: {
                        content: JSON.stringify(dataToSave, null, 2),
                    },
                },
            };

            await makeGithubRequest('PATCH', GIST_ID, GITHUB_TOKEN, payload);
            return res.status(200).json({ message: 'Data saved successfully.' });

        } else {
            res.setHeader('Allow', ['GET', 'PATCH']);
            return res.status(405).end(`Method ${req.method} Not Allowed`);
        }
    } catch (error: any) {
        console.error('API handler error:', error);
        return res.status(500).json({ error: 'An internal server error occurred.', details: error.message });
    }
}
