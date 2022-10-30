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

/**
 * @param {string} domain
 * @param {*} post
 */
function computeLocalWebUrl(domain, post) {
  return new URL(`web/@${post.account.acct}/${post.id}`, domain).toString();
}

export class PostView extends HTMLElement {
  #indicator = loadingIndicator.cloneNode(true);

  /**
   * @param {*} following
   */
  constructor(following) {
    super();
    this.attachShadow({ mode: "open" });
    this.shadowRoot.append(
      html`<link
        href="https://cdn.jsdelivr.net/npm/bootstrap@5/dist/css/bootstrap.min.css"
        rel="stylesheet"
        crossorigin="anonymous"
      />`,
      html`<h1>${following.displayName}</h1>`,
      this.#indicator
    );
  }

  /**
   * @param {string} domain
   * @param {*} post
   * @returns
   */
  renderPost(domain, post) {
    function renderContent() {
      if (post.spoilerText) {
        return html`<p>(CW: ${post.spoilerText})</p>`;
      }
      return document.createRange().createContextualFragment(post.content);
    }

    const newChild = html`
      ${renderContent()}
      ${post.mediaAttachments.length
        ? `(${post.mediaAttachments.length} media)`
        : ""}
      ${post.poll ? `(poll exists)` : ""}
      ${post.sensitive ? `(marked as sensitive)` : ""}
      <div>
        <a href=${computeLocalWebUrl(domain, post)} target="_blank"
          ><time datetime=${post.createdAt}
            >${moment(post.createdAt).fromNow()}</time
          ></a
        >
      </div>
    `;
    this.shadowRoot.replaceChild(newChild, this.#indicator);
  }
}
