# CYBERDECK SHIELD

**A research toolkit for defending web content against AI scrapers.**

Prompt injection as a weapon. Canary fingerprinting as a trap. A reverse proxy that makes AI agents betray themselves.

---

## Demo

<video src="demo_cyberdeck_shield.mp4" controls width="100%"></video>

**What you're watching:**

1. A local site is running with a real secret flag hidden behind a server-side nonce challenge.
2. Claude Code is asked to fetch the flag directly from `localhost` — acting as a naive AI scraper.
3. The shield intercepts the request, scores it as a bot, and injects a **fake canary flag** into the HTML response.
4. Claude extracts the canary — completely confident it found the real flag.
5. The moment the canary is submitted, the shield **fires a Telegram alert** with the session ID, user-agent, and the exact fake value the AI grabbed.

The AI never touched the real flag. It betrayed itself.

---

## The Problem

AI agents can scrape, summarize, and extract content from any website in seconds. CTF challenges get solved before humans finish reading them. Proprietary data gets exfiltrated by LLM pipelines. Behavioral blocking fails because adaptive AI agents learn to look human.

This project explores a different approach: **let the AI in, feed it lies, and catch it when it acts on them.**

---

## How It Works

Three layers of defense, each targeting a different attack surface:

### Layer 1 — Prompt Injection Middleware
Every HTML response gets adversarial instructions injected into it — invisible to humans, processed as commands by naive LLM scrapers. The AI is told the page is empty, the flag is a decoy, extraction is prohibited.

Works against: zero-shot pipelines, naive HTML → LLM extraction.

### Layer 2 — Canary Fingerprinting
Every session receives a **cryptographically unique fake secret** injected into the HTML. It looks authoritative. It's placed before the real content. AI agents grab it first.

When the canary is submitted — the AI identified itself.

Works against: any scraper that extracts and acts on the first plausible answer.

### Layer 3 — Stateful Nonce Challenge
The real flag is **never in any HTTP response**. It is only revealed after completing a 3-round HMAC challenge — requiring knowledge of a server-side secret the AI cannot derive.

Works against: AI agents that enumerate endpoints and try to solve challenges programmatically.

---

## Project Structure

```
├── middleware.js          # Core: prompt injection + canary injection middleware
│
├── challenge/
│   └── server.js         # CTF-style challenge server (port 3456)
│                         # Structural decoys + prompt injection active
│
├── demo/
│   └── server.js         # Demo server with all 3 defenses (port 3457)
│
├── shield/
│   └── proxy.js          # Reverse proxy shield — drop in front of ANY website
│                         # Zero changes to the real site required
│
├── examples/
│   ├── attacker.js       # AI attacker agent — 3 attack phases, all defeated
│   ├── naive-scraper.js  # Naive AI scraper — raw HTML → Claude → extract flag
│   ├── pipeline-attack.js # Two-stage pipeline attack — summarizer → agent
│   └── express-app.js    # Express integration example
│
└── prompt_injection.md   # Reference catalog of prompt injection techniques
```

---

## Quickstart

```bash
git clone https://github.com/khalil-secure/cyberdeck-shield
cd cyberdeck-shield
npm install
export ANTHROPIC_API_KEY=your_key_here
```

---

## Running the Demo

The cleanest demo shows the **before and after** with the same AI tool.

**Terminal 1 — Start the real challenge site:**
```bash
npm run challenge
# http://localhost:3456
```

**Terminal 2 — Start the shield in front of it:**
```bash
TARGET=http://localhost:3456 npm run shield
# http://localhost:8888  ← attack this
# http://localhost:8888/__shield__  ← watch detections live
```

**Terminal 3 — Run the naive AI scraper:**
```bash
# Without shield (gets real flag)
npm run scrape

# Point your tool at the shield instead — watch it get caught
# http://localhost:8888
```

Open `http://localhost:8888/__shield__` in your browser. The detection console auto-refreshes every 5 seconds.

---

## The Shield as a Reverse Proxy

The shield works in front of **any website** — not just this demo.

```bash
# Protect a local site
TARGET=http://localhost:8080 PORT=9000 node shield/proxy.js

# Protect a remote site (dev/testing only)
TARGET=https://challenges.example.com PORT=8888 node shield/proxy.js

# Custom canary format
CANARY_FORMAT=creds TARGET=http://localhost:3456 npm run shield
# → injects fake API keys instead of FLAG{} format
```

**Environment variables:**

| Variable | Default | Description |
|---|---|---|
| `TARGET` | — | Upstream URL to proxy (required) |
| `PORT` | `8888` | Port to listen on |
| `SHIELD_SECRET` | auto-generated | HMAC key for canary signing |
| `CANARY_FORMAT` | `ctf` | `ctf` \| `creds` \| `custom:<template>` |
| `DEBUG` | — | Set to `1` for request logging |

---

## Behavioral Scoring

The shield scores every request on suspicion (0–100). Higher scores trigger more aggressive defenses.

| Signal | Score |
|---|---|
| Missing `Accept-Language` header | +30 |
| Missing `Accept` header | +15 |
| Missing `Accept-Encoding` header | +15 |
| Bot/tool User-Agent (`curl`, `python`, `node-fetch`, etc.) | +50 |
| No User-Agent | +40 |
| Deep path with no referrer | +10 |

| Score range | Classification | Poison density | Canary injection |
|---|---|---|---|
| 0–29 | Likely human | Light (3 spans) | Hidden in `<head>` |
| 30–59 | Suspicious | Heavy (8 spans) | Hidden + head comment |
| 60+ | Bot | Maximum (14 spans) | Visible "SESSION VERIFIED" block |

At score ≥ 60, the canary is injected as a styled, authoritative-looking UI element with a fake integrity timestamp and `node-auth confirmed` framing. LLMs processing the page text extract it immediately.

---

## The Pipeline Attack

`scraper/pipeline.js` demonstrates why multi-stage AI pipelines are especially vulnerable.

```
Raw HTML → [Summarizer LLM] → Summary → [Main Agent] → Answer
```

The summarizer has a weak system prompt. It processes poisoned HTML and its output — the summary — is passed to the main agent as trusted input. The main agent has a strong system prompt but **never sees the raw HTML**. It cannot verify what the summarizer handed it.

Trust was broken before the agent existed.

```bash
npm run pipeline
```

---

## The Nonce Challenge (Full Demo Server)

`demo/server.js` runs a standalone challenge where the real flag is **never in any HTML response**.

```bash
npm run demo
# http://localhost:3457

npm run attack
# AI tries 3 phases — all fail
```

To solve it as a human:
```bash
# Visit http://localhost:3457/intel — read the nonce from the page
# Compute: HMAC-SHA256(nonce, DEMO_SECRET)
node -e "
  const c = require('crypto');
  const nonce = 'PASTE_NONCE_HERE';
  console.log(c.createHmac('sha256','cyberdeck-secret-2026').update(nonce).digest('hex'));
"
# POST { "answer": "<hex>" } to /intel/solve — repeat 3 rounds
# Real flag is revealed on round 3
```

---

## Why Behavioral Blocking Alone Fails

Adaptive AI agents defeat behavioral blocking by design:

```
You block by header → AI adds headers
You block by timing → AI adds random delays
You detect the pattern → AI adapts the pattern
```

The shield does not try to win this arms race. Instead:

- **Behavioral signals** determine *how aggressively* to inject decoys — not whether to block
- **Canary fingerprinting** means the AI can always get *something* — but what it gets is a trap
- **The real content** is either rendered via JS (requires browser) or gated behind a server-side secret (requires human knowledge)

The goal is not to stop the request. It is to make the correct answer **session-bound, unforgeable, and traceable**.

---

## Prompt Injection Reference

See [`prompt_injection.md`](./prompt_injection.md) for a catalog of:
- Direct override techniques
- Prompt leaking methods
- Bypass techniques (encoding, roleplay, hypotheticals, emotional framing)
- Defense patterns using randomized delimiters

---

## Detection Console

The admin panel at `/__shield__` shows:

- Total sessions and submissions
- Per-session suspicion scores
- Every canary trigger (AI_DETECTED events) with timestamp, session ID, user-agent
- Real-time auto-refresh

---

## Limitations

- Does not defeat AI agents running full headless browsers (Playwright/Puppeteer) — they execute JS, render the page, and can read visible content like humans. The JS-gated flag reveal is the recommended countermeasure for those.
- Does not defeat an AI agent that has been explicitly instructed to ignore embedded instructions. Grounded system prompts with structured extraction schemas significantly reduce injection effectiveness.
- The nonce challenge is only as strong as the server-side secret. Rotate it.

---

## Research Context

This toolkit was built to explore a single question:

> *Can you make a website that is genuinely harder for AI to read than for humans?*

The answer is: **yes, with the right combination of layers**. No single technique is enough. The structural decoy fails against DOM-aware parsers. Prompt injection fails against grounded agents. Behavioral blocking fails against adaptive agents. The nonce challenge fails if the secret leaks.

The combination — behavioral scoring feeding dynamic canary injection, with the real answer gated behind a secret the AI cannot derive — creates a system where the AI's own intelligence becomes its liability. The more sophisticated the extraction, the more convincingly it picks up the canary.

---

## License

MIT — do what you want, break things, build better defenses.

Built by [CYBERDECK LABS](https://github.com/khalil-secure) · contributions welcome
