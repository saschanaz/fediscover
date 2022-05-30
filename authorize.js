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
 * @param {string} clientId
 * @param {string} redirectUri
 */
async function authorizeInPopup(domain, clientId, redirectUri) {
  const url = new URL("/oauth/authorize", domain);
  url.searchParams.append("response_type", "code");
  url.searchParams.append("client_id", clientId);
  url.searchParams.append("redirect_uri", redirectUri);
  url.searchParams.append("scope", "read write");
  url.searchParams.append("force_login", "true");
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

/**
 * @param {import("./third_party/masto.js").MastoClient} masto
 * @param {string} domain
 * @param {string} redirectUri
 */
async function getAppData(masto, domain, redirectUri) {
  const app = await idbKeyval.get("app");
  if (app?.website === domain) {
    return app;
  }

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

    const masto = await login({ url: domain });

    const redirectUri = new URL("redirect.html", location.href).toString();
    const app = await getAppData(masto, domain, redirectUri);

    const code = await authorizeInPopup(domain, app.clientId, redirectUri);

    const token = await obtainToken(
      domain,
      app.clientId,
      app.clientSecret,
      code,
      redirectUri
    );

    masto.config.accessToken = token.access_token;

    idbKeyval.set("accessToken", token.access_token);

    return masto;
  }

  while (true) {
    try {
      await authorize();
      document.getElementById("authorizeForm").remove();
      return;
    } catch (err) {
      console.error(err);
      alert(err);
    }
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
      <div id="authorizeForm">
        <label
          >Domain: <input id="domainInput" placeholder="example.com"
        /></label>
        <button onclick=${() => authorizeClicked().then(resolve)}>
          Authorize
        </button>
      </div>
    `);
  });
}
