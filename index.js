import { maybeAuthorizeViaForm } from "./authorize.js";
import { Rediscover } from "./rediscover.js";
import html from "https://cdn.jsdelivr.net/npm/nanohtml@1/+esm";

/** @type {Promise<import("./third_party/masto.js").MastoClient>} */
export let mastoReady;

/**
 * @param {string} domain
 * @param {*} post
 */
function computeLocalWebUrl(domain, post) {
  return new URL(`web/@${post.account.acct}/${post.id}`, domain).toString();
}

function renderPost(domain, post) {
  return html`
    ${document.createRange().createContextualFragment(post.content)}
    <div>
      <a href=${computeLocalWebUrl(domain, post)} target="_blank"
        ><time datetime=${post.createdAt}>${new Date(post.createdAt)}</time></a
      >
    </div>
  `;
}

/**
 * @param {Rediscover} rediscover
 * @param {Element} parentElement
 */
async function renderRandomPosts(rediscover, parentElement) {
  // clear the element
  parentElement.replaceChildren();

  for (const following of await rediscover.maybeFetchActiveFollowings()) {
    const article = html`
      <article>
        <h1>${following.displayName}</h1>
      </article>
    `;
    parentElement.append(article);

    // lazy rendering
    rediscover.fetchRandomPostFromAccount(following.id).then((post) => {
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

  const container = document.createElement("div");
  document.body.append(html`
    <button onclick=${() => renderRandomPosts(rediscover, container)}>
      Refresh
    </button>
    ${container}
  `);

  renderRandomPosts(rediscover, container);
}

await main();
