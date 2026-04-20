#!/usr/bin/env node
/**
 * cyberdeck-shield CLI
 *
 * Usage:
 *   npx cyberdeck-shield --target http://localhost:3000
 *   npx cyberdeck-shield --target http://localhost:3000 --port 8888
 *   npx cyberdeck-shield --target http://localhost:3000 --canary creds --debug
 */

const { createShield } = require('../lib/shield');

const args = process.argv.slice(2);

function getArg(flag, fallback) {
  const i = args.indexOf(flag);
  return i !== -1 && args[i + 1] ? args[i + 1] : fallback;
}

function hasFlag(flag) {
  return args.includes(flag);
}

if (hasFlag('--help') || hasFlag('-h') || args.length === 0) {
  console.log(`
\x1b[36mcyberdeck-shield\x1b[0m — AI scraper defense reverse proxy

\x1b[1mUsage:\x1b[0m
  npx cyberdeck-shield --target <url> [options]

\x1b[1mOptions:\x1b[0m
  --target  <url>     Upstream URL to protect (required)
  --port    <number>  Proxy port (default: 8888)
  --secret  <string>  HMAC secret for canary signing (auto-generated if omitted)
  --canary  <format>  Canary format: ctf | creds | custom:<template> (default: ctf)
  --debug             Enable request logging
  --help              Show this help

\x1b[1mExamples:\x1b[0m
  npx cyberdeck-shield --target http://localhost:3000
  npx cyberdeck-shield --target http://localhost:3000 --port 9000 --canary creds
  npx cyberdeck-shield --target http://localhost:3000 --debug

\x1b[1mAdmin panel:\x1b[0m
  http://localhost:<port>/__shield__
`);
  process.exit(0);
}

const target = getArg('--target', process.env.TARGET);

if (!target) {
  console.error('\x1b[31m[cyberdeck-shield] Error: --target is required\x1b[0m');
  console.error('  Example: npx cyberdeck-shield --target http://localhost:3000');
  process.exit(1);
}

createShield({
  target,
  port:         parseInt(getArg('--port', process.env.PORT || '8888'), 10),
  secret:       getArg('--secret', process.env.SHIELD_SECRET),
  canaryFormat: getArg('--canary', process.env.CANARY_FORMAT || 'ctf'),
  debug:        hasFlag('--debug') || process.env.DEBUG === '1',
});
