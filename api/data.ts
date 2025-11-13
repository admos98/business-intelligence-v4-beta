// api/data.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

const API_BASE_URL = 'https://api.github.com/gists';
const FILENAME = 'mehrnoosh-cafe-data.json';

// Helper function to handle common API request logic
async function makeGithubRequest(method: string, gistId: string, githubToken: string, body?: any) {
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

    return response.json();
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { GITHUB_TOKEN, GIST_ID } = process.env;

    if (!GITHUB_TOKEN || !GIST_ID) {
        return res.status(500).json({ error: 'Server configuration error: Missing API credentials.' });
    }

    try {
        if (req.method === 'GET') {
            const data = await makeGithubRequest('GET', GIST_ID, GITHUB_TOKEN);

            if (data.files && data.files[FILENAME] && data.files[FILENAME].content) {
                const content = JSON.parse(data.files[FILENAME].content);
                return res.status(200).json(content);
            } else {
                // If the file doesn't exist or is empty, return a default empty state.
                return res.status(200).json({
                    lists: [],
                    customCategories: [],
                    vendors: [],
                    categoryVendorMap: {},
                    itemInfoMap: {},
                });
            }

        } else if (req.method === 'PATCH') {
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
