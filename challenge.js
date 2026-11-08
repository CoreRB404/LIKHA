const creativeChallenges = [
    {
        id: "parol-design",
        title: "Design a Colorful Parol",
        lab: "festival",
        icon: "🏮",
        description: "Create a colorful parol using shapes, patterns, and decorations inspired by Filipino Christmas traditions.",
        hint: "💡 Experiment with stars, geometric shapes, and bright colors."
    },
    {
        id: "textile-fashion",
        title: "Fashion Meets Filipino Patterns",
        lab: "fashion",
        icon: "👗",
        description: "Design an original outfit using colors and patterns inspired by Filipino textiles.",
        hint: "💡 Try repeating patterns and combining different colors."
    },
    {
        id: "festival-poster",
        title: "Celebrate Filipino Festivals",
        lab: "festival",
        icon: "🎉",
        description: "Create a festival poster that expresses the energy and joy of a Filipino celebration.",
        hint: "💡 Combine a bold title, decorative shapes, and a lively background."
    },
    {
        id: "community-art",
        title: "Art That Brings Us Together",
        lab: "art",
        icon: "🤝",
        description: "Create an artwork that represents unity, cooperation, and community.",
        hint: "💡 Think about the people, places, or symbols that represent togetherness."
    },
    {
        id: "craft-pattern",
        title: "Create a Craft-Inspired Pattern",
        lab: "craft",
        icon: "🧶",
        description: "Design an original pattern using geometric shapes, lines, and repeating decorations.",
        hint: "💡 Try repeating shapes to create a balanced design."
    },
    {
        id: "abstract-art",
        title: "Colors and Emotions",
        lab: "art",
        icon: "🎨",
        description: "Create an abstract composition using colors and shapes to express an emotion or idea.",
        hint: "💡 There is no single correct way to express an emotion through art."
    },
    {
        id: "cultural-fashion",
        title: "Design Your Own Cultural-Inspired Outfit",
        lab: "fashion",
        icon: "🪡",
        description: "Create an original clothing design inspired by Filipino creativity and cultural patterns.",
        hint: "💡 Use cultural inspiration respectfully while developing your own design."
    },
    {
        id: "decorative-craft",
        title: "Make Something Decorative",
        lab: "craft",
        icon: "✂️",
        description: "Create a decorative composition using shapes, borders, and colors.",
        hint: "💡 Try balancing large shapes with smaller details."
    }
];

const labNames = {
    fashion: "FASHION LAB",
    festival: "FESTIVAL LAB",
    craft: "CRAFT LAB",
    art: "ART LAB"
};

const challengeIcon = document.getElementById("challengeIcon");
const challengeTitle = document.getElementById("challengeTitle");
const challengeLab = document.getElementById("challengeLab");
const challengeDescription = document.getElementById("challengeDescription");
const challengeHint = document.getElementById("challengeHint");

const startChallengeBtn = document.getElementById("startChallengeBtn");
const anotherChallengeBtn = document.getElementById("anotherChallengeBtn");

let currentChallenge = null;

function displayChallenge(challenge) {
    currentChallenge = challenge;

    challengeIcon.textContent = challenge.icon;
    challengeTitle.textContent = challenge.title;
    challengeLab.textContent = labNames[challenge.lab];
    challengeDescription.textContent = challenge.description;
    challengeHint.textContent = challenge.hint;

    // Preserve the current challenge when the page is refreshed.
    localStorage.setItem(
        "likhaCurrentChallenge",
        JSON.stringify(challenge)
    );
}

function chooseAnotherChallenge() {
    let options = creativeChallenges;

    if (currentChallenge) {
        options = creativeChallenges.filter(
            challenge => challenge.id !== currentChallenge.id
        );
    }

    const randomIndex = Math.floor(Math.random() * options.length);

    displayChallenge(options[randomIndex]);
}

function startChallenge() {
    if (!currentChallenge) {
        return;
    }

    // Save the challenge before opening the Creative Studio.
    localStorage.setItem(
        "likhaActiveChallenge",
        JSON.stringify(currentChallenge)
    );

    localStorage.setItem(
        "selectedLab",
        currentChallenge.lab
    );

    // Open the existing studio.
    window.location.href = `studio.html?lab=${encodeURIComponent(currentChallenge.lab)}`;
}

anotherChallengeBtn.addEventListener(
    "click",
    chooseAnotherChallenge
);

startChallengeBtn.addEventListener(
    "click",
    startChallenge
);

// Restore the previous challenge when possible.
try {
    const savedChallenge = JSON.parse(
        localStorage.getItem("likhaCurrentChallenge") || "null"
    );

    const validChallenge = creativeChallenges.find(
        challenge => challenge.id === savedChallenge?.id
    );

    if (validChallenge) {
        displayChallenge(validChallenge);
    } else {
        chooseAnotherChallenge();
    }
} catch (error) {
    console.error("Could not restore challenge:", error);
    chooseAnotherChallenge();
}
