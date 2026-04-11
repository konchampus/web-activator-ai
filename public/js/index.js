const form = document.getElementById("code-form");
const codeInput = document.getElementById("code");
const messageEl = document.getElementById("message");

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const code = codeInput.value.trim();
  if (!code) {
    setMessage("Activation code is required.", "error");
    return;
  }

  setMessage("Checking activation code...", "info");
  setLoading(true);

  try {
    const response = await fetch(`/api/key/${encodeURIComponent(code)}`);
    const data = await response.json();

    if (!response.ok) {
      setMessage(readApiMessage(data, "Unable to validate code."), "error");
      return;
    }

    const keyStatus = normalizeValue(data.status);
    if (keyStatus !== "available") {
      setMessage(
        `Code status is "${data.status}". Only "available" codes can be activated.`,
        "error"
      );
      return;
    }

    sessionStorage.setItem("activation:code", code);
    sessionStorage.setItem("activation:keyinfo", JSON.stringify(data));
    window.location.href = "/activate.html";
  } catch (error) {
    setMessage(
      error instanceof Error ? error.message : "Request failed. Try again.",
      "error"
    );
  } finally {
    setLoading(false);
  }
});

function setLoading(isLoading) {
  codeInput.disabled = isLoading;
  form.querySelector("button").disabled = isLoading;
}

function setMessage(text, type) {
  messageEl.textContent = text;
  messageEl.className = `message ${type}`;
}

function readApiMessage(payload, fallback) {
  if (!payload) return fallback;
  if (typeof payload === "string") return payload;
  if (typeof payload.message === "string") return payload.message;
  if (typeof payload.error === "string") return payload.error;
  return fallback;
}

function normalizeValue(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}
