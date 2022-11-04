import html from "https://cdn.jsdelivr.net/npm/nanohtml@1/+esm";

// Note: Ultimately replace this with Temporal, but we're not there yet
import moment from "https://cdn.jsdelivr.net/npm/moment@2/+esm";

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
      display: block flow-root;
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
  </style>
`;

/**
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

export class PostElement extends HTMLElement {
  /** @type {HTMLParagraphElement} */
  #indicator = loadingIndicator.cloneNode(true);
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
        <p class="user-box">
          <img id="user-image" />
          <div class="user-name-and-acct">
            <strong id="user-name"></strong>
            <div id="user-acct"></div>
          </div>
        </p>
      `,
      this.#indicator
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
      const content = document
        .createRange()
        .createContextualFragment(target.content);
      for (const mention of content.querySelectorAll(".u-url.mention")) {
        const { acct } = target.mentions.find((m) =>
          [m.acct, m.username].includes(
            mention.querySelector("span").textContent
          )
        );
        mention.href = computeLocalAcctUrl(this.domain, acct);
      }
      for (const hashtag of content.querySelectorAll(".mention.hashtag")) {
        const { url } = target.tags.find(
          (m) =>
            m.name === hashtag.querySelector("span").textContent.toLowerCase()
        );
        hashtag.href = url;
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
          ><i
            >Boosted ${moment(post.createdAt).fromNow()} by
            ${post.account.displayName || post.account.username}</i
          ></a
        >
      `);
    };

    const renderUserInfo = () => {
      this.shadowRoot.getElementById("user-image").src =
        target.account.avatarStatic;
      this.shadowRoot.getElementById("user-name").textContent =
        target.account.displayName || target.account.username;
      this.shadowRoot
        .getElementById("user-acct")
        .replaceChildren(
          html`<a
            href="${computeLocalAcctUrl(this.domain, target.account.acct)}"
            class="chrome-link"
            >@${target.account.acct}</a
          >`
        );
    };

    this.#post = post;

    maybeRenderReblogInfo();

    const target = post.reblog ?? post;
    renderUserInfo();
    const newChild = html`
      ${renderContent()}
      ${target.mediaAttachments.length
        ? `(${target.mediaAttachments.length} media)`
        : ""}
      ${target.poll ? `(poll exists)` : ""}
      ${target.sensitive ? `(marked as sensitive)` : ""}
      <p>
        <a
          class="chrome-link"
          href=${computeLocalPostUrl(this.domain, target)}
          target="_blank"
          ><time datetime=${target.createdAt}
            >${moment(target.createdAt).fromNow()}</time
          ></a
        >
      </p>
    `;
    this.shadowRoot.replaceChild(newChild, this.#indicator);
  }
}

customElements.define("masto-post", PostElement);
