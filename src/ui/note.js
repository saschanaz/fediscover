import html from "https://cdn.jsdelivr.net/npm/nanohtml@1/+esm";
import DOMPurify from "https://cdn.jsdelivr.net/npm/dompurify@2/+esm";

// Note: Ultimately replace this with Temporal, but we're not there yet
import moment from "https://cdn.jsdelivr.net/npm/moment@2/+esm";

import { MediaElement } from "./image.js";

/** @type {HTMLParagraphElement} */
const loadingIndicator = html`
  <p>
    <span class="placeholder col-7"></span>
    <span class="placeholder col-4"></span>
    <span class="placeholder col-4"></span>
    <span class="placeholder col-6"></span>
    <span class="placeholder col-8"></span>
  </p>
`;

/** @type {HTMLStyleElement} */
const style = html`
  <style>
    :host {
      display: flow-root;
      padding: 0 1rem;
      background-color: #eee;
      border-radius: 0.375rem;
    }

    .placeholder {
      display: inline-block;
      min-height: 1em;
      vertical-align: middle;
      cursor: wait;
      background-color: currentcolor;
      opacity: 0.5;
    }
    .col-4 {
      width: 33.33333333%;
    }
    .col-6 {
      width: 50%;
    }
    .col-7 {
      width: 58.33333333%;
    }
    .col-8 {
      width: 66.66666667%;
    }

    .invisible {
      font-size: 0;
      line-height: 0;
      display: inline-block;
      width: 0;
      height: 0;
    }
    .ellipsis::after {
      content: "…";
    }

    .chrome-link {
      opacity: 0.6;
      color: unset;
    }

    .user-box {
      display: flex;
      align-items: center;
      margin: 1em 0;
    }
    #user-image {
      width: 48px;
      height: 48px;
      margin-right: 6px;
      box-sizing: border-box;
      border-radius: 4px;
    }
    .user-name-and-acct {
      overflow: hidden;
    }
    #user-acct {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    #contents {
      overflow-wrap: break-word;
    }

    #media:not(:empty) {
      display: flex;
      margin: 1em 0;
      gap: 12px;
    }
    #media masto-media {
      width: 96px;
      height: 96px;
    }
    masto-media[sensitive] {
      filter: blur(5px);
    }

    .emoji {
      height: 1.2em;
      vertical-align: text-bottom;
    }
  </style>
`;

/**
 * @param {string} domain
 * @param {string} acct
 */
function computeLocalAcctUrl(domain, acct) {
  return new URL(`@${acct}`, domain).toString();
}

/**
 * @param {string} str
 * @param {*} emojis
 */
function matchAllEmojis(str, emojis) {
  if (!emojis) {
    return [];
  }
  const result = [];
  for (const [shortcode, url] of Object.entries(emojis)) {
    for (const match of str.matchAll(`:${shortcode}:`)) {
      result.push({
        start: match.index,
        end: match.index + match[0].length,
        emoji: {
          shortcode,
          url
        },
      });
    }
  }
  return result.sort((x, y) => x.start - y.start);
}

/**
 * @param {string} str
 * @param {*} emojis
 */
function renderEmojis(str, emojis) {
  const matches = matchAllEmojis(str, emojis);
  let lastMatchEnd = 0;

  const nodes = [];
  for (const match of matches) {
    const shortcode = `:${match.emoji.shortcode}:`;
    nodes.push(new Text(str.slice(lastMatchEnd, match.start)));
    nodes.push(
      html`
        <img
          class="emoji"
          src="${match.emoji.url}"
          alt="${shortcode}"
          title="${shortcode}"
        />
      `
    );
    lastMatchEnd = match.end;
  }
  nodes.push(new Text(str.slice(lastMatchEnd)));

  return nodes;
}

/**
 * @param {string} str
 * @param {*} emojis
 */
function replaceEmojis(str, emojis) {
  if (!str) {
    return "";
  }
  return renderEmojis(str, emojis)
    .map((node) => node.outerHTML || node.textContent)
    .join("");
}

export class NoteElement extends HTMLElement {
  #note;

  /**
   * @param {string} domain
   */
  constructor(domain) {
    super();
    this.domain = domain;
    this.attachShadow({ mode: "open" });
    this.#initializeTree();
  }

  #initializeTree() {
    this.shadowRoot.append(
      style.cloneNode(true),
      html`
        <p id="renote-info"></p>
        <div class="user-box">
          <img id="user-image" />
          <div class="user-name-and-acct">
            <strong id="user-name"></strong>
            <div id="user-acct"></div>
          </div>
        </div>
        <div id="contents">${loadingIndicator.cloneNode(true)}</div>
        <div id="media"></div>
        <p>
          <a id="timestamp-anchor" class="chrome-link" target="_blank"
            ><time id="timestamp-time"></time
          ></a>
        </p>
      `
    );
  }

  get note() {
    return this.#note;
  }

  /**
   * @param {*} note
   * @returns
   */
  set note(note) {
    const renderContent = () => {
      const replaced = replaceEmojis(target.data.text, target.data.emojis);
      const content = document
        .createRange()
        .createContextualFragment(DOMPurify.sanitize(replaced));
      for (const anchor of content.querySelectorAll("a")) {
        anchor.target = "_blank";

        if (anchor.matches(".u-url.mention")) {
          const { acct } = target.data.mentions.find((m) =>
            [m.acct, m.username].includes(anchor.textContent.slice(1))
          );
          anchor.href = computeLocalAcctUrl(this.domain, acct);
          continue;
        }
        if (anchor.matches(".mention.hashtag")) {
          // Each instance can normalize hashtags as it wants.
          // As it's a moving target, here we ignore `status.tags` and simply put tags/{tag},
          // which will then be normalized by the instance automatically.
          // See also https://github.com/mastodon/mastodon/pull/18795.
          const tag = anchor.querySelector("span").textContent;
          anchor.href = new URL(`/web/tags/${tag}`, this.domain).toString();
          continue;
        }
      }

      if (!target.data.cw) {
        return content;
      }

      return html`
        <details>
          <summary>${target.data.cw}</summary>
          ${content}
        </details>
      `;
    };

    const maybeRenderRenoteInfo = () => {
      if (!note.renote) {
        return;
      }
      this.shadowRoot.getElementById("renote-info").replaceChildren(html`
        <a
          class="chrome-link"
          href="${note.localUserUrl}"
          target="_blank"
          ><i
            >Renoted ${moment(note.data.createdAt).fromNow()} by
            ${renderEmojis(
              note.data.user.name || note.data.user.username,
              note.data.user.emojis
            )}</i
          ></a
        >
      `);
    };

    const renderUserInfo = () => {
      this.shadowRoot.getElementById("user-image").src =
        target.data.user.avatarUrl;
      this.shadowRoot
        .getElementById("user-name")
        .replaceChildren(
          ...renderEmojis(
            target.data.user.name || target.data.user.username,
            target.data.user.emojis
          )
        );
      this.shadowRoot
        .getElementById("user-acct")
        .replaceChildren(
          html`<a
            href="${target.localUserUrl}"
            class="chrome-link"
            target="_blank"
            >${target.atUser}</a
          >`
        );
    };

    const renderMedia = () => {
      for (const file of target.data.files.filter(f => f.type.startsWith("image/"))) {
        const element = new MediaElement(file)
        if (file.isSensitive) {
          element.setAttribute("sensitive", "");
        }
        this.shadowRoot
          .getElementById("media")
          .append(element);
      }
    };

    this.#note = note;

    maybeRenderRenoteInfo();

    // TODO: support quote
    const target = note.renote ?? note;
    renderUserInfo();

    const newChild = html`
      ${renderContent()} ${target.poll ? `(poll exists)` : ""}
      ${target.card ? `(card exists)` : ""}
      ${note.renote && note.text ? `(quote text exists)` : ""}
      ${target.sensitive ? `(marked as sensitive)` : ""}
    `;
    this.shadowRoot.getElementById("contents").replaceChildren(newChild);

    renderMedia();

    this.shadowRoot.getElementById("timestamp-anchor").href = target.localUrl;
    this.shadowRoot.getElementById("timestamp-time").textContent = moment(
      target.data.createdAt
    ).fromNow();
  }
}

customElements.define("masto-note", NoteElement);
