import html from "https://cdn.jsdelivr.net/npm/nanohtml@1/+esm";

// Note: Ultimately replace this with Temporal, but we're not there yet
import moment from "https://cdn.jsdelivr.net/npm/moment@2/+esm";

/** @type {HTMLTemplateElement} */
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
      /* Reverts bootstrap .invisible */
      visibility: revert !important;
    }
    .ellipsis::after {
      content: "…";
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
    this.shadowRoot.append(
      html`<link
        href="https://cdn.jsdelivr.net/npm/bootstrap@5/dist/css/bootstrap.min.css"
        rel="stylesheet"
        crossorigin="anonymous"
      />`,
      style.cloneNode(true),
      html`<h1>${following.displayName || following.username}</h1>`,
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
