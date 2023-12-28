/**
 * @template T
 * @param {T[]} arr
 * @param {number} count
 */
function pickRandom(arr, count) {
  return arr.sort(() => (Math.random() > 0.5 ? 1 : -1)).slice(0, count);
}

function isRecentUnreadNote(note, since, myId) {
  const { data: target } = note.renote ?? note;

  if (target.reblogged || target.myReaction || target.bookmarked) {
    // It's clear that the post is read
    return false;
  }
  if (target.userId === myId) {
    // Of course I read my own post
    return false;
  }
  return new Date(target.createdAt).valueOf() > since;
}

export class Rediscover {
  /**
   * @param {import("./api/misskey.js").default} api
   * @param {object} [options]
   * @param {number} [options.since]
   */
  constructor(api, { since } = {}) {
    this.api = api;
    this.followers = null;
    this.myself = null;

    // since previous week by default
    this.since = since ?? new Date().valueOf() - 7 * 24 * 60 * 60 * 1000;
    this.postCache = new Map();
  }

  async fetchAllFollowings() {
    this.followers = await this.api.allFollowings();
    return this.followers;
  }

  async maybeFetchAllFollowings() {
    if (this.followers) {
      return this.followers;
    }
    return await this.fetchAllFollowings();
  }

  async maybeFetchActiveFollowings({ max = 40 } = {}) {
    const followingsAll = await this.maybeFetchAllFollowings();
    return pickRandom(
      followingsAll.filter(
        (f) => new Date(f.updatedAt).valueOf() > this.since
      ),
      max
    );
  }

  /**
   * @param {string} id
   */
  async maybeFetchRandomNoteFromUser(id) {
    const myself = this.api.me;
    const posts =
      this.postCache.get(id) ?? (await this.api.notes(id));
    this.postCache.set(id, posts);
    return pickRandom(
      posts.filter((v) => isRecentUnreadNote(v, this.since, myself.id)),
      1
    )[0];
  }
}
