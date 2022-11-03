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

    .user-box {
      display: flex;
    }
    .user-image {
      width: 48px;
      height: 48px;
      margin-right: 6px;
      box-sizing: border-box;
      border-radius: 4px;
    }
    .user-name-and-acct {
      display: flex;
      flex-direction: column;
      justify-content: center;
    }
  </style>
`;

/**
 * @param {string} domain
 * @param {*} post
 */
function computeLocalWebUrl(domain, post) {
  return new URL(`web/@${post.account.acct}/${post.id}`, domain).toString();
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

  /**
   * @param {*} following
   */
  #initializeTree(following) {
    this.shadowRoot.append(
      style.cloneNode(true),
      html`
        <div class="user-box">
          <img class="user-image" src="${following.avatarStatic}" />
          <div class="user-name-and-acct">
            <strong>${following.displayName || following.username}</strong>
            <span>@${following.acct}</span>
          </div>
        </div>
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
    function renderContent() {
      if (post.spoilerText) {
        return html`<p>(CW: ${post.spoilerText})</p>`;
      }
      return document.createRange().createContextualFragment(post.content);
    }

    this.#post = post;

    const newChild = html`
      ${renderContent()}
      ${post.mediaAttachments.length
        ? `(${post.mediaAttachments.length} media)`
        : ""}
      ${post.poll ? `(poll exists)` : ""}
      ${post.sensitive ? `(marked as sensitive)` : ""}
      <div>
        <a href=${computeLocalWebUrl(this.domain, post)} target="_blank"
          ><time datetime=${post.createdAt}
            >${moment(post.createdAt).fromNow()}</time
          ></a
        >
      </div>
    `;
    this.shadowRoot.replaceChild(newChild, this.#indicator);
  }
}

customElements.define("masto-post", PostElement);
