const DASHBOARD_STORAGE_KEY = "likhaDashboardPrototype_v1";
const ARTWORK_STORAGE_KEY = "likhaArtworks";

const petPreview = document.getElementById("petPreview");
const petNameDisplay = document.getElementById("petNameDisplay");
const petStage = document.getElementById("petStage");
const petProgress = document.getElementById("petProgress");
const progressText = document.getElementById("progressText");
const petMessage = document.getElementById("petMessage");
const petNameInput = document.getElementById("petNameInput");
const petOptions = [...document.querySelectorAll(".pet-option")];
const savePetBtn = document.getElementById("savePetBtn");
const artworkCount = document.getElementById("artworkCount");
const growthPoints = document.getElementById("growthPoints");

const DEFAULT_PET = {
    type: "cat",
    name: "Mimi",
    growthPoints: 0
};

let selectedPetType = DEFAULT_PET.type;

function loadDashboardState() {
    try {
        const raw = localStorage.getItem(DASHBOARD_STORAGE_KEY);
        const saved = raw ? JSON.parse(raw) : {};
        if (!saved || typeof saved !== "object" || Array.isArray(saved)) {
            throw new Error("Saved LIKHA data is not an object.");
        }
        return LikhaPetProgress.reconcile({
            ...saved,
            artworks: Array.isArray(saved.artworks) ? saved.artworks : []
        });
    } catch (error) {
        console.error("Could not load LIKHA pet progress:", error);
        return null;
    }
}

function saveDashboardState(state) {
    try {
        localStorage.setItem(DASHBOARD_STORAGE_KEY, JSON.stringify(state));
        return true;
    } catch (error) {
        console.error("Could not save LIKHA pet settings:", error);
        return false;
    }
}

function loadSavedArtworks(dashboardState) {
    let separateArtworks = [];

    try {
        const saved = JSON.parse(
            localStorage.getItem(ARTWORK_STORAGE_KEY) || "[]"
        );
        separateArtworks = Array.isArray(saved) ? saved : [];
    } catch (error) {
        console.error("Could not load saved artworks:", error);
    }

    const uniqueArtworks = new Map();
    [...dashboardState.artworks, ...separateArtworks].forEach(
        (artwork, index) => {
            const id = artwork.id === undefined || artwork.id === null
                ? `legacy-${index}`
                : String(artwork.id);
            uniqueArtworks.set(id, artwork);
        }
    );

    return uniqueArtworks.size;
}

function getPetImage(type) {
    const option = petOptions.find((item) => item.dataset.pet === type);
    return option ? option.dataset.image : "images/pasted-image-2.webp";
}


function renderPet() {
    const state = loadDashboardState();

    if (!state) {
        petMessage.textContent =
            "LIKHA could not read your saved progress. Your pet data has not been changed.";
        return;
    }

    const pet = state.pet;
    const option = petOptions.find(
        (item) => item.dataset.pet === pet.type
    );
    const petType = option ? pet.type : DEFAULT_PET.type;
    selectedPetType = petType;

    const stage = LikhaPetProgress.stage(state);
    LikhaPetArt.apply(petPreview, petType, stage.level, getPetImage(petType));
    petPreview.alt = `${pet.name} the ${petType}, ${stage.name}`;
    const stages = ["baby", "growing", "young", "grown"];
    const previousStage = petPreview.dataset.growthStage;
    petPreview.dataset.growthStage = stage.level;
    petPreview.className = `pet-emoji stage-${stage.level}`;
    if (previousStage && stages.indexOf(stage.level) > stages.indexOf(previousStage)) {
        petPreview.classList.add("is-growing");
    }
    petNameDisplay.textContent = pet.name;
    petNameInput.value = pet.name;

    petStage.textContent = stage.name;
    petProgress.style.width = `${Math.min(stage.progress, 100)}%`;
    progressText.textContent = stage.next;
    petMessage.textContent = stage.level === "grown"
        ? "Amazing! Your learning and creativity helped your companion fully grow!"
        : "Every completed activity and correct quiz answer helps your pet grow!";

    artworkCount.textContent = loadSavedArtworks(state);
    growthPoints.textContent = pet.growthPoints;

    const stageOrder = ["baby", "growing", "young", "grown"];
    const currentStageIndex = stageOrder.indexOf(stage.level);
    document.querySelectorAll("#petGrowthJourney [data-stage]").forEach((card) => {
        const index = stageOrder.indexOf(card.dataset.stage);
        const status = index < currentStageIndex
            ? "Completed"
            : index === currentStageIndex
                ? "Current"
                : "Locked";
        const image = card.querySelector(".pet-stage-image");

        card.classList.toggle("is-completed", status === "Completed");
        card.classList.toggle("is-current", status === "Current");
        card.classList.toggle("is-locked", status === "Locked");

        if (status === "Current") {
            card.setAttribute("aria-current", "step");
        } else {
            card.removeAttribute("aria-current");
        }

        card.querySelector(".pet-stage-status").textContent = status;
        LikhaPetArt.apply(image, petType, card.dataset.stage, getPetImage(petType));
        image.alt = `${petType} at the ${card.querySelector("h3").textContent} stage`;
    });

    petOptions.forEach((item) => {
        const isSelected = item.dataset.pet === petType;
        item.classList.toggle("selected", isSelected);
        item.setAttribute("aria-pressed", String(isSelected));
    });
}

petOptions.forEach((option) => {
    option.addEventListener("click", () => {
        selectedPetType = option.dataset.pet;
        LikhaPetArt.apply(petPreview, selectedPetType, petPreview.dataset.growthStage || "baby", getPetImage(selectedPetType));
        petPreview.alt = `Selected pet: ${selectedPetType}`;

        petOptions.forEach((item) => {
            const isSelected = item === option;
            item.classList.toggle("selected", isSelected);
            item.setAttribute("aria-pressed", String(isSelected));
        });
    });
});

savePetBtn.addEventListener("click", () => {
    const name = petNameInput.value.trim();

    if (!name) {
        alert("Please enter a name for your pet.");
        petNameInput.focus();
        return;
    }

    const state = loadDashboardState();

    if (!state) {
        alert("Your pet settings could not be saved because LIKHA data could not be read.");
        return;
    }

    state.pet = {
        ...state.pet,
        name: name.slice(0, 20),
        type: selectedPetType
    };

    if (!saveDashboardState(state)) {
        alert("Your pet settings could not be saved. Check your browser storage and try again.");
        return;
    }

    renderPet();
    alert("Your LIKHA Pet has been saved! 💖");
});

document.getElementById("createArtworkBtn").addEventListener("click", () => {
    window.location.href = "dashboard.html";
});

window.addEventListener("storage", (event) => {
    if ([DASHBOARD_STORAGE_KEY, ARTWORK_STORAGE_KEY, "likhaPet"].includes(event.key)) {
        renderPet();
    }
});

window.addEventListener("pageshow", renderPet);
window.addEventListener("likha:pet-progress", renderPet);
renderPet();
