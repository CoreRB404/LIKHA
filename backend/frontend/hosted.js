import { $, api, node, announce, busy } from "./ui.js";
/* Hosted controllers use only authoritative API state. Offline scripts stay in the portable build. */
(() => {
  "use strict";
  let account;
  function wireLogout() {
    document.querySelectorAll("[data-logout]").forEach((button) =>
      button.addEventListener("click", () =>
        busy(button, async () => {
          await api("/api/v1/auth/logout", { method: "POST", body: {} });
          window.LikhaAPI.clearPrivateViews();
          location.replace("/accounts/login/");
        }),
      ),
    );
  }
  function safeNext() {
    const next = new URLSearchParams(location.search).get("next");
    if (
      !next ||
      !next.startsWith("/") ||
      next.startsWith("//") ||
      next.includes("\\")
    )
      return "/dashboard.html";
    const url = new URL(next, location.origin);
    return url.origin === location.origin
      ? url.pathname + url.search + url.hash
      : "/dashboard.html";
  }
  function accountForm() {
    const form = $("accountForm");
    if (!form) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      busy(
        form.querySelector("button"),
        async () => {
          const values = Object.fromEntries(new FormData(form));
          delete values.csrfmiddlewaretoken;
          const action = form.dataset.action;
          const routes = { login: "login", signup: "signup" };
          const result = await api("/api/v1/auth/" + routes[action], {
            method: "POST",
            body: values,
          });
          $("accountMessage").textContent = result.message || "Signed in.";
          if (action === "login") location.replace(safeNext());
          else if (action === "signup") {
            form.reset();
            const link = node("a", "Sign in now");
            link.href = "/accounts/login/";
            $("accountMessage").append(" ", link);
          }
        },
        $("accountMessage"),
      );
    });
  }
  document.addEventListener("likha-session-expired", () => {
    announce("Your session expired. Your unsaved drawing is still here. ");
    const link = node("a", "Sign in in a new tab");
    link.href = "/accounts/login/";
    link.target = "_blank";
    link.rel = "noopener";
    $("hostStatus").append(link);
  });
  async function start() {
    wireLogout();
    accountForm();
    const menu = $("menuToggle"),
      nav = $("navLinks");
    menu?.addEventListener("click", () => {
      const expanded = menu.getAttribute("aria-expanded") !== "true";
      menu.setAttribute("aria-expanded", String(expanded));
      nav?.classList.toggle("active", expanded);
      nav?.classList.toggle("open", expanded);
    });
    const session = await window.LikhaAPI.ready;
    account = session.profile;
    const page = document.body.dataset.page;
    if (!account || !session.authenticated) return;
    const pages = [
      "dashboard",
      "studio",
      "gallery",
      "avatar",
      "pet",
      "quiz",
      "settings",
    ];
    if (pages.includes(page)) {
      const controller = await import(`./page-${page}.js`);
      await controller.init({ account });
    }
  }
  start().catch((error) => announce(error.message));
})();
