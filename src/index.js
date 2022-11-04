import { maybeAuthorizeViaForm } from "./authorize.js";
import { Rediscover } from "./rediscover.js";
import { PostElement } from "./ui/post.js";
import html from "https://cdn.jsdelivr.net/npm/nanohtml@1/+esm";

/** @type {Promise<import("../third_party/masto.js").MastoClient>} */
export let mastoReady;


/**
 * @param {Rediscover} rediscover
 * @param {Element} parentElement
 */
async function renderRandomPosts(rediscover, parentElement) {
  // clear the element
  parentElement.replaceChildren();

  for (const following of await rediscover.maybeFetchActiveFollowings()) {
    const view = new PostElement(rediscover.masto.config.url, following);
    parentElement.append(view);

    // lazy rendering
    rediscover.maybeFetchRandomPostFromAccount(following.id).then((post) => {
      if (!post) {
        view.remove();
        return;
      }
      view.lang = post.language || "";
      view.post = post;
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

  // TODO: AbortSignal for refresh or at least disable the button until it finishes
  renderRandomPosts(rediscover, container);
}

await main();
