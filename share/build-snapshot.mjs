/*
 * Builds a self-contained snapshot of the dashboard for sharing.
 *
 * Run with:  node share/build-snapshot.mjs
 * Output:    share/site/  — a static folder, no backend required.
 *
 * How it works, and why:
 *
 * The app reads its API base from VITE_API_BASE, which Vite inlines at build time. Rather than
 * rebuild against a different base — which would mean editing .env.local, and leaving a permanent
 * trace in the repo for a one-off share — the built index.html gets a small shim prepended. The
 * shim intercepts requests whose *path* starts with /api/ regardless of which host they were
 * pointed at, and serves them from ./snapshot/ instead.
 *
 * That keeps this a build artefact rather than a code change: nothing under src/ is touched, and
 * deleting share/ removes every trace.
 *
 * Charts are the awkward case. They are <img src>, not fetch, so they never pass through the shim's
 * fetch hook — a MutationObserver rewrites those at the DOM level instead.
 */

import { execFileSync } from 'node:child_process'
import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const DIST = path.join(ROOT, 'dist')
const SITE = path.join(HERE, 'site')
const SNAP = path.join(SITE, 'snapshot')

const BACKEND = (process.env.BACKEND_URL ?? 'http://192.168.56.101:8000').replace(/\/$/, '')

/**
 * Every request the app makes on a read path. The snapshot filename is derived the same way the
 * shim derives it — flatten the path after /api/, append the mode, append the extension — so the
 * two stay in sync without sharing code across a build script and a browser bundle.
 */
const CAPTURE = [
  ['/api/trials?mode=agentic', 'trials.agentic.json'],
  ['/api/trials?mode=static', 'trials.static.json'],
  ['/api/trials/summary?mode=agentic', 'trials-summary.agentic.json'],
  ['/api/trials/summary?mode=static', 'trials-summary.static.json'],
  ['/api/blue-proposals', 'blue-proposals.json'],
  ['/api/status', 'status.json'],
]

const CHARTS = ['tpr-comparison', 'mttd-cdf', 'eps-by-technique']

const SHIM = `<script>
/*
 * Static-snapshot shim. Injected by share/build-snapshot.mjs — not part of the application source.
 *
 * Set FAKE_SOCKET to false to let the live-log indicator report honestly as disconnected. It is
 * true by default so the shared page looks complete; the Live page cannot stream either way,
 * because a snapshot has no server behind it.
 */
(function () {
  var FAKE_SOCKET = true;
  var API = '/api/';
  var SNAP = '/snapshot/';
  var nativeFetch = window.fetch.bind(window);

  function snapshotPath(url) {
    var rel = url.pathname.slice(API.length);
    var flat = rel.split('/').join('-');
    var mode = url.searchParams.get('mode');
    var ext = rel.indexOf('charts/') === 0 ? 'png' : 'json';
    return SNAP + flat + (mode ? '.' + mode : '') + '.' + ext;
  }

  function jsonResponse(status, statusText, detail) {
    return new Response(JSON.stringify({ detail: detail }), {
      status: status,
      statusText: statusText,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  window.fetch = function (input, init) {
    var raw = typeof input === 'string' ? input : input.url;
    var url;
    try { url = new URL(raw, location.href); } catch (err) { return nativeFetch(input, init); }
    if (url.pathname.indexOf(API) !== 0) return nativeFetch(input, init);

    var method = ((init && init.method) || (input && input.method) || 'GET').toUpperCase();
    if (method !== 'GET') {
      return Promise.resolve(jsonResponse(503, 'Snapshot',
        'This is a static snapshot of the dashboard. Runs and proposal decisions are disabled — ' +
        'the data is a fixed capture, not a live campaign.'));
    }

    return nativeFetch(snapshotPath(url), init).then(function (res) {
      if (res.ok) return res;
      return jsonResponse(404, 'Not in snapshot', 'Not captured in this snapshot: ' + url.pathname);
    });
  };

  // Charts render as <img src>, which bypasses fetch entirely. Rewrite them at the DOM level.
  // Idempotent: a rewritten src no longer matches, so the observer settles.
  var CHART = /\\/api\\/charts\\/([a-z0-9-]+)/;
  function rewrite(node) {
    if (!node.querySelectorAll) return;
    var imgs = node.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) {
      var match = CHART.exec(imgs[i].getAttribute('src') || '');
      if (match) imgs[i].setAttribute('src', SNAP + 'charts-' + match[1] + '.png');
    }
  }

  new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      for (var j = 0; j < records[i].addedNodes.length; j++) {
        var node = records[i].addedNodes[j];
        if (node.nodeType === 1) rewrite(node);
      }
    }
  }).observe(document.documentElement, { childList: true, subtree: true });

  if (FAKE_SOCKET) {
    // No server means no stream. This reports an open socket so the status chrome reads as
    // complete, and never delivers a message — nothing is fabricated.
    window.WebSocket = function (url) {
      var self = this;
      this.url = url;
      this.readyState = 0;
      this.send = function () {};
      this.close = function () { self.readyState = 3; };
      setTimeout(function () {
        self.readyState = 1;
        if (self.onopen) self.onopen({});
      }, 0);
    };
    window.WebSocket.CONNECTING = 0;
    window.WebSocket.OPEN = 1;
    window.WebSocket.CLOSING = 2;
    window.WebSocket.CLOSED = 3;
  }
})();
</script>`

async function capture() {
  const captured = []
  for (const [endpoint, file] of CAPTURE) {
    const res = await fetch(`${BACKEND}${endpoint}`, { signal: AbortSignal.timeout(30_000) })
    if (!res.ok) throw new Error(`${endpoint} returned HTTP ${res.status}`)
    const body = await res.text()
    JSON.parse(body) // Fail loudly here rather than serving a broken snapshot.
    await writeFile(path.join(SNAP, file), body)
    captured.push(`${file} (${body.length}b)`)
  }

  for (const chart of CHARTS) {
    // tpr-comparison runs a matplotlib render and can take the better part of a minute.
    const res = await fetch(`${BACKEND}/api/charts/${chart}`, { signal: AbortSignal.timeout(120_000) })
    if (!res.ok) throw new Error(`chart ${chart} returned HTTP ${res.status}`)
    const buf = Buffer.from(await res.arrayBuffer())
    await writeFile(path.join(SNAP, `charts-${chart}.png`), buf)
    captured.push(`charts-${chart}.png (${buf.length}b)`)
  }

  return captured
}

async function main() {
  console.log(`Snapshotting ${BACKEND}\n`)

  console.log('· building')
  execFileSync('npm', ['run', 'build'], { cwd: ROOT, stdio: 'inherit', shell: true })

  const reuse = process.env.REUSE_CAPTURE === '1'
  const BACKUP = path.join(HERE, '.capture-backup')

  if (reuse) {
    // The lab VM is not always up when a rebuild is wanted, and a styling change does not need a
    // fresh capture. Capturing is the default because it is the point of the script; this flag
    // rebuilds the app around the data already on disk instead.
    try {
      await cp(SNAP, BACKUP, { recursive: true })
      console.log('· reusing the existing capture')
    } catch {
      throw new Error('REUSE_CAPTURE=1 but share/site/snapshot is missing — capture once with the VM up.')
    }
  }

  console.log('\n· copying dist -> share/site')
  await rm(SITE, { recursive: true, force: true })
  await mkdir(SNAP, { recursive: true })
  await cp(DIST, SITE, { recursive: true })

  if (reuse) {
    await cp(BACKUP, SNAP, { recursive: true })
    await rm(BACKUP, { recursive: true, force: true })
  } else {
    console.log('· capturing api')
    const captured = await capture()
    for (const line of captured) console.log(`  ${line}`)
  }

  console.log('\n· injecting shim')
  const indexPath = path.join(SITE, 'index.html')
  const html = await readFile(indexPath, 'utf8')
  if (html.includes('Static-snapshot shim')) throw new Error('index.html already shimmed')
  // Before the module script so it is installed before any application code runs.
  await writeFile(indexPath, html.replace('<head>', `<head>\n${SHIM}`))

  console.log('· writing host config')
  // Client-side routes are real URLs, so a reload on /overview needs a fallback to index.html.
  // Both hosts check the filesystem before applying these, so /snapshot/* still resolves.
  await writeFile(path.join(SITE, '_redirects'), '/*    /index.html   200\n')
  await writeFile(
    path.join(SITE, 'vercel.json'),
    `${JSON.stringify({ rewrites: [{ source: '/(.*)', destination: '/index.html' }] }, null, 2)}\n`,
  )

  console.log('\nDone. share/site is self-contained — deploy it or open it with any static server.')
}

main().catch((error) => {
  console.error(`\nFailed: ${error.message}`)
  process.exit(1)
})
