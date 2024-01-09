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
    this.since = new Date().valueOf() - (since ?? 7) * 24 * 60 * 60 * 1000;
    // user to notes map
    this.noteCache = new Map();
    this.shownNotes = new Set();
    // Users with no unread notes
    this.drainedUsers = new Set();
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

  async maybeFetchActiveFollowings({ max = 10 } = {}) {
    const followingsAll = await this.maybeFetchAllFollowings();
    return pickRandom(
      followingsAll.filter(
        (f) => new Date(f.updatedAt).valueOf() > this.since && !this.drainedUsers.has(f.id)
      ),
      max
    );
  }

  /**
   * @param {string} id
   */
  async maybeFetchRandomUnreadNoteFromUser(id) {
    const myself = this.api.me;
    const notes =
      this.noteCache.get(id) ?? (await this.api.notes(id));
    this.noteCache.set(id, notes);
    const picked = pickRandom(
      notes.filter((n) => !this.shownNotes.has(n.renote?.localUrl ?? n.localUrl) && isRecentUnreadNote(n, this.since, myself.id)),
      1
    )[0];
    if (picked) {
      this.shownNotes.add(picked.renote?.localUrl ?? picked.localUrl);
    } else {
      this.drainedUsers.add(id);
    }
    return picked;
  }
}
