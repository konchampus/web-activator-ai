const form = document.getElementById("activation-form");
const valueInput = document.getElementById("value-input");
const valueLabel = document.getElementById("value-label");
const messageEl = document.getElementById("message");
const serviceBadge = document.getElementById("service-badge");
const hintEl = document.getElementById("hint");
const instructionsEl = document.getElementById("instructions");

const code = sessionStorage.getItem("activation:code");
const keyInfoRaw = sessionStorage.getItem("activation:keyinfo");
let keyInfo = keyInfoRaw ? safeParseJson(keyInfoRaw) : null;
let pollTimer = null;
let attempts = 0;
const MAX_ATTEMPTS = 45;

if (!code) {
  window.location.href = "/";
} else {
  init().catch((error) => {
    setMessage(
      error instanceof Error ? error.message : "Failed to initialize activation page.",
      "error"
    );
  });
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const value = valueInput.value.trim();
  if (!value) {
    setMessage("This field is required.", "error");
    return;
  }

  setLoading(true);
  setMessage("Sending activation request...", "info");

  try {
    if (normalizeValue(keyInfo?.key_type) === "team") {
      const response = await fetch("/api/activate-team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, email: value })
      });
      const data = await response.json();
      if (!response.ok) {
        setMessage(mapError(readApiMessage(data, "Team activation failed.")), "error");
        return;
      }

      setMessage("Activation completed successfully.", "success");
      sessionStorage.removeItem("activation:keyinfo");
      return;
    }

    const response = await fetch("/api/activate-session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, session: value })
    });
    const data = await response.json();

    if (!response.ok) {
      setMessage(
        mapError(readApiMessage(data, "Session activation failed.")),
        "error"
      );
      return;
    }

    setMessage("Activation started. Waiting for final status...", "info");
    startPolling();
  } catch (error) {
    setMessage(
      error instanceof Error ? error.message : "Request failed. Try again.",
      "error"
    );
  } finally {
    setLoading(false);
  }
});

async function init() {
  if (!keyInfo) {
    const response = await fetch(`/api/key/${encodeURIComponent(code)}`);
    const data = await response.json();
    if (!response.ok) {
      throw new Error(readApiMessage(data, "Unable to load key info."));
    }
    keyInfo = data;
  }

  if (normalizeValue(keyInfo?.status) !== "available") {
    setMessage(
      `Code status is "${keyInfo.status}". Use a code with "available" status.`,
      "error"
    );
    setLoading(true);
    return;
  }

  applyKeyMeta();
}

function applyKeyMeta() {
  const service = normalizeValue(keyInfo?.service) || "unknown";
  const keyType = normalizeValue(keyInfo?.key_type) || "personal";
  const plan = keyInfo?.plan || "subscription";
  const term = keyInfo?.term || "";

  serviceBadge.textContent = `Step 2 of 2 - ${service.toUpperCase()} - ${keyType}`;
  hintEl.textContent = `Code: ${code} - Plan: ${plan}${term ? ` (${term})` : ""}`;

  if (keyType === "team") {
    valueLabel.textContent = "Email";
    valueInput.placeholder = "user@example.com";
    valueInput.rows = 3;
    instructionsEl.innerHTML = `
      <p>This is a team key activation.</p>
      <p>Enter your email address and click Activate.</p>
    `;
    return;
  }

  if (service === "claude") {
    valueLabel.textContent = "Claude sessionKey";
    valueInput.placeholder = "sk-ant-sid01-...";
    instructionsEl.innerHTML = `
      <p>Service: Claude.</p>
      <p>Paste your <b>sessionKey</b> value from claude.ai cookies.</p>
    `;
    return;
  }

  valueLabel.textContent = "ChatGPT session JSON";
  valueInput.placeholder = '{"accessToken":"...","user":{"id":"..."}}';
  instructionsEl.innerHTML = `
    <p>Service: ChatGPT.</p>
    <p>Open <b>chatgpt.com/api/auth/session</b> while logged in and copy the JSON response.</p>
    <p>Paste the full JSON into the field and click Activate.</p>
  `;
}

function startPolling() {
  clearPolling();
  attempts = 0;

  const run = async () => {
    attempts += 1;

    try {
      const response = await fetch(`/api/key/${encodeURIComponent(code)}`);
      const data = await response.json();
      const keyStatus = normalizeValue(data?.status);

      if (response.ok) {
        if (keyStatus === "activated") {
          setMessage("Subscription activated successfully.", "success");
          clearPolling();
          sessionStorage.removeItem("activation:keyinfo");
          return;
        }

        if (keyStatus !== "available" && keyStatus !== "reserved") {
          setMessage(
            `Activation state: ${keyStatus || "unknown"}.`,
            "error"
          );
        }

        setMessage(
          `Activation in progress: ${humanizeStatus(keyStatus)} (${attempts}/${MAX_ATTEMPTS})`,
          "info"
        );
      } else {
        setMessage(
          mapError(readApiMessage(data, "Failed to check key status.")),
          "error"
        );
        clearPolling();
        return;
      }
    } catch {
      setMessage("Temporary network issue while checking status...", "error");
      clearPolling();
      return;
    }

    if (attempts >= MAX_ATTEMPTS) {
      clearPolling();
      setMessage(
        "Activation is taking too long. Please retry status check in a minute.",
        "error"
      );
    }
  };

  run();
  pollTimer = setInterval(run, 4000);
}

function clearPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function setLoading(isLoading) {
  valueInput.disabled = isLoading;
  form.querySelector("button").disabled = isLoading;
}

function setMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
}

function mapError(rawMessage) {
  const message = String(rawMessage || "").trim();
  const normalized = normalizeValue(message);

  const dict = {
    "session is required": "Session/token is required.",
    "session must be valid json": "Session must be valid JSON for ChatGPT keys.",
    no_access_token: "ChatGPT session JSON must contain accessToken.",
    workspace_account: "Workspace account is not supported for this activation.",
    session_expired: "Session has expired. Please refresh and try again.",
    session_invalid: "Invalid session data.",
    session_check_failed: "Session validation failed. Try again later.",
    "key not found": "Activation code was not found.",
    "key already activated": "This code is already activated.",
    invalid_email: "Invalid email format.",
    "email is required": "Email is required."
  };

  if (dict[normalized]) return dict[normalized];
  if (dict[message]) return dict[message];

  return message || "Unknown API error.";
}

function readApiMessage(payload, fallback) {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.error === "string") return payload.error;
  if (normalizeValue(payload.status) === "error" && typeof payload.message === "string") {
    return payload.message;
  }
  return fallback;
}

function humanizeStatus(status) {
  const normalized = normalizeValue(status);
  const dict = {
    available: "started",
    reserved: "account found",
    activated: "subscription sent"
  };
  return dict[normalized] || normalized || "pending";
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}
