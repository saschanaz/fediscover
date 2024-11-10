// Covers only a few APIs that this project uses:
// 1. My account info (/api/v1/accounts/verify_credentials)
// 2. Followings (/api/v1/accounts/:id/following)
// 3. Statuses of any accounts (/api/v1/accounts/:id/statuses)

import { createRestAPIClient } from "https://cdn.jsdelivr.net/npm/masto@6/+esm";

export default class MastodonApi {
  #masto;
  #me;
  #origin;
  #accessToken;

  /**
   * @param {object} args
   * @param {*} args.masto
   * @param {string} args.origin
   * @param {string} args.accessToken
   */
  constructor({ origin, accessToken }) {
    this.#masto = createRestAPIClient({ url: origin, accessToken });
    this.#origin = origin;
    this.#accessToken = accessToken;
  }

  get origin() {
    return this.#origin;
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
    const mastodon = new MastodonApi(args);
    mastodon.#me = await mastodon.#api("v1/accounts/verify_credentials", "get");
    return mastodon;
  }

  async allFollowings() {
    const result = [];
    for await (const followers of this.#masto.v1.accounts.$select(this.#me.id).following.list(
      { limit: 80 }
    )) {
      result.push(...followers);
    }
    return result.map(remapUser);
  }

  #createRequest(path, method, options = {}) {
    const url = new URL(path, new URL("/api/", this.#origin));
    for (const [key, value] of Object.entries(options)) {
      url.searchParams.set(key, value);
    }
    return new Request(url, {
      method,
      headers: {
        Authorization: `Bearer ${this.#accessToken}`,
        "Content-Type": "application/json",
      }
    });
  }

  async #api(path, method, options = {}) {
    const response = await fetch(this.#createRequest(path, method, options));
    return await response.json();
  }

  async notes(userId) {
    const notes = await this.#api(`v1/accounts/${userId}/statuses`, "get", {
      exclude_replies: true
    });
    return notes.map(n => new MastodonNote(this.#origin, n));
  }
}

function remapEmojis(emojis) {
  return Object.fromEntries(emojis.map(e => [e.shortcode, e.static_url]))
}

function remapUser(user) {
  return {
    id: user.id,
    updatedAt: user.last_status_at || user.lastStatusAt,
    name: user.display_name,
    username: user.username,
    emojis: remapEmojis(user.emojis),
    avatarUrl: user.avatar_static,
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
    createdAt: note.created_at,
    language: note.language,
    user: remapUser(note.account),
    files: note.media_attachments.map(attachment => ({
      type: `${attachment.type}/${attachment.url.match(/\.\w+/)[0]}`,
      isSensitive: note.sensitive,
      thumbnailUrl: attachment.preview_url,
      comment: attachment.description,
      url: attachment.url,
    })),
    mentions: note.mentions,
    id: note.id,
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
