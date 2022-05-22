import { login } from "./third_party/masto.js";

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

async function authorizeInPopup(clientId, redirectUri) {
  const url = new URL("https://qdon.space/oauth/authorize");
  url.searchParams.append("response_type", "code");
  url.searchParams.append("client_id", clientId);
  url.searchParams.append("redirect_uri", redirectUri);
  url.searchParams.append("scope", "read write");
  url.searchParams.append("force_login", "true");
  window.open(url);

  const ev = await eventFired(window, "message");
  return ev.data.code;
}

async function obtainToken(clientId, clientSecret, code, redirectUri) {
  const url = new URL("https://qdon.space/oauth/token");
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

globalThis.authorize = async () => {
  const masto = await login({
    url: "https://qdon.space",
  });

  const redirectUri = new URL("redirect.html", location.href).toString();
  const app = await masto.apps.create({
    clientName: "Mizukidon",
    redirectUris: redirectUri,
    scopes: "read write",
    website: "https://qdon.space",
  });

  const code = await authorizeInPopup(app.clientId, redirectUri);

  const token = await obtainToken(
    app.clientId,
    app.clientSecret,
    code,
    redirectUri
  );

  masto.config.accessToken = token.access_token;

  masto.statuses.create({
    status: "Hello, world!",
  });
};
