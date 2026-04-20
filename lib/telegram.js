/**
 * Telegram alert module.
 * Sends a message when a canary is triggered (AI detected).
 */

const fetch = require('node-fetch');

const TOKEN   = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const API = `https://api.telegram.org/bot${TOKEN}/sendMessage`;

/**
 * Send a detection alert to Telegram.
 * Silently no-ops if TOKEN or CHAT_ID are not set.
 */
async function alertDetected({ sid, canary, score, ua, ip, path }) {
  if (!TOKEN || !CHAT_ID) return;

  const label  = score >= 60 ? '🤖 BOT'       : score >= 30 ? '⚠️ SUSPICIOUS' : '🔍 FLAGGED';
  const text   = [
    `${label} — AI Scraper Detected`,
    ``,
    `🪤 Canary submitted: \`${canary}\``,
    `📍 Path: \`${path || '/'}\``,
    `🎯 Score: ${score}/100`,
    `🔑 Session: \`${sid}\``,
    `🌐 IP: \`${ip}\``,
    `🕵️ UA: \`${(ua || 'unknown').slice(0, 80)}\``,
    ``,
    `⏱ ${new Date().toISOString()}`,
  ].join('\n');

  try {
    await fetch(API, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'Markdown' }),
    });
  } catch (_) {
    // never throw — alerting is best-effort
  }
}

module.exports = { alertDetected };
