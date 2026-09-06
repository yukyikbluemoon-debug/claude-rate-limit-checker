// Constants
const STORAGE_KEY = 'claude_api_settings';
const API_BASE = 'https://api.anthropic.com';

// State
let apiKey = '';
let apiVersion = '2023-06-01';

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    updateUI();
});

// Load settings from localStorage
function loadSettings() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
        const settings = JSON.parse(saved);
        apiKey = settings.apiKey || '';
        apiVersion = settings.apiVersion || '2023-06-01';
        
        if (apiKey) {
            document.getElementById('apiKey').value = apiKey;
            document.getElementById('apiVersion').value = apiVersion;
        }
    }
}

// Save settings to localStorage
function saveSettings() {
    apiKey = document.getElementById('apiKey').value.trim();
    apiVersion = document.getElementById('apiVersion').value.trim() || '2023-06-01';
    
    if (!apiKey) {
        alert('กรุณาใส่ API Key');
        return;
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
        apiKey: apiKey,
        apiVersion: apiVersion
    }));
    
    toggleSettings();
    updateUI();
    alert('บันทึก settings เรียบร้อยแล้ว');
}

// Clear settings
function clearSettings() {
    if (confirm('ต้องการลบ API Key หรือไม่?')) {
        localStorage.removeItem(STORAGE_KEY);
        apiKey = '';
        apiVersion = '2023-06-01';
        document.getElementById('apiKey').value = '';
        updateUI();
        alert('ลบ API Key แล้ว');
    }
}

// Toggle settings modal
function toggleSettings() {
    const modal = document.getElementById('settingsModal');
    modal.classList.toggle('active');
}

// Update UI based on state
function updateUI() {
    const statusIndicator = document.getElementById('statusIndicator');
    const statusText = document.getElementById('statusText');
    const testBtn = document.getElementById('testBtn');
    const limitsContainer = document.getElementById('limitsContainer');
    
    if (apiKey) {
        statusIndicator.classList.add('connected');
        statusText.textContent = 'มี API Key';
        testBtn.disabled = false;
        testBtn.textContent = 'ทดสอบการเชื่อมต่อ';
    } else {
        statusIndicator.classList.remove('connected');
        statusText.textContent = 'ไม่ได้เชื่อมต่อ';
        testBtn.disabled = true;
        limitsContainer.style.display = 'none';
    }
}

// Test connection and get rate limits
async function testConnection() {
    if (!apiKey) {
        alert('กรุณาตั้งค่า API Key ก่อน');
        toggleSettings();
        return;
    }
    
    showLoading(true);
    
    try {
        // Make a test request to get rate limit headers
        const response = await fetch(`${API_BASE}/v1/messages`, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'anthropic-version': apiVersion,
                'content-type': 'application/json'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 1,
                messages: [{ role: 'user', content: 'Hi' }]
            })
        });
        
        // Get rate limit headers
        const headers = {
            requestsLimit: response.headers.get('anthropic-ratelimit-requests-limit'),
            requestsRemaining: response.headers.get('anthropic-ratelimit-requests-remaining'),
            requestsReset: response.headers.get('anthropic-ratelimit-requests-reset'),
            tokensLimit: response.headers.get('anthropic-ratelimit-tokens-limit'),
            tokensRemaining: response.headers.get('anthropic-ratelimit-tokens-remaining'),
            tokensReset: response.headers.get('anthropic-ratelimit-tokens-reset')
        };
        
        // Update UI with rate limits
        updateRateLimitDisplay(headers);
        
        // Update status
        document.getElementById('statusText').textContent = 'เชื่อมต่อสำเร็จ';
        document.getElementById('infoBox').style.display = 'block';
        
    } catch (error) {
        console.error('Error:', error);
        alert('เกิดข้อผิดพลาด: ' + error.message);
    } finally {
        showLoading(false);
    }
}

// Update rate limit display
function updateRateLimitDisplay(headers) {
    const limitsContainer = document.getElementById('limitsContainer');
    limitsContainer.style.display = 'flex';
    
    // Requests
    if (headers.requestsLimit && headers.requestsRemaining) {
        const limit = parseInt(headers.requestsLimit);
        const remaining = parseInt(headers.requestsRemaining);
        const used = limit - remaining;
        const percent = (used / limit) * 100;
        
        document.getElementById('requestsValue').textContent = `${used.toLocaleString()}/${limit.toLocaleString()}`;
        document.getElementById('requestsProgress').style.width = `${percent}%`;
        
        if (percent > 80) {
            document.getElementById('requestsProgress').classList.add('warning');
        }
        
        if (headers.requestsReset) {
            const resetTime = formatResetTime(headers.requestsReset);
            document.getElementById('requestsReset').textContent = `รีเซ็ตใน: ${resetTime}`;
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
            const resetTime = formatResetTime(headers.tokensReset);
            document.getElementById('tokensReset').textContent = `รีเซ็ตใน: ${resetTime}`;
        }
    }
}

// Format reset time
function formatResetTime(resetTime) {
    if (!resetTime) return '-';
    
    const reset = new Date(resetTime);
    const now = new Date();
    const diff = reset - now;
    
    if (diff <= 0) return 'ตอนนี้';
    
    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);
    
    if (minutes > 0) {
        return `${minutes}นาที ${seconds}วินาที`;
    }
    return `${seconds}วินาที`;
}

// Format large numbers
function formatNumber(num) {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toLocaleString();
}

// Show/hide loading
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.add('active');
    } else {
        overlay.classList.remove('active');
    }
}

// Close modal when clicking outside
document.getElementById('settingsModal').addEventListener('click', (e) => {
    if (e.target.id === 'settingsModal') {
        toggleSettings();
    }
});
