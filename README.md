# Claude Rate Limit Checker

เช็ค rate limit ของ Claude ทั้ง 2 แบบ ส่งแจ้งเตือน Telegram อัตโนมัติทุก 30 นาที  
รันผ่าน **GitHub Actions** — ไม่ต้องมี server

---

## ตัวอย่างข้อความ Telegram

```
🤖 Claude Rate Limit
🕐 08/09/2569 20:30
━━━━━━━━━━━━━━━━━━━━

📡 Anthropic API (API Key)
Status: HTTP 200 ✅

🟢 Requests / min
  ███░░░░░░░  30% used
  เหลือ 70 / 100   รีเซ็ต 08/09/2569 20:31

🟡 Tokens / min
  █████░░░░░  50% used
  เหลือ 20,000 / 40,000   รีเซ็ต 08/09/2569 20:31

━━━━━━━━━━━━━━━━━━━━

🌐 Claude.ai (Pro / Max)

🟢 Session 5h
  ██░░░░░░░░  20% used
  รีเซ็ต 08/09/2569 23:00

🔴 Weekly 7d (All)
  ████████░░  80% used
  รีเซ็ต 15/09/2569 00:00

━━━━━━━━━━━━━━━━━━━━
```

---

## ตั้งค่า

### 1. GitHub Secrets

**Settings → Secrets and variables → Actions → New repository secret**

| Secret | รายละเอียด | จำเป็น? |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Token จาก @BotFather | ✅ |
| `TELEGRAM_CHAT_ID` | Chat ID (ใช้ @userinfobot หา) | ✅ |
| `ANTHROPIC_API_KEY` | API key จาก console.anthropic.com | สำหรับ API check |
| `CLAUDE_OAUTH_TOKEN` | OAuth token จากเครื่อง | สำหรับ Claude.ai check |

ใส่แค่ secret ที่ต้องการ — section ที่ไม่มี secret จะแสดง "ไม่ได้ตั้ง" แทน

### 2. หา CLAUDE_OAUTH_TOKEN

```bash
# macOS / Linux
cat ~/.claude/.credentials.json

# Windows
type %USERPROFILE%\.claude\.credentials.json
```

หาค่า `claudeAiOauthToken` แล้วเอาไปใส่ใน secret

> ⚠️ Token หมดอายุเป็นระยะ — ถ้าขึ้น HTTP 401 ต้อง `claude auth login` แล้วอัพเดท secret ใหม่

### 3. ปรับความถี่

แก้ไฟล์ `.github/workflows/check.yml`:

```yaml
- cron: "*/30 * * * *"   # ทุก 30 นาที
- cron: "*/15 * * * *"   # ทุก 15 นาที
- cron: "0 * * * *"      # ทุกชั่วโมง
```

### 4. ทดสอบ local

```bash
ANTHROPIC_API_KEY=sk-ant-... \
TELEGRAM_BOT_TOKEN=xxx \
TELEGRAM_CHAT_ID=yyy \
node check.js
```

---

## โครงสร้าง

```
claude-rate-limit-checker/
├── check.js                         ← สคริปต์หลัก (Node.js, zero deps)
└── .github/workflows/check.yml      ← GitHub Actions schedule
```
