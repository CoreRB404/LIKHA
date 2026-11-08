function openLab(labName) {
    const validLabs = ["fashion", "festival", "craft", "art"];

    if (!validLabs.includes(labName)) {
        console.error("Invalid lab:", labName);
        return;
    }

    // Save the selected lab so the studio can identify it.
    try {
        localStorage.setItem("selectedLab", labName);
    } catch (error) {
        console.warn("Continuing with the lab in the URL:", error);
    }

    // Open the creative studio page.
    window.location.href = `studio.html?lab=${encodeURIComponent(labName)}`;
}

// =====================================
// LIVE DASHBOARD STATISTICS
// =====================================

function updateDashboardStatistics() {
    const savedState = localStorage.getItem("likhaDashboardPrototype_v1");
    let dashboardState = {};

    if (savedState) {
        try {
            const parsedState = JSON.parse(savedState);
            dashboardState = parsedState && typeof parsedState === "object"
                ? parsedState
                : {};
        } catch (error) {
            console.error("Could not load dashboard statistics:", error);
            return;
        }
    }

    const artworks = Array.isArray(dashboardState.artworks)
        ? dashboardState.artworks
        : [];
    let activities = Array.isArray(dashboardState.completedActivities)
        ? dashboardState.completedActivities
        : [];
    try {
        activities = JSON.parse(
            localStorage.getItem("likhaActivities") ||
            JSON.stringify(activities)
        );
        if (!Array.isArray(activities)) activities = [];
    } catch (error) {
        console.error("Could not load completed activities:", error);
    }

    const activitiesElement = document.getElementById("activitiesDoneCount");
    if (activitiesElement) {
        activitiesElement.textContent = activities.length;
    }

    const quizResults = dashboardState.quizResults &&
        typeof dashboardState.quizResults === "object"
        ? dashboardState.quizResults
        : {};
    const completedQuizzes = Object.values(quizResults).reduce(
        (total, attempts) => total + (Array.isArray(attempts) ? attempts.length : 0),
        0
    );
    const statistics = [
        ["artworksSavedCount", artworks.length],
        ["quizzesCompletedCount", completedQuizzes]
    ];

    statistics.forEach(([id, count]) => {
        const element = document.getElementById(id);
        if (element) element.textContent = count;
    });
}

document.addEventListener("DOMContentLoaded", updateDashboardStatistics);

window.addEventListener("storage", event => {
    if (
        event.key === "likhaDashboardPrototype_v1" ||
        event.key === "likhaActivities"
    ) {
        updateDashboardStatistics();
    }
});
