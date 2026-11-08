document.addEventListener("DOMContentLoaded", function () {
    const avatarPreview = document.getElementById("avatarPreview");
    const avatarName = document.getElementById("avatarName");
    const avatarDescription = document.getElementById("avatarDescription");
    const avatarOptions = [...document.querySelectorAll(".avatar-option")];
    const characterInput = document.getElementById("avatarCharacterInput");
    const avatarNameInput = document.getElementById("avatarNameInput");
    const saveAvatarBtn = document.getElementById("saveAvatarBtn");
    const saveMessage = document.getElementById("saveMessage");

    if (
        !avatarPreview ||
        !avatarName ||
        !avatarDescription ||
        !characterInput ||
        !avatarNameInput ||
        !saveAvatarBtn ||
        !saveMessage ||
        avatarOptions.length === 0
    ) {
        console.error("LIKHA Avatar: Required HTML elements were not found.");
        return;
    }

    const STORAGE_KEY = "likhaSavedAvatar";
    const LEGACY_STORAGE_KEY = "likhaSelectedAvatar";
    const DASHBOARD_STORAGE_KEY = "likhaDashboardPrototype_v1";
    const avatarData = new Map(
        avatarOptions
            .filter(option => option.dataset.avatar)
            .map(option => [
                option.dataset.avatar,
                {
                    name: option.dataset.name || "LIKHA Artist",
                    description: option.dataset.description || ""
                }
            ])
    );

    let selectedAvatar = null;

    function selectAvatar(avatar, clearMessage = false) {
        const data = avatarData.get(avatar.character);

        if (!data) {
            console.error("LIKHA Avatar: Unknown avatar:", avatar.character);
            return;
        }

        selectedAvatar = {
            character: avatar.character,
            name: avatar.name || data.name,
            description: avatar.description || data.description
        };

        avatarPreview.src = `images/${selectedAvatar.character}.webp`;
        avatarPreview.alt = `${selectedAvatar.name} avatar`;
        avatarName.textContent = selectedAvatar.name;
        characterInput.value = selectedAvatar.character;
        avatarNameInput.value = selectedAvatar.name;
        avatarDescription.textContent = selectedAvatar.description;

        avatarOptions.forEach(option => {
            const isSelected = option.dataset.avatar === selectedAvatar.character;
            option.classList.toggle("selected", isSelected);
            option.setAttribute("aria-pressed", String(isSelected));
        });

        if (clearMessage) {
            saveMessage.textContent = "";
        }
    }

    function updateSelectedAvatar() {
        if (!selectedAvatar) return;

        const data = avatarData.get(selectedAvatar.character);
        selectedAvatar = {
            ...selectedAvatar,
            name: avatarNameInput.value.trim() || data.name,
            description: data.description
        };

        avatarName.textContent = selectedAvatar.name;
        avatarDescription.textContent = selectedAvatar.description;
        saveMessage.textContent = "";
    }

    avatarOptions.forEach(option => {
        option.addEventListener("click", function () {
            const data = avatarData.get(option.dataset.avatar);
            selectAvatar({
                character: option.dataset.avatar,
                name: avatarNameInput.value.trim() || data.name,
                description: data.description
            }, true);
        });
    });

    characterInput.addEventListener("change", function () {
        const data = avatarData.get(characterInput.value);
        if (!data) return;

        selectAvatar({
            character: characterInput.value,
            name: avatarNameInput.value.trim() || data.name,
            description: data.description
        }, true);
    });

    avatarNameInput.addEventListener("input", updateSelectedAvatar);

    saveAvatarBtn.addEventListener("click", function () {
        updateSelectedAvatar();

        if (!selectedAvatar) {
            saveMessage.textContent = "Please select an avatar first.";
            return;
        }

        const savedData = {
            avatar: selectedAvatar.character,
            character: selectedAvatar.character,
            name: selectedAvatar.name,
            description: selectedAvatar.description,
        };
        const legacyData = {
            image: selectedAvatar.character,
            name: selectedAvatar.name,
            description: selectedAvatar.description,
        };

        try {
            const dashboardState = JSON.parse(
                localStorage.getItem(DASHBOARD_STORAGE_KEY) || "{}"
            );
            const nextDashboardState = dashboardState &&
                typeof dashboardState === "object" &&
                !Array.isArray(dashboardState)
                ? dashboardState
                : {};

            nextDashboardState.avatar = {
                name: selectedAvatar.name,
                face: nextDashboardState.avatar?.face || "🧑",
                character: selectedAvatar.character,
            };

            localStorage.setItem(STORAGE_KEY, JSON.stringify(savedData));
            localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(legacyData));
            localStorage.setItem("likhaAvatar", selectedAvatar.character);
            localStorage.setItem(
                DASHBOARD_STORAGE_KEY,
                JSON.stringify(nextDashboardState)
            );

            saveMessage.textContent = "✓ Your LIKHA Avatar has been saved!";
            saveMessage.style.color = "#27834a";
        } catch (error) {
            console.error("LIKHA Avatar: Could not save selection.", error);
            saveMessage.textContent =
                "Unable to save. Please check your browser storage settings.";
            saveMessage.style.color = "#c52f50";
        }
    });

    function getSavedAvatar() {
        const savedData = localStorage.getItem(STORAGE_KEY);

        if (savedData) {
            const parsedData = JSON.parse(savedData);
            const character = parsedData.character || parsedData.avatar || parsedData.image;

            if (avatarData.has(character)) {
                return {
                    character,
                    name: parsedData.name,
                    description: parsedData.description,
                };
            }
        }

        const legacyData = localStorage.getItem(LEGACY_STORAGE_KEY);

        if (legacyData) {
            const parsedData = JSON.parse(legacyData);

            if (avatarData.has(parsedData.image)) {
                return {
                    character: parsedData.image,
                    name: parsedData.name,
                    description: parsedData.description,
                };
            }
        }

        const dashboardState = JSON.parse(
            localStorage.getItem(DASHBOARD_STORAGE_KEY) || "{}"
        );
        const dashboardAvatar = dashboardState?.avatar;

        if (dashboardAvatar && avatarData.has(dashboardAvatar.character)) {
            return {
                character: dashboardAvatar.character,
                name: dashboardAvatar.name,
            };
        }

        const sharedAvatar = localStorage.getItem("likhaAvatar");

        if (avatarData.has(sharedAvatar)) {
            return { character: sharedAvatar };
        }

        return null;
    }

    avatarPreview.addEventListener("error", function () {
        console.error(
            "LIKHA Avatar: Preview image could not be loaded:",
            avatarPreview.src
        );
    });

    avatarOptions.forEach(option => {
        const image = option.querySelector("img");

        if (image) {
            image.addEventListener("error", function () {
                console.error(
                    "LIKHA Avatar: Avatar choice image could not be loaded:",
                    image.src
                );
            });
        }
    });

    try {
        const savedAvatar = getSavedAvatar();
        const firstAvatar = avatarOptions[0].dataset.avatar;

        selectAvatar(savedAvatar || { character: firstAvatar });
    } catch (error) {
        console.error("LIKHA Avatar: Could not restore saved avatar.", error);
        selectAvatar({ character: avatarOptions[0].dataset.avatar });
    }
});
