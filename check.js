/**
 * Claude Rate Limit Checker
 * ─────────────────────────────────────────────────────────────
 *  1) Claude API  → GET /v1/models → อ่าน x-ratelimit-* headers (ไม่เสีย token)
 *  2) Claude.ai   → เรียก /api/oauth/usage (undocumented endpoint)
 *  3) ส่งรายงาน  → Telegram Bot
 *
 *  Zero dependencies — ใช้แค่ Node.js built-in modules
 * ─────────────────────────────────────────────────────────────
 */

"use strict";
const https = require("https");

// ══════════════════════════════════════════════════════════════
// Config — อ่านจาก environment variables ทั้งหมด
// ══════════════════════════════════════════════════════════════
const CFG = {
  telegramToken : process.env.TELEGRAM_BOT_TOKEN  || "",
  telegramChatId: process.env.TELEGRAM_CHAT_ID    || "",
  anthropicKey  : process.env.ANTHROPIC_API_KEY   || "",
  oauthToken    : process.env.CLAUDE_OAUTH_TOKEN  || "",
};

// ══════════════════════════════════════════════════════════════
// Utility
// ══════════════════════════════════════════════════════════════

/** HTTP request → Promise<{statusCode, headers, body}> */
function req(options, bodyStr = null) {
  return new Promise((resolve, reject) => {
    const r = https.request(options, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => resolve({ statusCode: res.statusCode, headers: res.headers, body: buf }));
    });
    r.on("error", reject);
    if (bodyStr) r.write(bodyStr);
    r.end();
  });
}

/** Progress bar  e.g. bar(72) → "███████░░░" */
function bar(pct, len = 10) {
  const n = Math.min(100, Math.max(0, Math.round(pct)));
  const f = Math.round((n / 100) * len);
  return "█".repeat(f) + "░".repeat(len - f);
}

/** สีตาม % ที่ใช้ไป */
function emoji(pct) {
  if (pct >= 80) return "🔴";
  if (pct >= 50) return "🟡";
  return "🟢";
}

/** แปลง ISO string → Thai time string */
function thaiTime(iso) {
  if (!iso || iso === "?") return "?";
  try {
    return new Date(iso).toLocaleString("th-TH", {
      timeZone: "Asia/Bangkok",
      hour12: false,
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

/** คำนวณ % ที่ใช้ไป จาก remaining / limit */
function usedPct(remaining, limit) {
  const r = Number(remaining);
  const l = Number(limit);
  if (!l || isNaN(r) || isNaN(l)) return null;
  return Math.round(((l - r) / l) * 100);
}

// ══════════════════════════════════════════════════════════════
// 1) Claude API — GET /v1/models → อ่าน rate-limit headers
//    ✅ ไม่เสีย token เลย — แค่ list models
// ══════════════════════════════════════════════════════════════
async function checkApi() {
  if (!CFG.anthropicKey) return null;

  let res;
  try {
    res = await req({
      hostname: "api.anthropic.com",
      path: "/v1/models",
      method: "GET",
      headers: {
        "x-api-key": CFG.anthropicKey,
        "anthropic-version": "2023-06-01",
      },
    });
  } catch (e) {
    return { error: `network: ${e.message}` };
  }

  // Anthropic ส่ง headers พวกนี้กลับมาทุก response (รวมถึง 429)
  const h = res.headers;
  const get = (k) => h[k] ?? h[k.toLowerCase()] ?? null;

  return {
    httpStatus  : res.statusCode,
    // Requests per minute
    rpmLimit    : get("x-ratelimit-limit-requests"),
    rpmRemaining: get("x-ratelimit-remaining-requests"),
    rpmReset    : get("x-ratelimit-reset-requests"),
    // Tokens per minute
    tpmLimit    : get("x-ratelimit-limit-tokens"),
    tpmRemaining: get("x-ratelimit-remaining-tokens"),
    tpmReset    : get("x-ratelimit-reset-tokens"),
    // Input tokens per minute (มีเฉพาะบางรุ่น)
    itpmLimit    : get("x-ratelimit-limit-input-tokens"),
    itpmRemaining: get("x-ratelimit-remaining-input-tokens"),
    // Output tokens per minute
    otpmLimit    : get("x-ratelimit-limit-output-tokens"),
    otpmRemaining: get("x-ratelimit-remaining-output-tokens"),
    // Retry-After (กรณี rate limited)
    retryAfter  : get("retry-after"),
  };
}

// ══════════════════════════════════════════════════════════════
// 2) Claude.ai — undocumented /api/oauth/usage endpoint
//    ต้องการ OAuth token จาก ~/.claude/.credentials.json
// ══════════════════════════════════════════════════════════════
async function checkWeb() {
  if (!CFG.oauthToken) return null;

  let res;
  try {
    res = await req({
      hostname: "api.anthropic.com",
      path: "/api/oauth/usage",
      method: "GET",
      headers: {
        Authorization: `Bearer ${CFG.oauthToken}`,
        "anthropic-version": "2023-06-01",
        "user-agent": "claude-rate-limit-checker/2.0",
      },
    });
  } catch (e) {
    return { error: `network: ${e.message}` };
  }

  if (res.statusCode !== 200) {
    let hint = "";
    if (res.statusCode === 401) hint = " (token หมดอายุ — login ใหม่แล้วอัพเดท CLAUDE_OAUTH_TOKEN)";
    if (res.statusCode === 403) hint = " (plan ไม่รองรับ — ต้องเป็น Pro/Max)";
    return { error: `HTTP ${res.statusCode}${hint}` };
  }

  let data;
  try {
    data = JSON.parse(res.body);
  } catch {
    return { error: "parse JSON ไม่ได้: " + res.body.slice(0, 80) };
  }

  // Community พบโครงสร้าง:
  // { five_hour: {used_pct, reset_at}, seven_day: {used_pct, reset_at},
  //   sonnet_seven_day: {used_pct, reset_at} }
  return { ok: true, raw: data };
}

// ══════════════════════════════════════════════════════════════
// ส่ง Telegram
// ══════════════════════════════════════════════════════════════
async function sendTelegram(text) {
  if (!CFG.telegramToken || !CFG.telegramChatId) {
    console.log("[Telegram] ข้าม — ยังไม่ได้ตั้ง TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID");
    return;
  }
  const body = JSON.stringify({
    chat_id: CFG.telegramChatId,
    text,
    parse_mode: "HTML",
  });
  try {
    const res = await req(
      {
        hostname: "api.telegram.org",
        path: `/bot${CFG.telegramToken}/sendMessage`,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(body),
        },
      },
      body
    );
    if (res.statusCode === 200) {
      console.log("[Telegram] ✅ ส่งสำเร็จ");
    } else {
      console.error("[Telegram] ❌ ส่งไม่สำเร็จ:", res.body);
    }
  } catch (e) {
    console.error("[Telegram] ❌ network error:", e.message);
  }
}

// ══════════════════════════════════════════════════════════════
// Build ข้อความรายงาน
// ══════════════════════════════════════════════════════════════
function buildReport(apiData, webData) {
  const now = thaiTime(new Date().toISOString());
  const lines = [];

  lines.push(`🤖 <b>Claude Rate Limit</b>`);
  lines.push(`🕐 ${now}`);
  lines.push("━━━━━━━━━━━━━━━━━━━━");

  // ── API Section ──────────────────────────────────────────────
  lines.push("");
  lines.push("📡 <b>Anthropic API (API Key)</b>");

  if (!apiData) {
    lines.push("⚠️ ไม่ได้ตั้ง ANTHROPIC_API_KEY");
  } else if (apiData.error) {
    lines.push(`❌ ${apiData.error}`);
  } else {
    const http = apiData.httpStatus;
    const isRateLimited = http === 429;
    lines.push(`Status: <code>HTTP ${http}</code>${isRateLimited ? " ⛔ Rate Limited!" : " ✅"}`);
    if (apiData.retryAfter) lines.push(`⏳ Retry-After: ${apiData.retryAfter}s`);

    // Requests per minute
    const rPct = usedPct(apiData.rpmRemaining, apiData.rpmLimit);
    if (rPct !== null) {
      lines.push(`\n${emoji(rPct)} <b>Requests / min</b>`);
      lines.push(`  <code>${bar(rPct)}</code>  ${rPct}% used`);
      lines.push(`  เหลือ ${apiData.rpmRemaining} / ${apiData.rpmLimit}   รีเซ็ต ${thaiTime(apiData.rpmReset)}`);
    }

    // Tokens per minute
    const tPct = usedPct(apiData.tpmRemaining, apiData.tpmLimit);
    if (tPct !== null) {
      lines.push(`\n${emoji(tPct)} <b>Tokens / min</b>`);
      lines.push(`  <code>${bar(tPct)}</code>  ${tPct}% used`);
      lines.push(`  เหลือ ${Number(apiData.tpmRemaining).toLocaleString()} / ${Number(apiData.tpmLimit).toLocaleString()}   รีเซ็ต ${thaiTime(apiData.tpmReset)}`);
    }

    // Input tokens (optional)
    const iPct = usedPct(apiData.itpmRemaining, apiData.itpmLimit);
    if (iPct !== null) {
      lines.push(`\n${emoji(iPct)} <b>Input Tokens / min</b>`);
      lines.push(`  <code>${bar(iPct)}</code>  ${iPct}% used`);
      lines.push(`  เหลือ ${Number(apiData.itpmRemaining).toLocaleString()} / ${Number(apiData.itpmLimit).toLocaleString()}`);
    }

    // Output tokens (optional)
    const oPct = usedPct(apiData.otpmRemaining, apiData.otpmLimit);
    if (oPct !== null) {
      lines.push(`\n${emoji(oPct)} <b>Output Tokens / min</b>`);
      lines.push(`  <code>${bar(oPct)}</code>  ${oPct}% used`);
      lines.push(`  เหลือ ${Number(apiData.otpmRemaining).toLocaleString()} / ${Number(apiData.otpmLimit).toLocaleString()}`);
    }
  }

  lines.push("\n━━━━━━━━━━━━━━━━━━━━");

  // ── Web Section ──────────────────────────────────────────────
  lines.push("");
  lines.push("🌐 <b>Claude.ai (Pro / Max)</b>");

  if (!webData) {
    lines.push("⚠️ ไม่ได้ตั้ง CLAUDE_OAUTH_TOKEN");
  } else if (webData.error) {
    lines.push(`❌ ${webData.error}`);
  } else {
    const d = webData.raw || {};

    const sections = [
      { key: "five_hour",        label: "Session 5h"       },
      { key: "seven_day",        label: "Weekly 7d (All)"  },
      { key: "sonnet_seven_day", label: "Weekly 7d (Sonnet)"},
    ];

    let found = false;
    for (const s of sections) {
      const v = d[s.key];
      if (!v) continue;
      found = true;
      const pct = Math.round((v.used_pct ?? 0) * 100);
      lines.push(`\n${emoji(pct)} <b>${s.label}</b>`);
      lines.push(`  <code>${bar(pct)}</code>  ${pct}% used`);
      lines.push(`  รีเซ็ต ${thaiTime(v.reset_at)}`);
    }

    if (!found) {
      // Response format อาจต่างกัน — dump raw เพื่อ debug
      lines.push("⚠️ รูปแบบ response ไม่คาดหมาย:");
      lines.push(`<code>${JSON.stringify(d).slice(0, 200)}</code>`);
    }
  }

  lines.push("\n━━━━━━━━━━━━━━━━━━━━");
  return lines.join("\n");
}

// ══════════════════════════════════════════════════════════════
// Main
// ══════════════════════════════════════════════════════════════
async function main() {
  console.log(`[${new Date().toISOString()}] 🚀 เริ่มเช็ค rate limit...`);

  const [apiData, webData] = await Promise.all([
    checkApi(),
    checkWeb(),
  ]);

  console.log("\n── API Data ──");
  console.log(JSON.stringify(apiData, null, 2));
  console.log("\n── Web Data ──");
  console.log(JSON.stringify(webData, null, 2));

  const msg = buildReport(apiData, webData);
  console.log("\n── Telegram Preview ──");
  console.log(msg.replace(/<[^>]+>/g, ""));  // strip HTML tags ใน console

  await sendTelegram(msg);
  console.log("\n[Done]");
}

main().catch((e) => {
  console.error("💥 Fatal:", e);
  process.exit(1);
});
