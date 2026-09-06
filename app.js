// Standalone copy of the client logic used by index.html.
// Version 1.2.0: checks rate-limit headers through the Models API.
// It does NOT call the Messages API or send a prompt to Claude.

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/models';
const CLAUDE_API_VERSION = '2023-06-01';

async function testClaudeConnection(apiKey) {
    if (!apiKey) throw new Error('กรุณาใส่ API Key');

    const response = await fetch(CLAUDE_API_URL, {
        method: 'GET',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': CLAUDE_API_VERSION,
            'anthropic-dangerous-direct-browser-access': 'true'
        }
    });

    if (!response.ok) {
        let message = `HTTP ${response.status}`;
        try {
            const data = await response.json();
            message = data?.error?.message || message;
        } catch (_) {}
        throw new Error(message);
    }

    return {
        ok: true,
        headers: {
            requestsLimit: response.headers.get('anthropic-ratelimit-requests-limit'),
            requestsRemaining: response.headers.get('anthropic-ratelimit-requests-remaining'),
            requestsReset: response.headers.get('anthropic-ratelimit-requests-reset'),
            tokensLimit: response.headers.get('anthropic-ratelimit-tokens-limit'),
            tokensRemaining: response.headers.get('anthropic-ratelimit-tokens-remaining'),
            tokensReset: response.headers.get('anthropic-ratelimit-tokens-reset')
        }
    };
}
