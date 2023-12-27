import { default as Mastodon } from "./mastodon.js"
import { default as Misskey } from "./misskey.js"

/**
 * @param {object} args
 * @param {*} args.app
 * @param {string} args.accessToken
 */
export async function login({ app, accessToken }) {
  if (app.clientSecret) {
    return await Mastodon.login({ origin: app.website, accessToken })
  }
  return await Misskey.login({ origin: app.website, accessToken })
}
