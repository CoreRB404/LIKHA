// One permanent reward ledger for artwork saved from either creation flow.
(() => {
    const FIRST = "stars:milestone:first-artwork";
    const FOURTH = "stars:milestone:four-artworks";
    const positive = value => Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0;

    function reconcile(saved) {
        const dashboardArtworks = Array.isArray(saved.artworks) ? saved.artworks : [];
        let studioArtworks = [];
        try {
            const parsed = JSON.parse(localStorage.getItem("likhaArtworks") || "[]");
            if (Array.isArray(parsed)) studioArtworks = parsed;
        } catch (error) {
            console.warn("Could not read artwork rewards:", error);
        }
        const history = Array.isArray(saved.rewardHistory) ? [...saved.rewardHistory] : [];
        const ledger = new Set((Array.isArray(saved.artworkStarRewards) ? saved.artworkStarRewards : [])
            .filter(key => typeof key === "string"));
        const keyFor = artwork => artwork && artwork.id !== undefined && artwork.id !== null && String(artwork.id)
            ? `stars:artwork:${artwork.id}` : null;

        if (!saved.artworkStarRewardsVersion) {
            // The old dashboard form already paid these artworks. Studio saves did not.
            const previous = new Set(dashboardArtworks.map(keyFor).filter(Boolean));
            history.forEach(item => {
                if (typeof item?.rewardId === "string" && item.rewardId.startsWith("stars:artwork:")) previous.add(item.rewardId);
                if ([FIRST, FOURTH].includes(item?.rewardId)) ledger.add(item.rewardId);
            });
            previous.forEach(key => ledger.add(key));
            if (previous.size >= 1) ledger.add(FIRST);
            if (previous.size >= 4) ledger.add(FOURTH);
        }

        let stars = positive(saved.stars);
        const spending = { "pet-bow": 20, "artist-hat": 25, "star-background": 30,
            "pet-scarf": 35, "rainbow-shoes": 40, "festival-decor": 45 };
        const spent = (Array.isArray(saved.purchasedItems) ? saved.purchasedItems : [])
            .reduce((sum, id) => sum + (spending[id] || 0), 0);
        let total = saved.totalStarsEarned === undefined
            ? stars + spent : Math.max(positive(saved.totalStarsEarned), stars);

        function award(key, amount, description) {
            if (ledger.has(key)) return;
            ledger.add(key);
            stars += amount;
            total += amount;
            history.unshift({ id: key, rewardId: key, icon: "⭐", title: `+${amount} LIKHA Stars`,
                description, value: `+${amount}`, date: new Date().toLocaleDateString() });
        }

        [...dashboardArtworks, ...studioArtworks].forEach(artwork => {
            const key = keyFor(artwork);
            if (key) award(key, 15, `Saved artwork: ${artwork.title || "Untitled"}`);
        });
        const lifetimeArtworks = [...ledger].filter(key => key.startsWith("stars:artwork:")).length;
        if (lifetimeArtworks >= 1) award(FIRST, 5, "Saved your first artwork");
        if (lifetimeArtworks >= 4) award(FOURTH, 10, "Completed four saved artworks");

        return { ...saved, stars, totalStarsEarned: total, rewardHistory: history.slice(0, 30),
            artworkStarRewardsVersion: 1, artworkStarRewards: [...ledger] };
    }

    window.LikhaArtworkRewards = { reconcile };
})();
