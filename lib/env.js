/**
 * Minimal .env loader — no dotenv dependency required.
 * Reads key=value pairs from .env in the project root.
 */

const fs   = require('fs');
const path = require('path');

const envPath = path.resolve(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach(line => {
      const m = line.match(/^\s*([^#][^=]*?)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    });
}
