import html from "https://cdn.jsdelivr.net/npm/nanohtml@1/+esm";

export class MediaElement extends HTMLElement {
  file;

  get file() {
    return this.file;
  }

  constructor(file) {
    super();

    this.file = file;

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
            overflow: hidden;
            padding: 0;
            border: 0;
            background-color: transparent;
          }
          dialog::backdrop {
            background-color: #80808080;
            backdrop-filter: blur(2px);
          }
          dialog img {
            object-fit: contain;
          }
        </style>
        <img
          id="img"
          loading="lazy"
          src="${file.thumbnailUrl}"
          alt="${file.comment}"
          title="${file.comment}"
        />
        <dialog id="dialog">
          <img
            loading="lazy"
            src="${file.url}"
            alt="${file.comment}"
            title="${file.comment}"
          />
        </dialog>
      `
    );

    /** @type {HTMLDialogElement} */
    const dialog = this.shadowRoot.getElementById("dialog");
    this.shadowRoot.getElementById("img").addEventListener("click", () => {
      // TODO: support others
      if (file.type.startsWith("image/")) {
        dialog.showModal();
      }
    });
    dialog.addEventListener("click", () => {
      dialog.close();
    });
  }
}

customElements.define("masto-media", MediaElement);
