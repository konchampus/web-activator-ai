const express = require("express");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const API_BASE = "https://redeem.suppy.org/api";

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/key/:code", async (req, res) => {
  const code = String(req.params.code || "").trim();
  if (!code) {
    res.status(400).json({ message: "code is required" });
    return;
  }

  const result = await proxyRequest(`/chatgpt/keys/${encodeURIComponent(code)}`, {
    method: "GET"
  });
  res.status(result.status).json(result.body);
});

app.post("/api/activate-session", async (req, res) => {
  const code = String(req.body?.code || "").trim();
  const session = String(req.body?.session || "").trim();

  if (!code) {
    res.status(400).json({ message: "code is required" });
    return;
  }

  const result = await proxyRequest("/chatgpt/keys/activate-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, session })
  });
  res.status(result.status).json(result.body);
});

app.post("/api/activate-team", async (req, res) => {
  const code = String(req.body?.code || "").trim();
  const email = String(req.body?.email || "").trim();

  if (!code || !email) {
    res.status(400).json({ message: "code and email are required" });
    return;
  }

  const result = await proxyRequest("/chatgpt/keys/activate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ code, email })
  });
  res.status(result.status).json(result.body);
});

app.get("/api/activation-status/:code", async (req, res) => {
  const code = String(req.params.code || "").trim();
  if (!code) {
    res.status(400).json({ message: "code is required" });
    return;
  }

  const keyResult = await proxyRequest(`/chatgpt/keys/${encodeURIComponent(code)}`, {
    method: "GET"
  });

  if (keyResult.status !== 200) {
    res.status(keyResult.status).json(keyResult.body);
    return;
  }

  const keyStatus = normalizeValue(keyResult.body?.status);
  const mappedStatus =
    keyStatus === "activated"
      ? "subscription_sent"
      : keyStatus === "reserved"
        ? "account_found"
        : "started";

  res.status(200).json({
    code,
    status: mappedStatus,
    key: keyResult.body,
    activation_type: "unknown",
    source: "key_status_fallback"
  });
});

app.use((_req, res) => {
  res.status(404).json({ message: "Not found" });
});

app.listen(PORT, () => {
  console.log(`web-activator-ai started on http://localhost:${PORT}`);
});

async function proxyRequest(endpoint, options) {
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const text = await response.text();
    const parsed = safeParseJson(text);

    const statusCode = Number(response.status);

    if (parsed !== null) {
      return { status: statusCode, body: parsed };
    }

    return {
      status: statusCode,
      body: {
        message: text || "Unknown API response"
      }
    };
  } catch (error) {
    return {
      status: 502,
      body: {
        message: "Upstream API is unavailable",
        details: error instanceof Error ? error.message : String(error)
      }
    };
  }
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
