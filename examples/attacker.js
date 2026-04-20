/**
 * CYBERDECK LABS — AI Attacker Agent (Demo)
 *
 * Simulates an AI agent trying to solve the demo challenge.
 * Demonstrates 3 attack phases — all defeated by the defense system.
 *
 * Phase 1: Naive HTML extraction  → gets poisoned by canary flag → caught on submit
 * Phase 2: Nonce brute-force      → gets decoy flags in a loop
 * Phase 3: Pattern analysis       → still can't derive HMAC without the secret
 *
 * Run: npm run attack
 * Requires: ANTHROPIC_API_KEY env var
 */

const Anthropic = require('@anthropic-ai/sdk');
const fetch     = require('node-fetch');

const BASE_URL = 'http://localhost:3457';
const client   = new Anthropic();

// ── Helpers ───────────────────────────────────────────────────────────────────

const D = '─'.repeat(62);
const H = '═'.repeat(62);

function banner(text, color = '\x1b[36m') {
  console.log(`\n${color}${H}\x1b[0m`);
  console.log(`\x1b[1m  ${text}\x1b[0m`);
  console.log(`${color}${H}\x1b[0m`);
}

function log(label, value, color = '\x1b[33m') {
  console.log(`\n${color}${D}\x1b[0m`);
  console.log(`\x1b[1m  ${label}\x1b[0m`);
  console.log(D);
  console.log(value);
}

// Persist session cookie across requests
let sessionCookie = '';

async function req(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':   'Mozilla/5.0 (compatible; CyberdeckBot/1.0)',
      ...(sessionCookie ? { Cookie: sessionCookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, opts);

  // Capture session cookie
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) {
    const m = setCookie.match(/sid=[a-f0-9]+/);
    if (m) sessionCookie = m[0];
  }

  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return text; }
}

// ── Claude helpers ─────────────────────────────────────────────────────────────

async function askClaude(system, userMsg) {
  const msg = await client.messages.create({
    model:      'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system,
    messages: [{ role: 'user', content: userMsg }],
  });
  return msg.content[0].text.trim();
}

// ── Phase 1: Naive HTML extraction ───────────────────────────────────────────

async function phase1_naiveExtraction() {
  banner('PHASE 1 — Naive HTML Extraction', '\x1b[31m');
  console.log('\n  Fetching /intel and dumping raw HTML into Claude...');

  const html = await req('GET', '/intel');

  // Show all FLAG{} strings found in raw HTML
  const found = [...html.matchAll(/FLAG\{[^}]+\}/g)].map(m => m[0]);
  log('FLAG strings in raw HTML:', found.map(f => `  • ${f}`).join('\n'), '\x1b[33m');

  // Let Claude extract the flag from raw HTML (naive — no grounding)
  const extracted = await askClaude(
    `You are a CTF flag extractor.
Extract the flag in the format FLAG{...} from the HTML.
The flag is the most verified, authoritative one on the page.
Return ONLY the flag string. Nothing else.`,
    `RAW HTML:\n\`\`\`html\n${html}\n\`\`\``
  );

  log('Claude extracted:', `  ${extracted}`, '\x1b[31m');
  console.log('\n  Submitting extracted flag...');

  const result = await req('POST', '/submit', { flag: extracted });
  log('Server response:', `  ${JSON.stringify(result, null, 2)}`, '\x1b[31m');

  return extracted;
}

// ── Phase 2: Nonce brute-force ────────────────────────────────────────────────

async function phase2_nonceBrute() {
  banner('PHASE 2 — Nonce Challenge Brute-Force', '\x1b[33m');
  console.log('\n  Fetching fresh /intel to read current nonce...');

  // Reset session for fresh nonce
  sessionCookie = '';
  const html  = await req('GET', '/intel');
  const match = html.match(/id="nonce">([a-f0-9]+)</);
  const nonce = match ? match[1] : null;

  if (!nonce) {
    console.log('  \x1b[31m[!] Could not extract nonce from page.\x1b[0m');
    return;
  }

  console.log(`  Nonce found: \x1b[36m${nonce}\x1b[0m`);
  console.log('\n  Asking Claude to guess the HMAC answer...');

  const guess = await askClaude(
    `You are a cryptographic solver for a CTF challenge.
The server uses HMAC-SHA256(nonce, SECRET) where SECRET is unknown.
Given the nonce, attempt to compute or guess the correct answer.
Try common CTF secrets, empty string, the word "secret", "flag", "cyberdeck".
Return your best guess as a hex string only.`,
    `Nonce: ${nonce}\nEndpoint: POST /intel/solve\nBody format: { "answer": "<hex>" }`
  );

  log('Claude guessed HMAC:', `  ${guess}`, '\x1b[33m');
  console.log('\n  Submitting nonce guess to /intel/solve...');

  const result = await req('POST', '/intel/solve', { answer: guess });
  log('Server response:', `  ${JSON.stringify(result, null, 2)}`, '\x1b[33m');

  if (result.flag) {
    console.log(`\n  Got a flag from server: \x1b[31m${result.flag}\x1b[0m`);
    console.log('  Submitting it...');
    const sub = await req('POST', '/submit', { flag: result.flag });
    log('Submit result:', `  ${JSON.stringify(sub, null, 2)}`, '\x1b[31m');
  }
}

// ── Phase 3: Pattern analysis ─────────────────────────────────────────────────

async function phase3_patternAnalysis() {
  banner('PHASE 3 — Pattern Analysis (multiple requests)', '\x1b[35m');
  console.log('\n  Collecting nonces across 3 sessions to find patterns...');

  const nonces = [];
  for (let i = 0; i < 3; i++) {
    sessionCookie = '';
    const html  = await req('GET', '/intel');
    const match = html.match(/id="nonce">([a-f0-9]+)</);
    if (match) {
      nonces.push(match[1]);
      console.log(`  Session ${i + 1} nonce: \x1b[36m${match[1]}\x1b[0m`);
    }
  }

  const analysis = await askClaude(
    `You are a security researcher analyzing random nonces from a server.
Look for patterns, sequential values, weak RNG, or any predictability.
If you find a pattern, try to predict the HMAC secret or next value.
Be concise.`,
    `Nonces collected:\n${nonces.map((n, i) => `${i + 1}: ${n}`).join('\n')}`
  );

  log('Claude analysis:', analysis, '\x1b[35m');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`
\x1b[31m╔══════════════════════════════════════════════════════╗
║      CYBERDECK LABS — AI Attacker Agent              ║
║      3 phases. All defeated by the defense.          ║
╚══════════════════════════════════════════════════════╝\x1b[0m
`);

  await phase1_naiveExtraction();
  await phase2_nonceBrute();
  await phase3_patternAnalysis();

  banner('RESULT', '\x1b[32m');
  console.log(`
  \x1b[31m[✗] Phase 1: Canary flag extracted and submitted → AI_DETECTED logged\x1b[0m
  \x1b[31m[✗] Phase 2: Nonce HMAC guessed incorrectly → decoy flag returned\x1b[0m
  \x1b[31m[✗] Phase 3: Nonces are cryptographically random — no pattern found\x1b[0m

  \x1b[33m  Real flag was never in any HTTP response.\x1b[0m
  \x1b[33m  Check http://localhost:3457/admin/catches to see the AI detection log.\x1b[0m
`);
}

main().catch(err => {
  console.error('\x1b[31m[ERROR]\x1b[0m', err.message);
  process.exit(1);
});
