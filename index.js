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

async function main() {
  mastoReady = maybeAuthorizeViaForm(document.body);

  const masto = await mastoReady;

  const rediscover = new Rediscover(masto);
  for await (const post of rediscover.fetchRecentRandomPosts()) {
    document.body.append(html`
      <article lang=${post.language || ""}>
        <h1>${post.account.displayName}</h1>
        ${document.createRange().createContextualFragment(post.content)}
        <div>
          <a href=${computeLocalWebUrl(masto.config.url, post)} target="_blank"
            ><time datetime=${post.createdAt}
              >${new Date(post.createdAt)}</time
            ></a
          >
        </div>
      </article>
    `);
  }
}

await main();
