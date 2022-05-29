import { maybeAuthorizeViaForm } from "./authorize.js";
import { Rediscover } from "./rediscover.js";
import html from "https://cdn.jsdelivr.net/npm/nanohtml@1/+esm";

/** @type {Promise<import("./third_party/masto.js").MastoClient>} */
export let mastoReady;

async function main() {
  mastoReady = maybeAuthorizeViaForm(document.body);

  const masto = await mastoReady;

  const rediscover = new Rediscover(masto);
  for await (const post of rediscover.fetchRecentRandomPosts()) {
    document.body.append(html`
      <article>
        <h1>${post.account.displayName}</h1>
        ${document.createRange().createContextualFragment(post.content)}
      </article>
    `);
  }
}

await main();
