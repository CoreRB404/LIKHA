document.addEventListener("DOMContentLoaded", () => {
    const galleryGrid = document.getElementById("galleryGrid");
    const emptyState = document.getElementById("emptyState");
    const noResultsState = document.getElementById("noResultsState");
    const galleryControls = document.getElementById("galleryControls");
    const artCount = document.getElementById("artCount");
    const artworkSearch = document.getElementById("gallerySearch");
    const labFilter = document.getElementById("galleryLabFilter");
    const artworkSort = document.getElementById("gallerySort");
    const galleryResultCount = document.getElementById("galleryResultCount");
    const previewModal = document.getElementById("artworkPreviewModal");
    const previewImage = document.getElementById("previewArtworkImage");
    const previewTitle = document.getElementById("previewArtworkTitle");
    const previewLab = document.getElementById("previewArtworkLab");
    const previewConcepts = document.getElementById("previewArtworkConcepts");
    const closePreviewButton = document.getElementById("closeArtworkPreview");

    const STORAGE_KEY = "likhaArtworks";

    function getArtworks() {
        try {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            return Array.isArray(data) ? data : [];
        } catch (error) {
            console.error("Unable to load artworks:", error);
            return [];
        }
    }

    function saveArtworks(artworks) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(artworks));
            return true;
        } catch (error) {
            console.error("Unable to save artworks:", error);
            alert("The gallery could not be updated. Browser storage may be full.");
            return false;
        }
    }

    function normalizeLab(value) {
        const lab = String(value || "art")
            .trim()
            .toLowerCase()
            .replace(/\s*lab\s*$/, "");

        return ["fashion", "festival", "craft", "art"].includes(lab)
            ? lab
            : "art";
    }

    function displayLab(value) {
        const names = {
            fashion: "👗 Fashion Lab",
            festival: "🎉 Festival Lab",
            craft: "🧶 Craft Lab",
            art: "🖌️ Art Lab"
        };

        return names[normalizeLab(value)];
    }

    function getConcept(concepts, name) {
        if (!concepts) return "";

        let value;

        if (Array.isArray(concepts)) {
            const found = concepts.find(item =>
                item &&
                String(item.label || item.name || "").toLowerCase() === name
            );
            value = found && (found.value || found.description);
        } else if (typeof concepts === "object") {
            const key = Object.keys(concepts).find(
                conceptName => conceptName.toLowerCase() === name
            );
            value = key ? concepts[key] : "";
        }

        if (typeof value === "string" || typeof value === "number") {
            return String(value).trim();
        }

        return "";
    }

    function formatDate(value) {
        const timestamp = value ? new Date(value) : null;

        if (!timestamp || Number.isNaN(timestamp.getTime())) {
            return "Date not recorded";
        }

        return timestamp.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    }

    function getImageData(artwork) {
        const imageData =
            artwork.imageData ||
            artwork.image ||
            artwork.dataURL ||
            "";

        return typeof imageData === "string" &&
            imageData.startsWith("data:image/")
            ? imageData
            : "";
    }

    function appendConceptRows(container, concepts, showMissing) {
        const conceptNames = [
            ["Subject", "subject"],
            ["Theme", "theme"],
            ["Form", "form"],
            ["Style", "style"],
            ["Symbolism", "symbolism"],
            ["Medium", "medium"]
        ];
        let availableCount = 0;

        conceptNames.forEach(([label, key]) => {
            const value = getConcept(concepts, key);

            if (!value && !showMissing) return;

            const row = document.createElement("div");
            const heading = document.createElement("strong");
            const description = document.createElement("span");

            heading.textContent = label + ": ";
            description.textContent = value || "Not provided";
            row.append(heading, description);
            container.appendChild(row);

            if (value) availableCount += 1;
        });

        return availableCount;
    }

    let lastPreviewTrigger = null;

    function openPreview(artwork, trigger) {
        const title = artwork.title || "Untitled Artwork";
        const concepts = artwork.concepts || artwork.details || {};
        const imageData = getImageData(artwork);

        lastPreviewTrigger = trigger;
        previewTitle.textContent = title;
        previewLab.textContent = displayLab(artwork.lab || artwork.selectedLab);
        previewConcepts.replaceChildren();

        if (imageData) {
            previewImage.src = imageData;
            previewImage.alt = title;
            previewImage.hidden = false;
        } else {
            previewImage.removeAttribute("src");
            previewImage.alt = "";
            previewImage.hidden = true;
        }

        if (!appendConceptRows(previewConcepts, concepts, false)) {
            const message = document.createElement("p");
            message.textContent = "No artistic concepts were saved for this artwork.";
            previewConcepts.appendChild(message);
        }

        previewConcepts.querySelectorAll(":scope > div").forEach(concept => {
            concept.classList.add("preview-concept");
        });

        previewModal.setAttribute("aria-hidden", "false");
        previewModal.classList.add("is-open");
        document.body.classList.add("preview-open");
        closePreviewButton.focus();
    }

    function closePreview() {
        if (previewModal.getAttribute("aria-hidden") === "true") return;

        previewModal.setAttribute("aria-hidden", "true");
        previewModal.classList.remove("is-open");
        document.body.classList.remove("preview-open");
        previewImage.removeAttribute("src");

        if (lastPreviewTrigger && lastPreviewTrigger.isConnected) {
            lastPreviewTrigger.focus();
        }

        lastPreviewTrigger = null;
    }

    closePreviewButton.addEventListener("click", closePreview);

    previewModal.addEventListener("click", event => {
        if (event.target === previewModal) {
            closePreview();
        }
    });

    document.addEventListener("keydown", event => {
        if (event.key === "Escape") {
            closePreview();
        }
    });

    function createArtworkCard(artwork, storageIndex) {
        const title = artwork.title || "Untitled Artwork";
        const lab = normalizeLab(artwork.lab || artwork.selectedLab);
        const concepts = artwork.concepts || artwork.details || {};
        const imageData = getImageData(artwork);

        const card = document.createElement("article");
        card.className = "art-card artwork-card";
        if (artwork.id !== undefined && artwork.id !== null) {
            card.dataset.artworkId = String(artwork.id);
        }
        card.dataset.storageIndex = String(storageIndex);

        const preview = document.createElement("button");
        preview.type = "button";
        preview.className = "art-preview";
        preview.setAttribute("aria-label", "Preview " + title);

        if (imageData) {
            const image = document.createElement("img");
            image.src = imageData;
            image.alt = "";
            image.loading = "lazy";
            preview.appendChild(image);
        } else {
            const placeholder = document.createElement("span");
            placeholder.className = "art-placeholder";

            const icon = document.createElement("span");
            icon.textContent = "🖼️";

            const message = document.createElement("span");
            message.textContent = "Artwork preview unavailable";

            placeholder.append(icon, message);
            preview.appendChild(placeholder);
        }

        preview.addEventListener("click", () => openPreview(artwork, preview));

        const info = document.createElement("div");
        info.className = "art-info";

        const heading = document.createElement("h3");
        heading.textContent = title;

        const labBadge = document.createElement("span");
        labBadge.className = "art-lab";
        labBadge.textContent = displayLab(lab);

        let challengeBadge = null;

        if (artwork.challengeTitle) {
            challengeBadge = document.createElement("span");
            challengeBadge.className = "art-challenge";
            challengeBadge.textContent = "🌟 Challenge: " + artwork.challengeTitle;
        }

        const date = document.createElement("p");
        date.className = "art-date";
        date.textContent = "Saved: " + formatDate(
            artwork.dateSaved || artwork.createdAt
        );

        const conceptList = document.createElement("div");
        conceptList.className = "concept-list";
        appendConceptRows(conceptList, concepts, true);

        const actions = document.createElement("div");
        actions.className = "card-actions";

        const previewButton = document.createElement("button");
        previewButton.type = "button";
        previewButton.className = "button button-secondary";
        previewButton.textContent = "Preview";
        previewButton.addEventListener(
            "click",
            () => openPreview(artwork, previewButton)
        );

        const openButton = document.createElement("button");
        openButton.type = "button";
        openButton.className = "button button-primary";
        openButton.textContent = "Open in Studio";
        openButton.addEventListener("click", () => {
            try {
                localStorage.setItem(
                    "likhaArtworkToEdit",
                    JSON.stringify(artwork)
                );

                localStorage.setItem("selectedLab", lab);
                window.location.href = `studio.html?lab=${encodeURIComponent(lab)}`;
            } catch (error) {
                alert("This artwork could not be opened.");
                console.error(error);
            }
        });

        const deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "button button-danger";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", () => {
            const confirmed = window.confirm(
                `Are you sure you want to delete "${title}"?`
            );

            if (!confirmed) return;

            const artworks = getArtworks();
            const updated = artwork.id !== undefined && artwork.id !== null
                ? artworks.filter(item => item.id !== artwork.id)
                : artworks.filter((item, itemIndex) => itemIndex !== storageIndex);

            if (saveArtworks(updated)) {
                renderGallery();
            }
        });

        actions.append(previewButton, openButton, deleteButton);
        info.append(heading, labBadge);

        if (challengeBadge) {
            info.appendChild(challengeBadge);
        }

        info.append(date, conceptList, actions);
        card.append(preview, info);

        return card;
    }

    galleryGrid.addEventListener("click", event => {
        if (!(event.target instanceof Element)) return;

        const card = event.target.closest(".art-card");
        if (!card || !galleryGrid.contains(card)) return;

        if (event.target.closest("button, a, input, select, textarea")) return;

        const artworks = getArtworks();
        const artwork = card.dataset.artworkId
            ? artworks.find(item => String(item.id) === card.dataset.artworkId)
            : artworks[Number(card.dataset.storageIndex)];

        if (artwork) {
            openPreview(artwork, card);
        }
    });

    function getSortedArtworks(artworks) {
        const searchTerm = artworkSearch.value.trim().toLocaleLowerCase();
        const selectedLab = labFilter.value;
        const sortOrder = artworkSort.value;

        const filtered = artworks
            .map((artwork, index) => ({ artwork, index }))
            .filter(({ artwork }) => {
                const title = String(artwork.title || "Untitled Artwork")
                    .toLocaleLowerCase();
                const matchesTitle = title.includes(searchTerm);
                const matchesLab = selectedLab === "all" ||
                    normalizeLab(artwork.lab || artwork.selectedLab) === selectedLab;

                return matchesTitle && matchesLab;
            });

        filtered.sort((first, second) => {
            if (sortOrder === "title-az" || sortOrder === "title-za") {
                const comparison = String(first.artwork.title || "Untitled Artwork")
                    .localeCompare(
                        String(second.artwork.title || "Untitled Artwork"),
                        undefined,
                        { sensitivity: "base" }
                    );

                return (sortOrder === "title-za" ? -comparison : comparison) ||
                    first.index - second.index;
            }

            const firstTimestamp = Date.parse(
                first.artwork.dateSaved || first.artwork.createdAt || ""
            );
            const secondTimestamp = Date.parse(
                second.artwork.dateSaved || second.artwork.createdAt || ""
            );
            const firstHasDate = Number.isFinite(firstTimestamp);
            const secondHasDate = Number.isFinite(secondTimestamp);

            if (firstHasDate !== secondHasDate) {
                return firstHasDate ? -1 : 1;
            }

            if (!firstHasDate) return first.index - second.index;

            const comparison = sortOrder === "oldest"
                ? firstTimestamp - secondTimestamp
                : secondTimestamp - firstTimestamp;

            return comparison || first.index - second.index;
        });

        return filtered;
    }

    function renderGallery() {
        const artworks = getArtworks();
        const visibleArtworks = getSortedArtworks(artworks);

        galleryGrid.replaceChildren();
        artCount.textContent =
            `${artworks.length} ${artworks.length === 1 ? "artwork" : "artworks"} saved`;

        galleryControls.hidden = artworks.length === 0;
        galleryResultCount.hidden = artworks.length === 0;
        galleryResultCount.textContent = artworks.length === 0
            ? ""
            : `Showing ${visibleArtworks.length} of ${artworks.length} ${
                artworks.length === 1 ? "artwork" : "artworks"
            }`;
        emptyState.hidden = artworks.length !== 0;
        noResultsState.hidden =
            artworks.length === 0 || visibleArtworks.length !== 0;
        galleryGrid.hidden = visibleArtworks.length === 0;

        visibleArtworks.forEach(({ artwork, index }) => {
            galleryGrid.appendChild(createArtworkCard(artwork, index));
        });
    }

    artworkSearch.addEventListener("input", renderGallery);
    labFilter.addEventListener("change", renderGallery);
    artworkSort.addEventListener("change", renderGallery);

    window.addEventListener("storage", event => {
        if (event.key === STORAGE_KEY) {
            renderGallery();
        }
    });

    renderGallery();
});
