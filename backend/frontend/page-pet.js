import { $, api, node, announce, busy, dialog } from "./ui.js";

export async function init(context) {
  let account = context.account;
  const { progress } = await api("/api/v1/progress");
  let selected = progress.pet.species;
  function render() {
    $("petPreview").src =
      `/static/images/pets/${selected}-${progress.stage}-v1.webp`;
    $("petPreview").dataset.growthStage = progress.stage;
    $("petNameDisplay").textContent = progress.pet.name;
    $("petStage").textContent = progress.stage;
    $("petNameInput").value = progress.pet.name;
    $("artworkCount").textContent = progress.completed_artworks;
    $("growthPoints").textContent = progress.growth_units / 2;
    $("petProgress").style.width =
      Math.min(100, (progress.growth_units / 16) * 100) + "%";
    $("progressText").textContent =
      `${progress.growth_units / 2} earned growth activities · stages at 2, 5 and 8`;
    $("petMessage").textContent =
      "Your creations and quiz answers help your companion grow.";
    const stages = ["baby", "growing", "young", "grown"],
      current = stages.indexOf(progress.stage);
    document.querySelectorAll("[data-stage]").forEach((card) => {
      const stage = card.dataset.stage,
        index = stages.indexOf(stage);
      card.querySelector("img").src =
        `/static/images/pets/${selected}-${stage}-v1.webp`;
      card.classList.toggle("is-current", index === current);
      card.classList.toggle("is-completed", index < current);
      card.classList.toggle("is-locked", index > current);
      card.querySelector(".pet-stage-status").textContent =
        index === current
          ? "Current"
          : index < current
            ? "Completed"
            : "Locked";
    });
    document.querySelectorAll("[data-pet]").forEach((button) => {
      const active = button.dataset.pet === selected;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  document.querySelectorAll("[data-pet]").forEach((button) =>
    button.addEventListener("click", () => {
      const name = $("petNameInput").value;
      selected = button.dataset.pet;
      render();
      $("petNameInput").value = name;
    }),
  );
  $("savePetBtn").addEventListener("click", () =>
    busy($("savePetBtn"), async () => {
      const result = await api("/api/v1/me", {
        method: "PATCH",
        body: {
          pet_species: selected,
          pet_name: $("petNameInput").value,
          version: account.version,
        },
      });
      account = result.profile;
      progress.pet = { species: selected, name: $("petNameInput").value };
      render();
      announce("Your pet settings are saved to your account.");
    }),
  );
  $("createArtworkBtn").addEventListener(
    "click",
    () => (location.href = "/dashboard/#choose-lab"),
  );
  render();
}
