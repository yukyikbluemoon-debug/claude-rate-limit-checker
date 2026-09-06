// This file is kept as a standalone copy of the client logic used by index.html.
// The GitHub Pages app currently embeds the same logic directly in index.html.

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_API_VERSION = '2023-06-01';
const CLAUDE_MODEL = 'claude-sonnet-4-6';

async function testClaudeConnection(apiKey) {
    if (!apiKey) throw new Error('กรุณาใส่ API Key');

    const response = await fetch(CLAUDE_API_URL, {
        method: 'POST',
        headers: {
            'x-api-key': apiKey,
            'anthropic-version': CLAUDE_API_VERSION,
            'anthropic-dangerous-direct-browser-access': 'true',
            'content-type': 'application/json'
        },
        body: JSON.stringify({
            model: CLAUDE_MODEL,
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }]
        })
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
