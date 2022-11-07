import html from "https://cdn.jsdelivr.net/npm/nanohtml@1/+esm";

export class MediaElement extends HTMLElement {
  #attachment;

  get attachment() {
    return this.#attachment;
  }

  constructor(attachment) {
    super();

    this.#attachment = attachment;

    this.attachShadow({ mode: "open" });
    this.shadowRoot.append(
      html`
        <style>
          :host {
            display: inline-block;
          }
          img {
            width: 100%;
            height: 100%;
            object-fit: cover;
          }
          dialog {
            height: 100%;
            overflow:hidden;
            padding: 0;
            border: 0;
            background-color: transparent;
          }
          dialog img {
            object-fit: contain;
          }
        </style>
        <img
          id="img"
          loading="lazy"
          src="${attachment.previewUrl}"
          alt="${attachment.description}"
          title="${attachment.description}"
        />
        <dialog id="dialog">
          <img
            loading="lazy"
            src="${attachment.url}"
            alt="${attachment.description}"
            title="${attachment.description}"
          />
        </dialog>
      `
    );

    /** @type {HTMLDialogElement} */
    const dialog = this.shadowRoot.getElementById("dialog");
    this.shadowRoot.getElementById("img").addEventListener("click", () => {
      // TODO: support others
      if (attachment.type === "image") {
        dialog.showModal();
      }
    });
    dialog.addEventListener("click", () => {
      dialog.close();
    })
  }
}

customElements.define("masto-media", MediaElement);
