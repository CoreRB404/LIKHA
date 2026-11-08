import { $, api, node, announce, busy, dialog } from "./ui.js";

export async function init(context) {
  let account = context.account;
  const canvas = $("artCanvas"),
    form = $("artworkDetailsForm"),
    modal = $("artworkDetailsModal");
  if (!canvas || !form) return;
  const saveDialog = dialog(modal, { initialFocus: $("artworkTitle") });
  modal.setAttribute("aria-label", "Save artwork");
  $("saveArtworkBtn").addEventListener("click", () =>
    saveDialog.open($("saveArtworkBtn")),
  );
  $("cancelSaveBtn").addEventListener("click", saveDialog.close);
  const note = node(
    "p",
    "Saved to your private account. Up to 10 distinct new artworks per day earn rewards; identical-image copies and imports do not.",
    "host-meta",
  );
  form.append(note);
  let pending = null;
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    busy(form.querySelector('[type="submit"]'), async () => {
      const query = new URLSearchParams(location.search),
        concepts = {};
      for (const key of [
        "subject",
        "theme",
        "form",
        "style",
        "symbolism",
        "medium",
      ])
        concepts[key] = $(
          "artwork" + key[0].toUpperCase() + key.slice(1),
        ).value.trim();
      const image = await new Promise((resolve) =>
        canvas.toBlob(resolve, "image/png"),
      );
      if (!image)
        throw new Error(
          "The artwork could not be encoded. Your drawing is still here.",
        );
      const metadata = {
        title: $("artworkTitle").value.trim(),
        lab: query.get("lab") || "art",
        concepts,
        challenge: query.get("challenge") || "",
      };
      const fingerprint = JSON.stringify(metadata) + canvas.toDataURL();
      if (!pending || pending.fingerprint !== fingerprint)
        pending = { id: crypto.randomUUID(), fingerprint };
      const body = new FormData();
      body.set("client_id", pending.id);
      body.set("title", metadata.title);
      body.set("lab", metadata.lab);
      body.set("concepts", JSON.stringify(concepts));
      body.set("challenge", metadata.challenge);
      body.set("image", image, "drawing.png");
      await api("/api/v1/artworks", { method: "POST", body });
      pending = null;
      location.href = "/gallery.html";
    });
  });
  modal.setAttribute("aria-modal", "true");
  modal.setAttribute("role", "dialog");
}
