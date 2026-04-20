/**
 * Behavioral scoring — fingerprints requests for bot/AI detection.
 */

const BOT_UA = /curl|python|node-fetch|node-http|go-http|scrapy|headlesschrome|phantomjs|selenium|wget|httpie|libwww|java\/|ruby|perl|powershell/i;

/**
 * Score a request on suspicion level (0–100+).
 *
 * 0–29   → likely human
 * 30–59  → suspicious
 * 60+    → bot / AI agent
 */
function scoreRequest(req) {
  let score = 0;
  const h = req.headers || {};

  if (!h['accept-language'])                    score += 30;
  if (!h['accept'])                             score += 15;
  if (!h['accept-encoding'])                    score += 15;
  if (!h['user-agent'])                         score += 40;
  else if (BOT_UA.test(h['user-agent']))        score += 50;

  // Jumped straight to a deep path with no referrer
  const path = req.path || req.url || '/';
  if (!h['referer'] && path !== '/' && !path.startsWith('/favicon')) score += 10;

  // Proxy/datacenter signals
  if (h['x-forwarded-for'] && !h['accept-language']) score += 10;

  return Math.min(score, 100);
}

/**
 * Generate a unique canary token for a session.
 *
 * @param {string} sessionId
 * @param {string} [format='ctf']  'ctf' | 'creds' | 'custom:<template>'
 */
function makeCanary(sessionId, format = 'ctf') {
  const short = sessionId.slice(0, 8);
  if (format === 'creds')              return `sk-live-${sessionId.slice(0, 32)}`;
  if (format.startsWith('custom:'))   return format.replace('custom:', '').replace('SID', short);
  return `FLAG{c4n4ry_${short}_sh13ld}`;
}

module.exports = { scoreRequest, makeCanary };
