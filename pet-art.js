// Render a distinct, age-appropriate illustration for each saved pet stage.
(() => {
    const stages = ["baby", "growing", "young", "grown"];
    const types = ["rabbit", "cat", "dog", "lion", "panda", "tiger"];
    const artwork = Object.fromEntries(types.map(type => [type,
        Object.fromEntries(stages.map(level => [level, `images/pets/${type}-${level}-v1.webp`]))
    ]));

    function load(type) {
        return artwork[type] ? Promise.resolve(artwork[type])
            : Promise.reject(new Error(`No pet artwork for ${type}`));
    }

    function apply(image, type, level, fallback) {
        type = types.includes(type) ? type : "cat";
        level = stages.includes(level) ? level : "baby";
        const key = `${type}:${level}`;
        if (image.dataset.petArtKey === key && image.dataset.petArtState === "ready") {
            return Promise.resolve(true);
        }
        image.dataset.petArtKey = key;
        image.dataset.growthStage = level;
        image.dataset.petArtState = "loading";
        image.setAttribute("aria-busy", "true");
        return load(type).then(async frames => {
            if (image.dataset.petArtKey !== key) return false;
            if (image.getAttribute("src") !== frames[level]) image.src = frames[level];
            await image.decode();
            if (image.dataset.petArtKey !== key) return false;
            image.dataset.petArtState = "ready";
            image.removeAttribute("aria-busy");
            return true;
        }).catch(error => {
            if (image.dataset.petArtKey !== key) return false;
            image.dataset.petArtState = "error";
            image.removeAttribute("aria-busy");
            if (fallback) image.src = fallback;
            console.warn(`Could not load ${type} ${level} artwork:`, error);
            return false;
        });
    }

    window.LikhaPetArt = { apply, load };
})();
