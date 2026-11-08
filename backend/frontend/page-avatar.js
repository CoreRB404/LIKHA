import { $, api, node, announce, busy, dialog } from "./ui.js";

export async function init(context) {
  let account = context.account;
  let selected = account.avatar;
  function render() {
    $("avatarPreview").src =
      `/static/images/avatar-filipino-artist-${selected}.webp`;
    $("avatarCharacterInput").value = `avatar-filipino-artist-${selected}`;
    const option = document.querySelector(
      `[data-avatar="avatar-filipino-artist-${selected}"]`,
    );
    $("avatarName").textContent = option.dataset.name;
    $("avatarDescription").textContent = option.dataset.description;
    document.querySelectorAll("[data-avatar]").forEach((button) => {
      const active = button === option;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  $("avatarNameInput").value = account.display_name;
  $("avatarNameInput").maxLength = 60;
  document.querySelectorAll("[data-avatar]").forEach((button) =>
    button.addEventListener("click", () => {
      selected = Number(button.dataset.avatar.split("-").at(-1));
      render();
    }),
  );
  $("avatarCharacterInput").addEventListener("change", (event) => {
    selected = Number(event.target.value.split("-").at(-1));
    render();
  });
  $("saveAvatarBtn").addEventListener("click", () =>
    busy($("saveAvatarBtn"), async () => {
      const result = await api("/api/v1/me", {
        method: "PATCH",
        body: {
          avatar: selected,
          display_name: $("avatarNameInput").value,
          version: account.version,
        },
      });
      account = result.profile;
      $("saveMessage").textContent = "Your avatar is saved to your account.";
    }),
  );
  render();
}
