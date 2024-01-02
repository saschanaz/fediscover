// Covers only a few APIs that this project uses:
// 1. My account info (/i)
// 2. Followings (/users/following)
// 3. Statuses of any accounts (/users/show)

export default class MisskeyApi {
  #origin;
  #accessToken;
  #me;

  /**
   * @param {object} args
   * @param {string} args.origin
   * @param {string} args.accessToken
   */
  constructor({ origin, accessToken }) {
    this.#origin = origin;
    this.#accessToken = accessToken;
  }

  get origin() {
    return this.#origin;
  }

  get me() {
    return this.#me;
  }

  async #api(path, options = {}) {
    const response = await fetch(new URL(path, new URL("/api/", this.#origin)), {
      method: "post",
      headers: {
        Authorization: `Bearer ${this.#accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(options)
    });

    return await response.json();
  }

  /**
   * @param {object} args
   * @param {string} args.origin
   * @param {string} args.accessToken
   */
  static async login(args) {
    const misskey = new MisskeyApi(args);
    misskey.#me = await misskey.#api("i");
    return misskey;
  }

  async followings(untilId) {
    return await this.#api("users/following", {
      limit: 100,
      userId: this.#me.id,
      untilId,
    });
  }

  async allFollowings() {
    let untilId;
    const result = [];
    while (true) {
      const followings = await this.followings(untilId)
      if (!followings.length) {
        break;
      }
      untilId = followings.at(-1).id;
      result.push(...followings.map(f => f.followee));
    }
    return result;
  }

  async notes(userId) {
    const notes = await this.#api("users/notes", {
      userId,
      withRenotes: true,
      withReplies: false,
    });
    return notes.map(n => new MisskeyNote(this.origin, n));
  }
}

// TODO: mfm...
class MisskeyNote {
  #origin;
  #note;
  constructor(origin, note) {
    this.#origin = origin;
    this.#note = note;
  }

  get data() {
    return this.#note;
  }

  get localUrl() {
    return new URL(`notes/${this.#note.id}`, this.#origin).toString();
  }

  get localUserUrl() {
    return new URL(this.atUser, this.#origin).toString();
  }

  get atUser() {
    const { username, host } = this.#note.user;
    if (!host) {
      return `@${username}`
    }
    return `@${username}@${host}`
  }

  get renote() {
    const { renote } = this.#note;
    if (!renote) {
      return undefined;
    }
    return new MisskeyNote(this.#origin, renote);
  }
}
