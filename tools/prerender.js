/* Bakes each built page into static Arabic HTML.
 *
 *   node tools/prerender.js        (run after tools/build.js)
 *
 * Two things were invisible to a crawler that only reads the served bytes:
 *
 *   1. The Arabic copy. Every string ships twice — English as the element's
 *      text and Arabic in a data-ar attribute — and a script swaps them on
 *      load. So the document Google fetched was English markup labelled
 *      lang="ar", and the Arabic, the language this site is trying to rank
 *      in, sat in attributes where it counts as nothing.
 *
 *   2. The catalog. All 100-plus features, the sector bundles and the FAQ are
 *      built by script into empty containers, so the shipped HTML held none
 *      of that text.
 *
 * Rendering each page in headless Chrome and serialising the resulting DOM
 * fixes both at once. The scripts stay in the output and simply re-apply the
 * same state on load, so behaviour is unchanged and the English toggle still
 * works.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const http = require('http');
// execFile, not execFileSync: the static server below lives in this same
// process, so a synchronous child would block the event loop and the server
// could never answer Chrome's request — the two would just deadlock.
const execFile = require('util').promisify(require('child_process').execFile);

const ROOT = path.resolve(__dirname, '..');
const PORT = 8731;
const ROUTES = ['/', '/apps/', '/film/', '/catalog/', '/brief/'];

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find((p) => fs.existsSync(p));
if (!CHROME) { console.error('no Chrome or Edge found'); process.exit(1); }

const TYPES = { '.html': 'text/html; charset=utf-8', '.png': 'image/png', '.xml': 'application/xml', '.txt': 'text/plain; charset=utf-8' };

/* Served over HTTP rather than file:// so that absolute paths, localStorage
   and the fonts all behave exactly as they will in production. */
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file)) { res.writeHead(404); return res.end('not found'); }
  res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
  res.end(fs.readFileSync(file));
});

server.listen(PORT, async () => {
  let ok = 0;
  for (const route of ROUTES) {
    const out = path.join(ROOT, route.slice(1), 'index.html');
    const was = fs.readFileSync(out, 'utf8');

    const { stdout: dom } = await execFile(CHROME, [
      '--headless=new', '--disable-gpu', '--hide-scrollbars',
      // long enough for the webfonts and every render pass to settle
      '--virtual-time-budget=6000',
      '--dump-dom', `http://127.0.0.1:${PORT}${route}?prerender=1`,
    ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

    if (!/<\/html>/i.test(dom) || dom.length < was.length * 0.5) {
      console.error(`  ${route} — render looks truncated (${dom.length} bytes), keeping the shell`);
      continue;
    }

    // --dump-dom drops the doctype; without it the page renders in quirks mode
    const html = /^<!doctype/i.test(dom.trim()) ? dom : '<!doctype html>\n' + dom;
    fs.writeFileSync(out, html);

    const delta = html.length - was.length;
    console.log(`  ${route.padEnd(11)} ${String(was.length).padStart(7)} -> ${String(html.length).padStart(7)} bytes  (${delta >= 0 ? '+' : ''}${delta})`);
    ok++;
  }
  server.close();
  console.log(`\nprerendered ${ok}/${ROUTES.length} pages`);
  if (ok !== ROUTES.length) process.exit(1);
});
