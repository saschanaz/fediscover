/**
 * @template T
 * @param {T[]} arr
 * @param {number} count
 */
function pickRandom(arr, count) {
  return arr.sort(() => (Math.random() > 0.5 ? 1 : -1)).slice(0, count);
}

function isRecentUnreadPost(post, since, myAcct) {
  const target = post.reblog ?? post;

  if (target.reblogged || target.favourited || target.bookmarked) {
    // It's clear that the post is read
    return false;
  }
  if (target.account.acct === myAcct) {
    // Of course I read my own post
    return false;
  }
  return new Date(target.createdAt).valueOf() > since;
}

export class Rediscover {
  /**
   * @param {import("../third_party/masto.js").MastoClient} masto
   * @param {object} [options]
   * @param {number} [options.since]
   */
  constructor(masto, { since } = {}) {
    this.masto = masto;
    this.followers = null;
    this.myself = null;

    // since previous week by default
    this.since = since ?? new Date().valueOf() - 7 * 24 * 60 * 60 * 1000;
    this.postCache = new Map();
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
  fetchPostsFromAccount(id) {
    // masto.js's getStatusesIterable cannot pass parameters as it tries sending them as a body in a GET request.
    return this.masto.accounts.http.get(
      `/api/v1/accounts/${id}/statuses?exclude_replies=true`
    );
  }

  /**
   * @param {string} id
   */
  async maybeFetchRandomPostFromAccount(id) {
    const myself = await this.maybeFetchMyself();
    const posts =
      this.postCache.get(id) ?? (await this.fetchPostsFromAccount(id));
    this.postCache.set(id, posts);
    return pickRandom(
      posts.filter((v) => isRecentUnreadPost(v, this.since, myself.acct)),
      1
    )[0];
  }
}
