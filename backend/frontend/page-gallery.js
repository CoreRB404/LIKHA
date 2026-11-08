import { $, api, node, announce, busy, dialog } from "./ui.js";

export async function init(context) {
  let account = context.account;
  let records = [];
  let cursor = 0;
  do {
    const page = await api("/api/v1/artworks?limit=100&cursor=" + cursor);
    records.push(...page.artworks);
    cursor = page.next_cursor;
  } while (cursor !== null);
  const grid = $("galleryGrid");
  const modal = $("artworkPreviewModal");
  const previewDialog = dialog(modal, {
    initialFocus: $("closeArtworkPreview"),
    onClose: () => $("previewArtworkImage").removeAttribute("src"),
  });
  modal.hidden = true;
  $("closeArtworkPreview").addEventListener("click", previewDialog.close);
  function render() {
    grid.replaceChildren();
    const query = $("gallerySearch").value.toLowerCase(),
      lab = $("galleryLabFilter").value,
      sort = $("gallerySort").value;
    const filtered = records.filter(
      (art) =>
        art.title.toLowerCase().includes(query) &&
        (lab === "all" || art.lab === lab),
    );
    filtered.sort((a, b) =>
      sort === "oldest"
        ? a.created_at.localeCompare(b.created_at)
        : sort === "title-az"
          ? a.title.localeCompare(b.title)
          : sort === "title-za"
            ? b.title.localeCompare(a.title)
            : b.created_at.localeCompare(a.created_at),
    );
    $("artCount").textContent = records.length;
    $("galleryResultCount").textContent =
      `${filtered.length} of ${records.length} artworks`;
    $("emptyState").hidden = !!records.length;
    $("noResultsState").hidden = !records.length || !!filtered.length;
    grid.hidden = !filtered.length;
    $("galleryControls").hidden = !records.length;
    for (const art of filtered) {
      const card = node("article", undefined, "art-card artwork-card");
      card.dataset.artworkId = art.id;
      const image = node("img");
      image.src = art.image_url;
      image.alt = art.title;
      image.loading = "lazy";
      image.className = "";
      const title = node("h3", art.title),
        description = node("p", art.description || ""),
        meta = node(
          "p",
          `${art.lab} lab · ${new Date(art.created_at).toLocaleDateString()}${art.imported ? " · Imported, no historical rewards" : ""}`,
          "host-meta",
        );
      const actions = node("div", undefined, "card-actions"),
        view = node("button", "Preview"),
        download = node("a", "Download"),
        remove = node("button", "Delete");
      download.href = art.image_url + "?download=1";
      view.addEventListener("click", () => {
        $("previewArtworkTitle").textContent = art.title;
        $("previewArtworkLab").textContent = art.lab + " Lab";
        $("previewArtworkImage").src = art.image_url;
        $("previewArtworkConcepts").replaceChildren(
          ...Object.entries(art.concepts).map(([key, value]) =>
            node("p", key + ": " + value),
          ),
        );
        previewDialog.open(view);
      });
      remove.addEventListener("click", () => {
        if (!confirm("Delete this artwork? Earned progress is preserved."))
          return;
        busy(remove, async () => {
          await api("/api/v1/artworks/" + art.id, {
            method: "DELETE",
            body: { version: art.version },
          });
          records = records.filter((item) => item.id !== art.id);
          render();
        });
      });
      for (const action of [view, download, remove])
        action.className = "button button-secondary";
      const open = node("a", "Open in Studio", "button button-primary");
      open.href = `/studio/?lab=${art.lab}&artwork=${art.id}`;
      actions.append(view, open, download, remove);
      const details = node("details"),
        summary = node("summary", "Edit artwork details"),
        edit = node("form"),
        label = node("label", "Title"),
        input = node("input"),
        descLabel = node("label", "Description"),
        textarea = node("textarea"),
        save = node("button", "Save details", "button button-primary");
      input.value = art.title;
      input.required = true;
      input.maxLength = 120;
      textarea.value = art.description;
      textarea.maxLength = 2000;
      label.append(input);
      descLabel.append(textarea);
      save.type = "submit";
      edit.append(label, descLabel, save);
      details.append(summary, edit);
      edit.addEventListener("submit", (event) => {
        event.preventDefault();
        busy(save, async () => {
          const result = await api("/api/v1/artworks/" + art.id, {
            method: "PATCH",
            body: {
              version: art.version,
              title: input.value,
              description: textarea.value,
            },
          });
          Object.assign(art, result.artwork);
          render();
          announce("Artwork details saved.");
        });
      });
      const preview = node("button", undefined, "art-preview");
      preview.type = "button";
      preview.setAttribute("aria-label", "Preview " + art.title);
      preview.append(image);
      preview.addEventListener("click", () => view.click());
      const info = node("div", undefined, "art-info");
      info.append(title, meta, description, actions, details);
      card.append(preview, info);
      if (art.challenge) {
        const complete = node(
          "button",
          "Complete challenge",
          "button button-secondary",
        );
        complete.addEventListener("click", () =>
          busy(complete, async () => {
            const result = await api(
              `/api/v1/challenges/${art.challenge}/complete`,
              { method: "POST", body: { artwork_id: art.id } },
            );
            announce(result.message);
          }),
        );
        info.append(complete);
      }
      grid.append(card);
    }
  }
  for (const id of ["gallerySearch", "galleryLabFilter", "gallerySort"])
    $(id).addEventListener(id === "gallerySearch" ? "input" : "change", render);
  render();
}
