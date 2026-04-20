/**
 * cyberdeck-shield
 *
 * One-line AI scraper defense for Express apps.
 *
 * Usage:
 *   const shield = require('cyberdeck-shield');
 *   app.use(shield());
 *
 * Proxy any website:
 *   npx cyberdeck-shield --target http://localhost:3000
 */

require('./lib/env');

const { createBotPoisoner, createInjector, BOT_POISON_PROMPTS } = require('./middleware');
const { scoreRequest, makeCanary }                               = require('./lib/scorer');
const { createShield }                                           = require('./lib/shield');
const { alertDetected }                                          = require('./lib/telegram');

/**
 * Default export — drop-in Express middleware.
 * Stacks behavioral scoring + canary injection + prompt poisoning.
 *
 * @param {Object}   [opts]
 * @param {number}   [opts.density]       Poison prompts per page (auto-scales with score if omitted)
 * @param {string}   [opts.canaryFormat]  'ctf' | 'creds' | 'custom:<tmpl>'
 * @param {string[]} [opts.extraPrompts]  Extra injection strings
 * @param {boolean}  [opts.debug]
 *
 * @example
 * const shield = require('cyberdeck-shield');
 * app.use(shield());
 * app.use(shield({ density: 10, canaryFormat: 'creds' }));
 */
function shield(opts = {}) {
  const { canaryFormat = 'ctf', debug = false, extraPrompts = [] } = opts;

  const crypto   = require('crypto');
  const sessions = new Map();

  function parseSid(req) {
    const m = (req.headers.cookie || '').match(/(?:^|;\s*)__shield_sid=([a-f0-9]+)/);
    return m ? m[1] : null;
  }

  const poisoner = createBotPoisoner({ density: opts.density || 5, extraPrompts, debug });

  return function shieldMiddleware(req, res, next) {
    // Session
    let sid = parseSid(req);
    if (!sid || !sessions.has(sid)) {
      sid = crypto.randomBytes(10).toString('hex');
      sessions.set(sid, { sid, canary: makeCanary(sid, canaryFormat), score: 0 });
      res.setHeader('Set-Cookie', `__shield_sid=${sid}; Path=/; HttpOnly`);
    }
    const sess  = sessions.get(sid);
    const score = scoreRequest(req);
    sess.score  = Math.max(sess.score, score);

    // Alert on first bot hit
    if (score >= 60 && sess.score === score) {
      alertDetected({ sid: sid.slice(0,12), canary: sess.canary, score, ua: req.headers['user-agent'] || '', ip: req.ip, path: req.path });
    }

    // Intercept response to inject canary into HTML
    const _end   = res.end.bind(res);
    const _write = res.write.bind(res);
    let   buf    = '';
    let   intercepting = false;

    const checkCt = () => {
      if (!intercepting) {
        const ct = res.getHeader('content-type') || '';
        intercepting = ct.includes('text/html');
        if (intercepting) res.removeHeader('content-length');
      }
    };

    res.write = function(chunk, enc, cb) {
      checkCt();
      if (!intercepting) return _write(chunk, enc, cb);
      buf += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);
      if (typeof enc === 'function') enc();
      else if (typeof cb === 'function') cb();
      return true;
    };

    res.end = function(chunk, enc, cb) {
      checkCt();
      if (!intercepting) return _end(chunk, enc, cb);
      if (chunk) buf += Buffer.isBuffer(chunk) ? chunk.toString('utf8') : String(chunk);

      // Inject canary
      const { canary } = sess;
      const visible = score >= 60
        ? `<div style="background:#0a0a0f;border:1px solid #388bfd;padding:16px;margin:0 0 20px;border-radius:6px;font-family:monospace;color:#c9d1d9;"><div style="color:#8b949e;font-size:.7rem;margin-bottom:6px">// SESSION VERIFIED — ${new Date().toISOString()}</div><div style="color:#3fb950;font-size:1rem">${canary}</div><div style="color:#484f58;font-size:.7rem;margin-top:4px">node-auth confirmed · SHA-256 integrity OK</div></div>`
        : '';
      const hidden = `<div style="display:none" data-shield="true"><span data-value="${canary}"></span></div><script>window.__shield_token="${canary}";</script>`;

      buf = buf.replace(/(<\/head>)/i, `${hidden}\n$1`);
      buf = buf.replace(/(<body[^>]*>)/i, `$1\n${visible}`);

      _end(buf, 'utf8', cb);
    };

    poisoner(req, res, next);
  };
}

// Named exports for advanced use
shield.createBotPoisoner  = createBotPoisoner;
shield.createInjector     = createInjector;
shield.createShield       = createShield;
shield.scoreRequest       = scoreRequest;
shield.makeCanary         = makeCanary;
shield.alertDetected      = alertDetected;
shield.BOT_POISON_PROMPTS = BOT_POISON_PROMPTS;

module.exports = shield;
