import { resolve } from "$app/paths";

const API_URL = "https://commons.wikimedia.org/w/api.php";
const REST_URL = "https://commons.wikimedia.org/w/rest.php";
const TOKEN_STORAGE_KEY = "climbhub.commons.token";
const FLOW_STORAGE_KEY = "climbhub.commons.oauth";
const CLIENT_ID = "e776566ba980892324adfc092f191dc0";

type CommonsToken = { access_token: string; expires_at: number };

function randomValue() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function readToken(): CommonsToken | undefined {
  const raw = sessionStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) return;
  try {
    const token = JSON.parse(raw) as CommonsToken;
    if (token.expires_at <= Date.now() + 30_000) {
      sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      return;
    }
    return token;
  } catch {
    sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}

export function getCommonsAccessToken() {
  return readToken()?.access_token;
}

export function logoutCommons() {
  sessionStorage.removeItem(TOKEN_STORAGE_KEY);
}

export async function startCommonsLogin() {
  if (!CLIENT_ID) throw new Error("Wikimedia upload is not configured for this deployment.");

  const verifier = randomValue();
  const challengeBytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(challengeBytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
  const state = randomValue();
  const redirectUri = new URL(resolve("/commons-oauth"), window.location.origin).toString();

  sessionStorage.setItem(
    FLOW_STORAGE_KEY,
    JSON.stringify({ state, verifier, redirectUri, returnTo: window.location.href }),
  );

  const authorization = new URL(`${REST_URL}/oauth2/authorize`);
  authorization.search = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
  }).toString();
  window.location.assign(authorization);
}

export async function completeCommonsLogin(search: string): Promise<string> {
  const params = new URLSearchParams(search);
  const oauthError = params.get("error_description") ?? params.get("error");
  if (oauthError) throw new Error(`Wikimedia sign-in failed: ${oauthError}`);

  const flow = sessionStorage.getItem(FLOW_STORAGE_KEY);
  if (!flow) throw new Error("The Wikimedia sign-in session expired. Please try again.");
  sessionStorage.removeItem(FLOW_STORAGE_KEY);

  const { state, verifier, redirectUri, returnTo } = JSON.parse(flow) as {
    state: string;
    verifier: string;
    redirectUri: string;
    returnTo: string;
  };
  if (!params.get("code") || params.get("state") !== state) {
    throw new Error("Wikimedia sign-in could not be verified. Please try again.");
  }

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: CLIENT_ID,
    code: params.get("code")!,
    code_verifier: verifier,
    redirect_uri: redirectUri,
  });
  const response = await fetch(`${REST_URL}/oauth2/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const result = (await response.json()) as { access_token?: string; expires_in?: number; error?: string };
  if (!response.ok || !result.access_token) {
    throw new Error(result.error ?? "Wikimedia did not return an access token.");
  }

  sessionStorage.setItem(
    TOKEN_STORAGE_KEY,
    JSON.stringify({ access_token: result.access_token, expires_at: Date.now() + (result.expires_in ?? 3600) * 1000 }),
  );
  const returnUrl = new URL(returnTo, window.location.origin);
  return returnUrl.origin === window.location.origin ? returnUrl.toString() : resolve("/");
}

export async function getCommonsUsername(accessToken: string) {
  const response = await fetch(`${REST_URL}/oauth2/resource/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error("Could not verify the Wikimedia account.");
  const profile = (await response.json()) as { username?: string };
  return profile.username;
}

export async function uploadCommonsFile(
  accessToken: string,
  file: File,
  metadata: { filename: string; description: string; source: string; author: string; license: string },
) {
  const headers = { Authorization: `Bearer ${accessToken}` };
  const tokenUrl = new URL(API_URL);
  tokenUrl.search = new URLSearchParams({
    action: "query",
    meta: "tokens",
    format: "json",
    origin: "*",
  }).toString();
  const tokenResponse = await fetch(tokenUrl, { headers });
  const tokenData = (await tokenResponse.json()) as {
    query?: { tokens?: { csrftoken?: string } };
    error?: { info?: string };
  };
  const csrfToken = tokenData.query?.tokens?.csrftoken;
  if (!tokenResponse.ok || !csrfToken) {
    throw new Error(tokenData.error?.info ?? "Could not get a Wikimedia upload token.");
  }

  const form = new FormData();
  form.set("action", "upload");
  form.set("format", "json");
  form.set("filename", metadata.filename);
  form.set("comment", "Uploaded from Climbhub");
  form.set(
    "text",
    [
      "{{Information",
      `|description=${escapeTemplateValue(metadata.description)}`,
      `|source=${escapeTemplateValue(metadata.source)}`,
      `|author=${escapeTemplateValue(metadata.author)}`,
      `|date=${new Date().toISOString().slice(0, 10)}`,
      "}}",
      `{{${metadata.license}}}`,
    ].join("\n"),
  );
  form.set("token", csrfToken);
  form.set("file", file, metadata.filename);

  const response = await fetch(`${API_URL}?origin=*`, { method: "POST", headers, body: form });
  const data = (await response.json()) as {
    upload?: { result?: string; filename?: string; warnings?: Record<string, string> };
    error?: { info?: string };
  };
  if (!response.ok || data.error) throw new Error(data.error?.info ?? "The Wikimedia upload failed.");
  if (data.upload?.result !== "Success" || !data.upload.filename) {
    const warning = Object.values(data.upload?.warnings ?? {})[0];
    throw new Error(warning ?? "Wikimedia did not confirm the upload.");
  }
  return `File:${data.upload.filename}`;
}

function escapeTemplateValue(value: string) {
  return value.replaceAll("\r", " ").replaceAll("\n", " ").replaceAll("|", "{{!}}").replaceAll("}", "&#125;");
}
