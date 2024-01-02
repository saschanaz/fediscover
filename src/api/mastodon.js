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
   * @param {*} args.me
   */
  constructor({ masto, me }) {
    this.#masto = masto;
    this.#me = me;
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
    const me = await masto.accounts.verifyCredentials();
    return new MastodonApi({ masto, me });
  }

  async allFollowings() {
    const result = [];
    for await (const followers of this.#masto.accounts.getFollowingIterable(
      this.#me.id,
      { limit: 80 }
    )) {
      result.push(...followers);
    }
    return result.map(remapUser);
  }

  async notes(userId) {
    const notes = await this.#masto.accounts.http.get(
      `/api/v1/accounts/${userId}/statuses?exclude_replies=true`
    );
    return notes.map(n => new MastodonNote(this.origin, n));
  }
}

function remapEmojis(emojis) {
  return Object.fromEntries(emojis.map(e => [e.shortcode, e.staticUrl]))
}

function remapUser(user) {
  return {
    id: user.id,
    updatedAt: user.lastStatusAt,
    name: user.displayName,
    username: user.username,
    emojis: remapEmojis(user.emojis),
    avatarUrl: user.avatarStatic,
  }
}

function remapNote(note) {
  return {
    cw: note.spoilerText,
    emojis: remapEmojis(note.emojis),
    myReaction: note.favourited ? "♥️" : null,
    reblogged: note.reblogged,
    bookmarked: note.bookmarked,
    userId: note.account.id,
    text: note.content,
    createdAt: note.createdAt,
    language: note.language,
    user: remapUser(note.account),
    files: note.mediaAttachments.map(attachment => ({
      type: `${attachment.type}/${attachment.url.match(/\.\w+/)[0]}`,
      isSensitive: note.sensitive,
      thumbnailUrl: attachment.previewUrl,
      comment: attachment.description,
      url: attachment.url,
    })),
    mentions: note.mentions,
  }
}

class MastodonNote {
  #origin;
  #rawNote;
  #note;
  constructor(origin, note) {
    this.#origin = origin;
    this.#rawNote = note;
    this.#note = remapNote(note);
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

  get atUser() {
    return `@${this.#rawNote.account.acct}`
  }

  get renote() {
    const { reblog } = this.#rawNote;
    if (!reblog) {
      return undefined;
    }
    return new MastodonNote(this.#origin, reblog);
  }
}
