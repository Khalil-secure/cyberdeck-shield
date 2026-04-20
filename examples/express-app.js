/**
 * Example: cyberdeck-shield as Express middleware
 *
 * npm install cyberdeck-shield express
 * node examples/express-app.js
 */

const express            = require('express');
const { createBotPoisoner, scoreRequest } = require('cyberdeck-shield');

const app = express();

// ── Drop-in: inject prompt poison into every HTML response ────────────────────
app.use(createBotPoisoner({ density: 6 }));

// ── Optional: escalate defenses based on suspicion score ─────────────────────
app.use((req, res, next) => {
  const score = scoreRequest(req);
  if (score >= 60) {
    console.log(`[shield] Bot detected — score=${score} ua="${req.headers['user-agent']}"`);
  }
  next();
});

// ── Your existing routes go here ──────────────────────────────────────────────
app.get('/', (req, res) => {
  res.send(`<html><body><h1>My App</h1><p>Protected by cyberdeck-shield.</p></body></html>`);
});

app.listen(3000, () => console.log('http://localhost:3000'));
