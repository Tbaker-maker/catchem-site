// POST_OFFICE is off unless the worker env is exactly "on".
// Unset, blank, "off", and anything else keep the tools closed.
export const POST_OFFICE_LINE = "We're rebuilding this. Email and social tools are coming back better.";

export const CLOSED_BETA_COPY = "Email and social tools, rebuilt. Closed beta.";

const CLOSED_NAV = '<a class="po-beta-link" href="/post-office" data-po="closed">Post Office <span class="po-beta">Closed Beta</span></a>';
const OPEN_NAV = '<a href="/post-office">Post Office</a>';

const CLOSED_TILE = `    <article class="tile post" id="po-beta-tile">
      <div class="ttl">
        <h3>Post Office</h3>
        <span class="po-beta">Closed Beta</span>
      </div>
      <p>${CLOSED_BETA_COPY}</p>
      <a class="more" href="/post-office">Post Office <span aria-hidden="true">→</span></a>
    </article>`;

const OPEN_TILE = `    <article class="tile post">
      <span class="tag open">Open</span>
      <h3>Post Office</h3>
      <p>Every card and every artist. Pick one and the post is ready for X or Facebook.</p>
      <a class="more" href="/post-office">Post Office <span aria-hidden="true">→</span></a>
    </article>`;

export function postOfficeOn(env) {
  return String(env?.POST_OFFICE || "").trim().toLowerCase() === "on";
}

// The baked home page is the closed beta. Flag on restores the old link and tile.
export function paintHomePostOffice(html, on) {
  const src = String(html || "");
  if (!on) return src;
  return src.split(CLOSED_NAV).join(OPEN_NAV).split(CLOSED_TILE).join(OPEN_TILE);
}
