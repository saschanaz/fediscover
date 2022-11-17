import { login } from "https://cdn.jsdelivr.net/npm/masto@4/+esm";
import * as idbKeyval from "https://cdn.jsdelivr.net/npm/idb-keyval@6/+esm";
import html from "https://cdn.jsdelivr.net/npm/nanohtml@1/+esm";

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
  const url = new URL(`redirect.html?`, location.href);
  url.searchParams.set("rediscover-domain", domain);
  window.open(url);

  const ev = await eventFired(window, "message");
  return ev.data.code;
}

/**
 * @param {string} domain
 * @param {string} clientId
 * @param {string} clientSecret
 * @param {string} code
 * @param {string} redirectUri
 */
async function obtainToken(domain, clientId, clientSecret, code, redirectUri) {
  const url = new URL("/oauth/token", domain);
  url.searchParams.append("grant_type", "authorization_code");
  url.searchParams.append("client_id", clientId);
  url.searchParams.append("client_secret", clientSecret);
  url.searchParams.append("redirect_uri", redirectUri);
  url.searchParams.append("scope", "read write");
  url.searchParams.append("code", code);

  const res = await fetch(url, { method: "POST" });
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
 * @param {import("../third_party/masto.js").MastoClient} masto
 * @param {string} domain
 * @param {string} redirectUri
 */
export async function getOrFetchAppData(masto, domain, redirectUri) {
  try {
    return await getAppData(domain);
  // deno-lint-ignore no-empty
  } catch {}

  const created = await masto.apps.create({
    clientName: "Mizukidon",
    redirectUris: redirectUri,
    scopes: "read write",
    website: domain,
  });
  await idbKeyval.set("app", created);
  return created;
}

async function authorizeClicked() {
  async function authorize() {
    const domain = sanitizeDomain(document.getElementById("domainInput").value);
    const code = await authorizeInPopup(domain);

    const redirectUri = new URL("redirect.html", location.href).toString();
    const app = await getAppData(domain);

    const token = await obtainToken(
      domain,
      app.clientId,
      app.clientSecret,
      code,
      redirectUri
    );

    const masto = await login({ url: domain, accessToken: token.access_token });

    idbKeyval.set("accessToken", token.access_token);

    return masto;
  }

  try {
    const masto = await authorize();
    document.getElementById("authorizeForm").remove();
    return masto;
  } catch (err) {
    console.error(err);
    alert(err);
  }
}

/**
 * @param {Element} parentElement
 */
export async function maybeAuthorizeViaForm(parentElement) {
  const [app, token] = await idbKeyval.getMany(["app", "accessToken"]);
  if (app && token) {
    return await login({ url: app.website, accessToken: token });
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
