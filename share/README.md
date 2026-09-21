# Shareable snapshot

A self-contained copy of the dashboard with the campaign data baked in. No backend, no VM, no
network beyond the host serving these files.

**Live at** <https://threat-emulation-snapshot.vercel.app>

Use that stable alias for sharing, not the per-deployment `...-<hash>-...vercel.app` URL that the
CLI prints — the hash changes on every deploy, so a link to one goes stale.

Built from a live capture taken 2026-09-21:

| | trials | techniques | detection |
|---|---|---|---|
| Agentic | 166 | 6 | 66.9% |
| Static baseline | 165 | 6 | 77.0% |

## Using it

`site/` is the whole thing. Any static host will do.

**Netlify** — drag the `site` folder onto <https://app.netlify.com/drop>. It respects `_redirects`
and gives you a URL in a few seconds. No account needed for the drop.

**Vercel** — `npx vercel deploy site --prod`. `vercel.json` handles the route fallback.

**Locally** — `node share/serve.mjs` then open <http://localhost:4173>.

Do not open `index.html` off the filesystem: the build uses absolute `/assets/...` paths, so
`file://` will load a blank page. Use a server.

Both `_redirects` and `vercel.json` rewrite unknown paths to `index.html`, because the client
router uses real URLs — a reload on `/overview` would otherwise 404. Both hosts check for an
existing file first, so `/snapshot/*` is served normally rather than being swallowed.

## What works, and what does not

Everything that reads data works on the real captured figures: Overview, Trials, Techniques,
Compare, Detection Gaps, Blue Agent, Pipeline Health, Reports and Methodology.

Three things cannot, because a snapshot has no server behind it:

- **Live** shows no log stream and no batch control.
- **Run batch / blue analysis** are refused with a message rather than failing silently.
- **Proposal approve/reject** on Blue Agent is likewise refused.

The status chrome reports the log stream as connected. That is deliberate — see `FAKE_SOCKET` in
the shim inside `site/index.html`. Set it to `false` to have the indicator report honestly as
disconnected instead.

## Rebuilding

```
node share/build-snapshot.mjs
```

Runs the production build, copies `dist/` into `site/`, re-captures every endpoint from the
backend on the lab VM, and injects the shim. Override the backend with `BACKEND_URL=...`.

If the VM is down but only the frontend changed, pass `REUSE_CAPTURE=1` to rebuild around the data
already in `site/snapshot/` instead of re-fetching. Then redeploy:

```
npx vercel deploy share/site --prod --yes --name threat-emulation-snapshot --scope akifali-1s-projects
```

## How it works

The app inlines its API base at build time, so the snapshot does not fight that: the built
`index.html` gets a small shim prepended which intercepts anything whose path starts with `/api/`
and serves it from `snapshot/` instead.

That keeps this a build artefact rather than a code change — nothing under `src/` is touched, and
deleting this directory removes every trace.

Charts are `<img src>`, not fetch, so they never pass through the fetch hook; a `MutationObserver`
rewrites those at the DOM level.

`site/` is generated and git-ignored — rebuild it rather than committing it. The scripts here are
checked in so the live deployment stays reproducible: run `build-snapshot.mjs` against a fresh
capture and redeploy to update it.
