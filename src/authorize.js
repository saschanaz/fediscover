import { login as mastoLogin } from "https://cdn.jsdelivr.net/npm/masto@4/+esm";
import * as idbKeyval from "https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm";
import html from "https://cdn.jsdelivr.net/npm/nanohtml@1/+esm";

import { login } from "./api/index.js";

const SCOPES = [
  "read:statuses", // Mastodon post read scope (free in Misskey)
  "read:accounts", // Mastodon account scope
  "read:account", // Misskey account scope
].join(" ");

/**
 * @param {EventTarget} target
 * @param {string} eventName
 */
function eventFired(target, eventName) {
  return new Promise((resolve) => {
    target.addEventListener(
      eventName,
      (ev) => {
        resolve(ev);
      },
      { once: true }
    );
  });
}

/**
 * @param {string} domain
 */
async function authorizeInPopup(domain) {
  const url = new URL(`redirect/`, location.href);
  url.searchParams.set("rediscover-domain", domain);
  url.searchParams.set("rediscover-scopes", SCOPES);
  window.open(url);

  const ev = await eventFired(window, "message");
  return ev.data;
}

/**
 * @param {object} args
 * @param {string} args.endpoint
 * @param {string} args.clientId
 * @param {string} args.clientSecret
 * @param {string} args.code
 * @param {string} args.redirectUri
 * @param {string} args.codeVerifier
 * @param {string} args.scope
 */
async function obtainToken({
  endpoint,
  clientId,
  clientSecret,
  code,
  redirectUri,
  codeVerifier,
  scope,
}) {
  const res = await fetch(endpoint, {
    method: "POST",
    body: JSON.stringify({
      grant_type: "authorization_code",
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      scope,
      code: code,
      code_verifier: codeVerifier,
    }),
    headers: {
      "Content-Type": "application/json"
    }
  });
  const json = await res.json();
  return json;
}

/**
 * @param {string} domain
 */
function sanitizeDomain(domain) {
  domain = `https://${domain}`;
  if (new URL(domain).origin !== domain) {
    throw new Error("Invalid domain URL");
  }
  return domain;
}

/** @param {string} domain */
async function getAppData(domain) {
  const app = await idbKeyval.get("app");
  if (app.website !== domain) {
    throw new Error("Data doesn't match the domain");
  }
  return app;
}

/**
 * @param {string} domain
 * @param {string} redirectUri
 * @param {string[]} scopes
 */
export async function getOrFetchAppData(domain, redirectUri, scopes, nodeInfo) {
  try {
    return await getAppData(domain);
    // deno-lint-ignore no-empty
  } catch {}

  if (
    nodeInfo?.software.name === "misskey" ||
    scopes.includes("read:account")
  ) {
    const app = {
      clientId: new URL("..", location.href).toString(),
      website: domain,
    };
    await idbKeyval.set("app", app);
    return app;
  }

  const masto = await mastoLogin({ url: domain });
  const created = await masto.apps.create({
    clientName: "MastoRediscover",
    redirectUris: redirectUri,
    scopes: scopes.join(" "),
    website: domain,
  });
  await idbKeyval.set("app", created);
  return created;
}

async function authorizeClicked() {
  async function authorize() {
    const domain = sanitizeDomain(document.getElementById("domainInput").value);
    const data = await authorizeInPopup(domain);

    const redirectUri = new URL("redirect/", location.href).toString();
    const app = await getAppData(domain);

    const token = await obtainToken({
      endpoint: data.tokenEndpoint,
      clientId: app.clientId,
      clientSecret: app.clientSecret,
      code: data.code,
      codeVerifier: data.codeVerifier,
      scope: data.scope,
      redirectUri,
    });

    const api = await login({ app, accessToken: token.access_token });

    idbKeyval.set("accessToken", token.access_token);

    return api;
  }

  try {
    const masto = await authorize();
    document.getElementById("authorizeForm").remove();
    return masto;
  } catch (err) {
    console.error(err);
    alert(err);
    throw err;
  }
}

/**
 * @param {Element} parentElement
 */
export async function maybeAuthorizeViaForm(parentElement) {
  async function migrate() {
    const [app, token] = await idbKeyval.getMany(["app", "accessToken"]);
    await idbKeyval.setMany([
      ["mastoRediscoverApp", app],
      ["mastoRediscoverAccessToken", token],
    ]);
    await idbKeyval.delMany(["app", "accessToken"]);
  }

  await migrate();

  const [app, token] = await idbKeyval.getMany(["mastoRediscoverApp", "mastoRediscoverAccessToken"]);
  if (app && token) {
    return await login({ app, accessToken: token });
  }
  return await new Promise((resolve) => {
    parentElement.append(html`
      <div id="authorizeForm" class="container input-group">
        <span class="input-group-text">Domain</span>
        <input
          id="domainInput"
          aria-label="Domain"
          class="form-control"
          placeholder="example.com"
        />
        <button
          class="btn btn-primary"
          type="button"
          onclick=${() => authorizeClicked().then(resolve)}
        >
          Authorize
        </button>
      </div>
    `);
  });
}
