// Covers only a few APIs that this project uses:
// 1. My account info (/api/v1/accounts/verify_credentials)
// 2. Followings (/api/v1/accounts/:id/following)
// 3. Statuses of any accounts (/api/v1/accounts/:id/statuses)

import { login } from "https://cdn.jsdelivr.net/npm/masto@4/+esm";

export default class MastodonApi {
  #masto;
  #me;

  /**
   * @param {object} args
   * @param {*} args.masto
   */
  constructor({ masto }) {
    this.#masto = masto;
  }

  get origin() {
    return this.#masto.config.url;
  }

  get me() {
    return this.#me;
  }

  /**
   * @param {object} args
   * @param {string} args.origin
   * @param {string} args.accessToken
   */
  static async login(args) {
    const masto = await login({ url: args.origin, accessToken: args.accessToken });
    return new MastodonApi({ masto });
  }

  async allFollowings() {
    const result = [];
    for await (const followers of this.masto.accounts.getFollowingIterable(
      account.id,
      { limit: 80 }
    )) {
      result.push(...followers);
    }
    return result;
  }

  async notes() {
    const notes = await this.masto.accounts.http.get(
      `/api/v1/accounts/${id}/statuses?exclude_replies=true`
    );
    return notes.map(n => new MastodonNote(this.origin, n));
  }
}

class MastodonNote {
  #origin;
  #rawNote;
  #note;
  constructor(note) {
    this.#origin = origin;
    this.#rawNote = note;
    this.#note = this.#remap(note);
  }

  #remap(note) {
    return {
      summary: note.spoilerText,
      emojis: Object.fromEntries(note.emojis.map(e => [e.shortcode, e.staticUrl])),
      myReaction: note.favourited ? "♥️" : null,
      reblogged: note.reblogged,
      bookmarked: note.bookmarked,
      userId: note.user.id,
      text: note.content,
    }
  }

  get data() {
    return this.#note;
  }

  get localUrl() {
    return new URL(`@${this.#rawNote.account.acct}/${this.#rawNote.id}`, this.#origin).toString();
  }

  get localUserUrl() {
    return new URL(`@${this.#rawNote.account.acct}/`, this.#origin).toString();
  }

  get renote() {
    const { reblog } = this.#rawNote;
    if (!reblog) {
      return undefined;
    }
    return new MastodonNote(this.#origin, reblog);
  }
}
