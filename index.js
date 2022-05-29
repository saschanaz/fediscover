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

async function main() {
  mastoReady = maybeAuthorizeViaForm(document.body);

  const masto = await mastoReady;

  const rediscover = new Rediscover(masto);
  for (const following of await rediscover.maybeFetchActiveFollowings()) {
    const article = html`
      <article>
        <h1>${following.displayName}</h1>
      </article>
    `;
    document.body.append(article);

    // lazy rendering
    rediscover.fetchRandomPostFromAccount(following.id).then((post) => {
      if (!post) {
        return;
      }
      article.lang = post.language || "";
      article.append(renderPost(masto.config.url, post));
    });
  }
}

await main();
