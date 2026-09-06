// Constants
const STORAGE_KEY = 'claude_api_settings';
const API_BASE = 'https://api.groq.com/openai/v1'; // ใช้ Groq แทน

// State
let apiKey = '';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    updateUI();
});

function loadSettings() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        const settings = JSON.parse(saved);
        apiKey = settings.apiKey || '';
        if (apiKey) {
            document.getElementById('apiKey').value = apiKey;
        }
    }
}

function saveSettings() {
    apiKey = document.getElementById('apiKey').value.trim();
    
    if (!apiKey) {
        alert('กรุณาใส่ API Key');
        return;
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ apiKey }));
    toggleSettings();
    updateUI();
    alert('บันทึกแล้ว');
}

function clearSettings() {
    if (confirm('ต้องการลบ API Key หรือไม่?')) {
        localStorage.removeItem(STORAGE_KEY);
        apiKey = '';
        document.getElementById('apiKey').value = '';
        updateUI();
    }
}

function toggleSettings() {
    document.getElementById('settingsModal').classList.toggle('active');
}

function updateUI() {
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');
    const btn = document.getElementById('testBtn');
    
    if (apiKey) {
        indicator.classList.add('connected');
        text.textContent = 'มี API Key';
        btn.disabled = false;
    } else {
        indicator.classList.remove('connected');
        text.textContent = 'ไม่ได้เชื่อมต่อ';
        btn.disabled = true;
    }
}

async function testConnection() {
    if (!apiKey) {
        alert('กรุณาตั้งค่า API Key ก่อน');
        toggleSettings();
        return;
    }
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: 'llama-3.3-70b-versatile',
                messages: [{ role: 'user', content: 'Hi' }],
                max_tokens: 1
            })
        });
        
        // Groq ส่ง rate limit headers กลับมา
        const headers = {
            requestsLimit: response.headers.get('x-ratelimit-limit-requests'),
            requestsRemaining: response.headers.get('x-ratelimit-remaining-requests'),
            requestsReset: response.headers.get('x-ratelimit-reset-requests'),
            tokensLimit: response.headers.get('x-ratelimit-limit-tokens'),
            tokensRemaining: response.headers.get('x-ratelimit-remaining-tokens'),
            tokensReset: response.headers.get('x-ratelimit-reset-tokens')
        };
        
        updateRateLimitDisplay(headers);
        document.getElementById('statusText').textContent = 'เชื่อมต่อสำเร็จ';
        document.getElementById('infoBox').style.display = 'block';
        
    } catch (error) {
        console.error('Error:', error);
        alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
        showLoading(false);
    }
}

function updateRateLimitDisplay(headers) {
    const container = document.getElementById('limitsContainer');
    container.style.display = 'flex';
    
    // Requests
    if (headers.requestsLimit && headers.requestsRemaining) {
        const limit = parseInt(headers.requestsLimit);
        const remaining = parseInt(headers.requestsRemaining);
        const used = limit - remaining;
        const percent = (used / limit) * 100;
        
        document.getElementById('requestsValue').textContent = `${used}/${limit}`;
        document.getElementById('requestsProgress').style.width = `${percent}%`;
        
        if (percent > 80) {
            document.getElementById('requestsProgress').classList.add('warning');
        }
        
        if (headers.requestsReset) {
            const seconds = Math.ceil(parseFloat(headers.requestsReset));
            document.getElementById('requestsReset').textContent = `รีเซ็ตใน: ${seconds} วินาที`;
        }
    }
    
    // Tokens
    if (headers.tokensLimit && headers.tokensRemaining) {
        const limit = parseInt(headers.tokensLimit);
        const remaining = parseInt(headers.tokensRemaining);
        const used = limit - remaining;
        const percent = (used / limit) * 100;
        
        document.getElementById('tokensValue').textContent = `${formatNumber(used)}/${formatNumber(limit)}`;
        document.getElementById('tokensProgress').style.width = `${percent}%`;
        
        if (percent > 80) {
            document.getElementById('tokensProgress').classList.add('warning');
        }
        
        if (headers.tokensReset) {
            const seconds = Math.ceil(parseFloat(headers.tokensReset));
            document.getElementById('tokensReset').textContent = `รีเซ็ตใน: ${seconds} วินาที`;
        }
    }
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString();
}

function showLoading(show) {
    document.getElementById('loadingOverlay').classList.toggle('active', show);
}

document.getElementById('settingsModal').addEventListener('click', (e) => {
    if (e.target.id === 'settingsModal') toggleSettings();
});
