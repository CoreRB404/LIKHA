document.addEventListener("DOMContentLoaded", () => {
    const petOptions = document.querySelectorAll(".pet-option");
    const petPreview = document.getElementById("petPreview");

    if (!petPreview || petOptions.length === 0) {
        console.error("Pet selection or preview element was not found.");
        return;
    }

    petOptions.forEach((option) => {
        option.addEventListener("click", () => {
            const imagePath = option.dataset.image;
            const petType = option.dataset.pet;

            if (!imagePath || !petType) {
                console.error("Pet option is missing its image or type.");
                return;
            }

            petPreview.src = imagePath;
            petPreview.alt = `Selected pet: ${petType}`;

            petOptions.forEach((item) => {
                const isSelected = item === option;

                item.classList.toggle("selected", isSelected);
                item.setAttribute("aria-pressed", String(isSelected));
            });

            localStorage.setItem("likhaSelectedPet", petType);
            localStorage.setItem("likhaSelectedPetImage", imagePath);
        });
    });

    const savedPet = localStorage.getItem("likhaSelectedPet");
    const savedImage = localStorage.getItem("likhaSelectedPetImage");

    if (savedPet && savedImage) {
        const savedOption = Array.from(petOptions).find(
            (option) => option.dataset.pet === savedPet
        );

        if (savedOption) {
            petPreview.src = savedImage;
            petPreview.alt = `Selected pet: ${savedPet}`;

            petOptions.forEach((option) => {
                const isSelected = option === savedOption;

                option.classList.toggle("selected", isSelected);
                option.setAttribute("aria-pressed", String(isSelected));
            });
        }
    }
});
