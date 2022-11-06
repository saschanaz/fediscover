import html from "https://cdn.jsdelivr.net/npm/nanohtml@1/+esm";

export class MediaElement extends HTMLElement {
  #attachment;

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
        </style>
        <img id="img" loading="lazy" src="${attachment.previewUrl}" />
        <dialog id="dialog">
          <img loading="lazy" src="${attachment.url}" />
        </dialog>
      `
    );

    /** @type {HTMLDialogElement} */
    const dialog = this.shadowRoot.getElementById("dialog");
    this.shadowRoot.getElementById("img").addEventListener("click", () => {
      dialog.showModal();
    });
    dialog.addEventListener("click", () => {
      dialog.close();
    })
  }
}

customElements.define("masto-media", MediaElement);
