// Shared growth accounting for the studio, quizzes, dashboard, and pet page.
(() => {
    const STORE = "likhaDashboardPrototype_v1";
    const TYPES = ["rabbit", "cat", "dog", "lion", "panda", "tiger"];
    const nonnegative = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

    function read(key, fallback) {
        try {
            const value = localStorage.getItem(key);
            return value ? JSON.parse(value) : fallback;
        } catch (error) {
            console.warn(`Could not read ${key}:`, error);
            return fallback;
        }
    }

    function reconcile(saved) {
        const state = saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
        const pet = state.pet && typeof state.pet === "object" ? state.pet : {};
        const legacy = read("likhaPet", {}) || {};
        const separate = read("likhaArtworks", []);
        const activities = new Set(
            (Array.isArray(state.completedActivities) ? state.completedActivities : [])
                .filter(id => typeof id === "string" && id)
        );
        const brokenId = "art-Date.now()-{Math.random().toString(16).slice(2, 8)}";
        const savedArtworks = (Array.isArray(state.artworks) ? state.artworks : []).map((artwork, index) =>
            artwork && artwork.id === brokenId ? { ...artwork, id: `legacy-dashboard-artwork-${index}` } : artwork
        );
        if (savedArtworks.some(artwork => String(artwork?.id || "").startsWith("legacy-dashboard-artwork-"))) {
            activities.delete(`artwork:${brokenId}`);
        }
        const artworks = [
            ...savedArtworks,
            ...(Array.isArray(separate) ? separate : [])
        ];
        artworks.forEach(artwork => {
            if (artwork && artwork.id !== undefined && artwork.id !== null && String(artwork.id)) {
                activities.add(`artwork:${artwork.id}`);
            }
        });

        const seenAttempts = new Set();
        let recordedPetPoints = 0;
        Object.entries(state.quizResults || {}).forEach(([assessment, attempts]) => {
            if (!Array.isArray(attempts)) return;
            attempts.forEach((attempt, index) => {
                if (!attempt || attempt.rewarded === false) return;
                const id = attempt.attemptId || `${assessment}:${index}`;
                if (seenAttempts.has(id)) return;
                seenAttempts.add(id);
                recordedPetPoints += nonnegative(attempt.petPoints);
            });
        });

        let legacyType = "cat";
        try { legacyType = localStorage.getItem("likhaSelectedPet") || "cat"; } catch {}
        return {
            ...state,
            artworks: savedArtworks,
            completedActivities: [...activities],
            pet: {
                ...pet,
                name: pet.name || legacy.name || "Mimi",
                type: TYPES.includes(pet.type) ? pet.type : TYPES.includes(legacyType) ? legacyType : "cat",
                growthPoints: Math.max(nonnegative(pet.growthPoints), recordedPetPoints),
                // Legacy points were awarded for artwork. Keep them as a floor,
                // rather than adding them again to the registered artwork count.
                legacyArtworkCount: Math.max(nonnegative(pet.legacyArtworkCount), nonnegative(legacy.points))
            }
        };
    }

    function metrics(saved) {
        const state = reconcile(saved);
        const artworkCount = state.completedActivities.filter(id => id.startsWith("artwork:")).length;
        const otherCount = state.completedActivities.length - artworkCount;
        const activities = otherCount + Math.max(artworkCount, state.pet.legacyArtworkCount);
        return {
            activities,
            growthPoints: state.pet.growthPoints,
            units: activities + state.pet.growthPoints / 2
        };
    }

    function stage(saved) {
        const { activities, growthPoints, units } = metrics(saved);
        const label = `${activities} eligible activities and ${growthPoints} Pet Growth Points`;
        let name, level, start, end;
        if (units >= 8) {
            return { name: "Fully Grown Companion", level: "grown", progress: 100,
                next: `${label}. Your pet has reached its final growth stage!` };
        } else if (units >= 5) {
            [name, level, start, end] = ["Young Companion", "young", 5, 8];
        } else if (units >= 2) {
            [name, level, start, end] = ["Growing Pet", "growing", 2, 5];
        } else {
            [name, level, start, end] = ["Baby Pet", "baby", 0, 2];
        }
        return { name, level, progress: ((units - start) / (end - start)) * 100,
            next: `${label}. ${Math.ceil(end - units)} more growth activity equivalents to the next stage.` };
    }

    function sync() {
        try {
            const raw = localStorage.getItem(STORE);
            const saved = raw ? JSON.parse(raw) : {};
            if (!saved || typeof saved !== "object" || Array.isArray(saved)) return false;
            const progress = reconcile(saved);
            const next = JSON.stringify(window.LikhaArtworkRewards
                ? window.LikhaArtworkRewards.reconcile(progress) : progress);
            if (next !== raw) {
                localStorage.setItem(STORE, next);
                window.dispatchEvent(new Event("likha:pet-progress"));
            }
            return true;
        } catch (error) {
            console.warn("Could not persist pet progress; saved activities remain available:", error);
            return false;
        }
    }

    window.LikhaPetProgress = { reconcile, metrics, stage, sync };
    sync();
    window.addEventListener("pageshow", sync);
    window.addEventListener("storage", event => {
        if ([STORE, "likhaArtworks", "likhaPet"].includes(event.key)) sync();
    });
})();
