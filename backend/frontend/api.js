/* Same-origin cookie authentication. No account records or credentials in localStorage. */
(() => {
  "use strict";
  let csrf = "";
  let generation = 0;
  let expectedAccount = "";
  async function request(path, options = {}) {
    if (!path.startsWith("/api/v1/"))
      throw new Error("Unsupported API destination.");
    const current = generation;
    const headers = new Headers(options.headers || {});
    headers.set("Accept", "application/json");
    if (
      expectedAccount &&
      !path.startsWith("/api/v1/auth/") &&
      path !== "/api/v1/session"
    )
      headers.set("X-Likha-Account", expectedAccount);
    if (options.method && options.method !== "GET")
      headers.set("X-CSRFToken", csrf);
    if (options.body && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
      options = { ...options, body: JSON.stringify(options.body) };
    }
    let response;
    try {
      response = await fetch(path, {
        credentials: "same-origin",
        cache: "no-store",
        signal: AbortSignal.timeout(60000),
        ...options,
        headers,
      });
    } catch {
      throw new Error(
        "The connection was interrupted or timed out. Your unsaved work is still here. Retry to check the same save.",
      );
    }
    if (current !== generation)
      throw new Error("The active account changed. Reload before continuing.");
    if (options.binary && response.ok) return response.blob();
    let result;
    try {
      result = await response.json();
    } catch {
      throw new Error(
        "The server could not complete the request. Your unsaved work is still here.",
      );
    }
    if (!response.ok) {
      const error = new Error(result.error?.message || "The request failed.");
      error.status = response.status;
      error.code = result.error?.code;
      if (response.status === 401)
        document.dispatchEvent(new CustomEvent("likha-session-expired"));
      throw error;
    }
    if (result.data?.csrf) csrf = result.data.csrf;
    return result.data;
  }
  const ready = request("/api/v1/session").then((session) => {
    expectedAccount = session.profile?.id || "";
    return session;
  });
  function clearPrivateViews() {
    generation++;
    document
      .querySelectorAll('img[src*="/api/v1/artworks/"]')
      .forEach((img) => img.removeAttribute("src"));
    document
      .querySelectorAll("canvas")
      .forEach((canvas) =>
        canvas.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height),
      );
  }
  window.LikhaAPI = { request, ready, clearPrivateViews };
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) location.reload();
  });
})();
