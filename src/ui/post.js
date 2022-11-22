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
      background-color: white;
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
    .sensitive masto-media {
      filter: blur(5px);
    }

    .emoji {
      width: 1.2em;
      height: 1.2em;
      vertical-align: text-bottom;
    }
  </style>
`;

/**
 * TODO: Mastodon 4.0 is removing /web prefix.
 * https://github.com/mastodon/mastodon/pull/19319
 * For now they will maintain the redirection,
 * and we also need to keep it for backward compatibility.
 *
 * @param {string} domain
 * @param {*} post
 */
function computeLocalPostUrl(domain, post) {
  return new URL(`web/@${post.account.acct}/${post.id}`, domain).toString();
}

/**
 * @param {string} domain
 * @param {string} acct
 */
function computeLocalAcctUrl(domain, acct) {
  return new URL(`web/@${acct}`, domain).toString();
}

/**
 * @param {string} str
 * @param {*} emojis
 */
function matchAllEmojis(str, emojis) {
  const result = [];
  for (const emoji of emojis) {
    for (const match of str.matchAll(`:${emoji.shortcode}:`)) {
      result.push({
        start: match.index,
        end: match.index + match[0].length,
        emoji,
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
          src="${match.emoji.staticUrl}"
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
  return renderEmojis(str, emojis)
    .map((node) => node.outerHTML || node.textContent)
    .join("");
}

export class PostElement extends HTMLElement {
  #post;

  /**
   * @param {string} domain
   * @param {*} following
   */
  constructor(domain, following) {
    super();
    this.domain = domain;
    this.attachShadow({ mode: "open" });
    this.#initializeTree(following);
  }

  #initializeTree() {
    this.shadowRoot.append(
      style.cloneNode(true),
      html`
        <p id="reblog-info"></p>
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

  get post() {
    return this.#post;
  }

  /**
   * @param {*} post
   * @returns
   */
  set post(post) {
    const renderContent = () => {
      const replaced = replaceEmojis(target.content, target.emojis);
      const content = document
        .createRange()
        .createContextualFragment(DOMPurify.sanitize(replaced));
      for (const anchor of content.querySelectorAll("a")) {
        anchor.target = "_blank";

        if (anchor.matches(".u-url.mention")) {
          const { acct } = target.mentions.find((m) =>
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

      if (!target.spoilerText) {
        return content;
      }

      return html`
        <details>
          <summary>${target.spoilerText}</summary>
          ${content}
        </details>
      `;
    };

    const maybeRenderReblogInfo = () => {
      if (!post.reblog) {
        return;
      }
      this.shadowRoot.getElementById("reblog-info").replaceChildren(html`
        <a
          class="chrome-link"
          href="${computeLocalAcctUrl(this.domain, post.account.acct)}"
          target="_blank"
          ><i
            >Boosted ${moment(post.createdAt).fromNow()} by
            ${renderEmojis(
              post.account.displayName || post.account.username,
              post.account.emojis
            )}</i
          ></a
        >
      `);
    };

    const renderUserInfo = () => {
      this.shadowRoot.getElementById("user-image").src =
        target.account.avatarStatic;
      this.shadowRoot
        .getElementById("user-name")
        .replaceChildren(
          ...renderEmojis(
            target.account.displayName || target.account.username,
            target.account.emojis
          )
        );
      this.shadowRoot
        .getElementById("user-acct")
        .replaceChildren(
          html`<a
            href="${computeLocalAcctUrl(this.domain, target.account.acct)}"
            class="chrome-link"
            target="_blank"
            >@${target.account.acct}</a
          >`
        );
    };

    const renderMedia = () => {
      for (const attachment of target.mediaAttachments) {
        this.shadowRoot
          .getElementById("media")
          .append(new MediaElement(attachment));
      }
    };

    this.#post = post;

    maybeRenderReblogInfo();

    const target = post.reblog ?? post;
    renderUserInfo();

    const newChild = html`
      ${renderContent()} ${target.poll ? `(poll exists)` : ""}
      ${target.card ? `(card exists)` : ""}
      ${target.sensitive ? `(marked as sensitive)` : ""}
    `;
    this.shadowRoot.getElementById("contents").replaceChildren(newChild);

    this.shadowRoot
      .getElementById("media")
      .classList.toggle("sensitive", target.sensitive);
    renderMedia();

    this.shadowRoot.getElementById("timestamp-anchor").href =
      computeLocalPostUrl(this.domain, target);
    this.shadowRoot.getElementById("timestamp-time").textContent = moment(
      target.createdAt
    ).fromNow();
  }
}

customElements.define("masto-post", PostElement);
