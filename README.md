# catchem-site

catchemtcg.com. The root is the Catch'em waitlist (`index.html`).

## How it deploys

This repo is connected to Cloudflare Workers Builds for the `catchem-site`
Worker. Every push to `main` runs `npx wrangler deploy`, which first runs
`scripts/build.mjs` (see `wrangler.jsonc`):

1. clones `Tbaker-maker/catchem-app`
2. runs its `scripts/build-public-site.mjs` with this repo's `index.html` as the root
3. copies the result to `./site-public` and checks nothing is missing

So `/build`, `/creators`, `/faq`, `/methodology`, `/corrections`, `/pulse`,
`/board`, `/p/*`, `/sets/*` and the sitemap ship with every deploy of the root.
An assets deploy replaces every file, so never deploy `index.html` on its own.

Manual deploy: `node scripts/build.mjs && npx wrangler deploy`

## Files

- `index.html`: the waitlist page. Self-contained (inline CSS/JS, Google Fonts).
- `og.png.b64`: the 1200×630 social image as base64 text; the build writes `og.png`.
- `favicon.svg`: fanned card outlines (also inlined in `index.html`).

## Waitlist form

Posts to Formspree form `xgorlypa` (the same form the previous landing used),
in place via fetch, with a plain POST fallback. Hidden field
`source=landing-2026-09` tags signups from this page. Signups land in the
Formspree dashboard for that form.
