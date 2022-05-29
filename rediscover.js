/**
 * @template T
 * @param {T[]} arr
 * @param {number} count
 */
function pickRandom(arr, count) {
  return arr.sort(() => (Math.random() > 0.5 ? 1 : -1)).slice(0, count);
}

function isRecentUnreadStandalonePost(post, since) {
  if (post.inReplyToId && post.mentions.length > 0) {
    // A part of conversation
    return false;
  }
  if (post.reblog) {
    return false;
  }
  if (post.reblogged || post.favourited || post.bookmarked) {
    // It's clear that the post is read
    return false;
  }
  return new Date(post.createdAt).valueOf() > since;
}

export class Rediscover {
  /**
   * @param {import("./third_party/masto.js").MastoClient} masto
   * @param {object} [options]
   * @param {number} [options.since]
   */
  constructor(masto, { since } = {}) {
    this.masto = masto;
    this.followers = null;
    this.myself = null;

    // since previous week by default
    this.since = since ?? new Date().valueOf() - 7 * 24 * 60 * 60 * 1000;
  }

  async maybeFetchMyself() {
    if (this.myself) {
      return this.myself;
    }
    const result = await this.masto.accounts.verifyCredentials();
    this.myself = result;
    return result;
  }

  async fetchAllFollowings() {
    const account = await this.maybeFetchMyself();
    const result = [];
    for await (const followers of this.masto.accounts.getFollowingIterable(
      account.id,
      { limit: 80 }
    )) {
      result.push(...followers);
    }
    this.followers = result;
    return result;
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
        (f) => new Date(f.lastStatusAt).valueOf() > this.since
      ),
      max
    );
  }

  /**
   * @param {string} id
   */
  async fetchRandomPostFromAccount(id) {
    const { value } = await this.masto.accounts.getStatusesIterable(id).next();
    const status = pickRandom(
      value.filter((v) => isRecentUnreadStandalonePost(v, this.since)),
      1
    )[0];
    return status;
  }
}
