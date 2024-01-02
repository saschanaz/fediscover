import { maybeAuthorizeViaForm } from "./authorize.js";
import { Rediscover } from "./rediscover.js";
import { NoteElement } from "./ui/note.js";
import html from "https://cdn.jsdelivr.net/npm/nanohtml@1/+esm";

/** @type {Promise<import("./api/misskey.js").default>} */
export let apiReady;

/**
 * @param {Rediscover} rediscover
 * @param {Element} parentElement
 */
async function renderRandomNotes(rediscover, parentElement) {
  // clear the element
  parentElement.replaceChildren();

  for (const following of await rediscover.maybeFetchActiveFollowings()) {
    const view = new NoteElement(rediscover.api.origin, following);
    parentElement.append(view);

    // lazy rendering
    rediscover.maybeFetchRandomUnreadNoteFromUser(following.id).then((note) => {
      if (!note) {
        view.remove();
        return;
      }
      view.lang = note.data.language || "";
      view.note = note;
    });
  }
}

/**
 * @param {Rediscover} rediscover
 * @param {Element} parentElement
 */
function scrollAndRender(rediscover, container) {
  scrollTo({ top: 0, behavior: "instant" });
  renderRandomNotes(rediscover, container);
}

async function getSinceDaysAgoValue() {
  const input = html`<input type="number" value="7" />`;
  return await new Promise((resolve) => {
    const form = html`
      <div class="masto-text" style="text-align: center">
        <p>Since ${input} days ago</p>
        <button
          class="btn btn-primary"
          onclick=${() => {
            form.remove();
            resolve(input.valueAsNumber);
          }}
        >
          Read
        </button>
      </div>
    `;
    document.body.append(form);
  });
}

async function main() {
  apiReady = maybeAuthorizeViaForm(document.body);

  const api = await apiReady;
  const since = await getSinceDaysAgoValue();

  const rediscover = new Rediscover(api, { since });

  const container = html`<main class="container"></main>`;
  document.body.append(html`
    ${container}
    <div class="d-flex justify-content-center m-4">
      <button
        class="btn btn-primary"
        onclick=${() => scrollAndRender(rediscover, container)}
      >
        Read more
      </button>
    </div>
  `);

  // TODO: AbortSignal for refresh or at least disable the button until it finishes
  renderRandomNotes(rediscover, container);
}

await main();
