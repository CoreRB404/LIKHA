import { $, api, node, announce, busy, dialog } from "./ui.js";

export async function init(context) {
  let account = context.account;
  $("changePasswordForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    busy(
      form.querySelector("button"),
      async () => {
        await api("/api/v1/me/password", {
          method: "POST",
          body: Object.fromEntries(new FormData(form)),
        });
        window.LikhaAPI.clearPrivateViews();
        location.replace("/accounts/login/");
      },
      $("passwordMessage"),
    );
  });
  $("exportForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    busy(
      form.querySelector("button"),
      async () => {
        const blob = await api("/api/v1/me/export", {
          method: "POST",
          body: Object.fromEntries(new FormData(form)),
          binary: true,
        });
        const url = URL.createObjectURL(blob),
          link = node("a");
        link.href = url;
        link.download = "likha-private-export.zip";
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        form.reset();
        $("exportMessage").textContent = "Your private export is downloaded.";
      },
      $("exportMessage"),
    );
  });
  $("deleteAccountForm").addEventListener("submit", (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    busy(
      form.querySelector("button"),
      async () => {
        await api("/api/v1/me", {
          method: "DELETE",
          body: Object.fromEntries(new FormData(form)),
        });
        window.LikhaAPI.clearPrivateViews();
        location.replace("/");
      },
      $("deleteMessage"),
    );
  });
  const form = $("importForm");
  let previewUrl = "",
    pending = crypto.randomUUID();
  form.elements.image.addEventListener("change", () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const file = form.elements.image.files[0];
    $("importPreview").hidden = !file;
    if (file) {
      previewUrl = URL.createObjectURL(file);
      $("importPreview").src = previewUrl;
    }
    pending = crypto.randomUUID();
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    busy(
      form.querySelector("button"),
      async () => {
        const body = new FormData(form);
        body.set("confirmed", "yes");
        body.set("client_id", pending);
        await api("/api/v1/imports/artworks", { method: "POST", body });
        $("importMessage").textContent =
          "Artwork imported into your account without historical rewards.";
        form.reset();
        $("importPreview").hidden = true;
        pending = crypto.randomUUID();
      },
      $("importMessage"),
    );
  });
}
