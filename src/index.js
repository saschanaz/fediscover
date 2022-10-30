import { maybeAuthorizeViaForm } from "./authorize.js";
import { Rediscover } from "./rediscover.js";
import html from "https://cdn.jsdelivr.net/npm/nanohtml@1/+esm";

// Note: Utimately replace this with Temporal, but we're not there yet
import moment from "https://cdn.jsdelivr.net/npm/moment@2/+esm";

/** @type {Promise<import("../third_party/masto.js").MastoClient>} */
export let mastoReady;

/**
 * @param {string} domain
 * @param {*} post
 */
function computeLocalWebUrl(domain, post) {
  return new URL(`web/@${post.account.acct}/${post.id}`, domain).toString();
}

/**
 * @param {string} domain
 * @param {*} post
 * @returns
 */
function renderPost(domain, post) {
  function renderContent() {
    if (post.spoilerText) {
      return html`<p>(CW: ${post.spoilerText})</p>`;
    }
    return document.createRange().createContextualFragment(post.content);
  }

  return html`
    ${renderContent()}
    ${post.mediaAttachments.length
      ? `(${post.mediaAttachments.length} media)`
      : ""}
    ${post.poll ? `(poll exists)` : ""}
    ${post.sensitive ? `(marked as sensitive)` : ""}
    <div>
      <a href=${computeLocalWebUrl(domain, post)} target="_blank"
        ><time datetime=${post.createdAt}
          >${moment(post.createdAt).fromNow()}</time
        ></a
      >
    </div>
  `;
}

/** @type {HTMLTemplateElement} */
const loadingIndicator = html`
  <p>
    <span class="placeholder col-7"></span>
    <span class="placeholder col-4"></span>
    <span class="placeholder col-4"></span>
    <span class="placeholder col-6"></span>
    <span class="placeholder col-8"></span>
  </p>
`;

/**
 * @param {Rediscover} rediscover
 * @param {Element} parentElement
 */
async function renderRandomPosts(rediscover, parentElement) {
  // clear the element
  parentElement.replaceChildren();

  for (const following of await rediscover.maybeFetchActiveFollowings()) {
    const indicatorClone = loadingIndicator.cloneNode(true);

    const article = html`
      <article class="card card-body">
        <h1>${following.displayName}</h1>
        ${indicatorClone}
      </article>
    `;
    parentElement.append(article);

    // lazy rendering
    rediscover.maybeFetchRandomPostFromAccount(following.id).then((post) => {
      indicatorClone.remove();
      if (!post) {
        article.remove();
        return;
      }
      article.lang = post.language || "";
      article.append(renderPost(rediscover.masto.config.url, post));
    });
  }
}

async function main() {
  mastoReady = maybeAuthorizeViaForm(document.body);

  const masto = await mastoReady;

  const rediscover = new Rediscover(masto);

  const container = html`<main class="container"></main>`;
  document.body.append(html`
    <div class="d-flex justify-content-center">
      <button
        class="btn btn-primary"
        onclick=${() => renderRandomPosts(rediscover, container)}
      >
        Refresh
      </button>
    </div>
    ${container}
  `);

  renderRandomPosts(rediscover, container);
}

await main();
