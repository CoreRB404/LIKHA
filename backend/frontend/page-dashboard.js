import { $, api, node, busy, dialog, announce } from "./ui.js";

// Original HTML/CSS own the design; this module supplies account data only.
export async function init(context) {
  let account = context.account;
  const [data, catalog] = await Promise.all([
    api("/api/v1/dashboard"),
    api("/api/v1/labs"),
  ]);
  const progress = data.progress;
  const weeklyAssessments = data.assessments.filter((item) =>
    /^week[1-6]$/.test(item.slug),
  );
  const stages = ["baby", "growing", "young", "grown"];
  const stageNames = {
    baby: "Baby Pet",
    growing: "Growing Pet",
    young: "Young Pet",
    grown: "Grown Pet",
  };
  const text = (id, value) => {
    if ($(id)) $(id).textContent = value;
  };
  const percent = (id, value) => {
    const element = $(id);
    if (!element) return;
    (element.querySelector("span,div") || element).style.width =
      Math.min(100, Math.max(0, value)) + "%";
    if (element.getAttribute("role") === "progressbar")
      element.setAttribute("aria-valuenow", Math.round(value));
  };
  function picture(container, src, alt, className = "") {
    const image = node("img", undefined, className);
    image.src = src;
    image.alt = alt;
    image.decoding = "async";
    container.replaceChildren(image);
    return image;
  }
  const descriptions = {
    fashion: "Design clothing inspired by Filipino textiles and patterns.",
    festival: "Draw a parol or festival mask.",
    craft: "Explore shapes, colors, and craft-inspired patterns.",
    art: "Create original artwork expressing Filipino identity.",
  };
  for (const id of ["dashboardLabs", "studioLabs"])
    for (const [key, lab] of Object.entries(catalog.labs)) {
      const card = node("article", undefined, `lab-card ${key}-lab`),
        icon = node("div", undefined, "lab-icon");
      const image = picture(icon, lab.image, lab.title);
      image.width = image.height = 180;
      const body = node("div", undefined, "lab-body"),
        link = node("a", "Start Creating →", "lab-open");
      link.href = "/studio/?lab=" + key;
      body.append(node("h3", lab.title), node("p", descriptions[key]), link);
      card.append(icon, body);
      $(id).append(card);
    }
  function renderAccount() {
    text("welcomeName", account.display_name);
    text("dashboardAvatarName", account.display_name);
    for (const id of ["dashboardAvatar", "topAvatar"])
      picture(
        $(id),
        `/static/images/avatar-filipino-artist-${account.avatar}.webp`,
        account.display_name,
      );
  }
  renderAccount();
  for (const [id, value] of Object.entries({
    starBalance: progress.stars,
    artworksSavedCount: progress.artwork_count,
    activitiesDoneCount: data.activity_count,
    quizzesCompletedCount: data.quiz.count,
  }))
    text(id, value);
  let selectedAvatar = account.avatar;
  function previewAvatar() {
    picture(
      $("avatarLargePreview"),
      `/static/images/avatar-filipino-artist-${selectedAvatar}.webp`,
      "Selected avatar",
    );
    $("avatarFaceInput").value = "avatar-filipino-artist-" + selectedAvatar;
  }
  $("avatarNameInput").maxLength = 60;
  $("avatarNameInput").value = account.display_name;
  $("avatarFaceInput").addEventListener("change", (event) => {
    selectedAvatar = Number(event.target.value.split("-").at(-1));
    previewAvatar();
  });
  $("resetAvatar").addEventListener("click", () => {
    selectedAvatar = 1;
    $("avatarNameInput").value = account.display_name;
    previewAvatar();
  });
  $("saveAvatar").addEventListener("click", () =>
    busy($("saveAvatar"), async () => {
      const result = await api("/api/v1/me", {
        method: "PATCH",
        body: {
          avatar: selectedAvatar,
          display_name: $("avatarNameInput").value,
          version: account.version,
        },
      });
      account = result.profile;
      renderAccount();
      announce("Your avatar is saved.");
    }),
  );
  previewAvatar();
  let selectedPet = progress.pet.species;
  function renderPet() {
    const current = stages.indexOf(progress.stage),
      lower = [0, 4, 10, 16][current],
      upper = [4, 10, 16, 16][current];
    const value =
      current === 3
        ? 100
        : Math.min(
            100,
            ((progress.growth_units - lower) / (upper - lower)) * 100,
          );
    picture(
      $("dashboardPetEmoji"),
      `/static/images/pets/${progress.pet.species}-${progress.stage}-v1.webp`,
      progress.pet.name,
      "pet-growth-image",
    );
    picture(
      $("petLargeEmoji"),
      `/static/images/pets/${selectedPet}-${progress.stage}-v1.webp`,
      "Selected pet",
      "pet-growth-image",
    );
    for (const id of ["dashboardPetName", "petLargeName"])
      text(id, progress.pet.name);
    for (const id of ["dashboardPetStage", "petLargeStage", "progressPetStage"])
      text(id, stageNames[progress.stage]);
    for (const id of [
      "dashboardPetProgress",
      "petLargeProgress",
      "progressPetBar",
    ])
      percent(id, value);
    const caption =
      current === 3
        ? "Your companion is fully grown!"
        : `${progress.growth_units / 2} growth activities · ${Math.round(value)}% to next stage`;
    for (const id of [
      "dashboardPetProgressText",
      "petLargeProgressText",
      "progressPetNext",
    ])
      text(id, caption);
    document
      .querySelectorAll("#petGrowthJourney [data-stage]")
      .forEach((card) => {
        const index = stages.indexOf(card.dataset.stage);
        card.querySelector("img").src =
          `/static/images/pets/${selectedPet}-${card.dataset.stage}-v1.webp`;
        card.classList.toggle("is-current", index === current);
        card.classList.toggle("is-completed", index < current);
        card.classList.toggle("is-locked", index > current);
      });
    document.querySelectorAll("[data-pet]").forEach((button) => {
      const active = button.dataset.pet === selectedPet;
      button.classList.toggle("selected", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }
  $("petNameInput").value = progress.pet.name;
  document.querySelectorAll("[data-pet]").forEach((button) =>
    button.addEventListener("click", () => {
      selectedPet = button.dataset.pet;
      renderPet();
    }),
  );
  $("savePet").addEventListener("click", () =>
    busy($("savePet"), async () => {
      const result = await api("/api/v1/me", {
        method: "PATCH",
        body: {
          pet_species: selectedPet,
          pet_name: $("petNameInput").value,
          version: account.version,
        },
      });
      account = result.profile;
      progress.pet = { species: selectedPet, name: $("petNameInput").value };
      renderPet();
      announce("Your pet is saved.");
    }),
  );
  renderPet();
  for (const id of ["dashboardAssessments", "fullAssessments"])
    for (const assessment of weeklyAssessments) {
      const item = node("div", undefined, "assessment-item"),
        details = node("div", undefined, "assessment-details");
      details.append(
        node("h4", assessment.title),
        node(
          "p",
          assessment.attempts
            ? `Best score: ${assessment.best}% · ${assessment.attempts} attempt(s)`
            : "Not attempted yet",
        ),
      );
      const button = node(
        "button",
        assessment.attempts ? "Practice Again" : "Start Quiz",
        "assessment-button" + (assessment.attempts ? " done" : ""),
      );
      button.addEventListener("click", () =>
        location.assign("/quiz/?assessment=" + assessment.slug),
      );
      item.append(node("div", "🧠", "assessment-icon"), details, button);
      $(id).append(item);
    }
  const challenges = Object.entries(catalog.challenges);
  let challengeIndex = Math.floor(Date.now() / 86400000) % challenges.length;
  function renderChallenge() {
    const [, challenge] = challenges[challengeIndex];
    text("challengeTitle", challenge.title);
    text("challengeDescription", challenge.description);
    text("challengeLab", catalog.labs[challenge.lab].title.toUpperCase());
    text(
      "challengeIcon",
      { fashion: "👗", festival: "🏮", craft: "🧶", art: "🎨" }[challenge.lab],
    );
  }
  $("anotherChallengeBtn").addEventListener("click", () => {
    challengeIndex = (challengeIndex + 1) % challenges.length;
    renderChallenge();
  });
  $("startChallengeBtn").addEventListener("click", () => {
    const [id, challenge] = challenges[challengeIndex];
    location.assign(`/studio/?lab=${challenge.lab}&challenge=${id}`);
  });
  renderChallenge();
  const modal = $("quizModal");
  modal.hidden = true;
  $("submitQuiz").hidden = true;
  const preview = dialog(modal, {
    initialFocus: $("closeQuiz"),
    onClose: () => $("quizBody").replaceChildren(),
  });
  $("closeQuiz").addEventListener("click", preview.close);
  function artworkCard(art) {
    const card = node("article", undefined, "artwork-card"),
      image = node("div", undefined, "artwork-preview"),
      meta = node("div", undefined, "artwork-meta");
    picture(image, art.image_url, art.title);
    const button = node("button", "View details →", "text-link");
    button.addEventListener("click", () => {
      text("quizModalTitle", art.title);
      text("quizIntro", catalog.labs[art.lab].title);
      picture($("quizBody"), art.image_url, art.title);
      for (const [key, value] of Object.entries(art.concepts))
        $("quizBody").append(node("p", `${key}: ${value}`));
      preview.open(button);
    });
    meta.append(
      node("h4", art.title),
      node("p", catalog.labs[art.lab].title),
      node("p", new Date(art.created_at).toLocaleDateString()),
      button,
    );
    card.dataset.artworkId = art.id;
    card.append(image, meta);
    return card;
  }
  function renderGallery(id, records) {
    const target = $(id);
    target.replaceChildren();
    if (!records.length) {
      const empty = node("div", undefined, "empty-state");
      empty.append(
        node("span", "🖼️"),
        node("strong", "Your gallery is waiting for its first masterpiece!"),
        node("p", "Create an artwork and save it to see it here."),
      );
      target.append(empty);
    } else {
      const grid = node("div", undefined, "gallery-grid");
      grid.append(...records.map(artworkCard));
      target.append(grid);
    }
  }
  renderGallery("dashboardGallery", data.artworks);
  let allArtworks;
  async function fullGallery() {
    if (!allArtworks) {
      allArtworks = [];
      let cursor = 0;
      do {
        const page = await api("/api/v1/artworks?limit=100&cursor=" + cursor);
        allArtworks.push(...page.artworks);
        cursor = page.next_cursor;
      } while (cursor !== null);
    }
    renderGallery("fullGallery", allArtworks);
  }
  const badges = [
    [
      "🎨",
      "First Creation",
      "Save your first original artwork.",
      progress.completed_artworks >= 1,
    ],
    [
      "🧠",
      "Curious Thinker",
      "Complete your first weekly quiz.",
      data.quiz.count > 0,
    ],
    [
      "🌟",
      "Art Explorer",
      "Save artworks in at least two different Creative Labs.",
      Object.keys(data.lab_counts).length >= 2,
    ],
    [
      "🏆",
      "Filipino Identity Champion",
      "Score 80% or higher in a Filipino identity assessment.",
      data.quiz.identity_champion,
    ],
    [
      "🐾",
      "Caring Creator",
      "Help your pet reach the Growing Pet stage.",
      progress.growth_units >= 4,
    ],
    [
      "🖌️",
      "Creative Master",
      "Save four original artworks.",
      progress.completed_artworks >= 4,
    ],
  ];
  const unlocked = badges.filter((b) => b[3]).length;
  for (const [id, kind] of [
    ["achievementGrid", "achievement"],
    ["progressBadges", "progress-badge"],
  ])
    for (const [icon, title, requirement, earned] of badges) {
      const card = node(
        "article",
        undefined,
        `${kind}-card ${earned ? (kind === "achievement" ? "unlocked" : "is-unlocked") : "locked"}`,
      );
      card.append(
        node(
          "div",
          icon,
          kind === "achievement" ? "achievement-icon" : "progress-badge-icon",
        ),
        node(kind === "achievement" ? "h3" : "h4", title),
        node("p", requirement),
        node(
          "span",
          earned ? "Unlocked" : "Keep creating!",
          kind === "achievement"
            ? "achievement-status"
            : "progress-badge-state",
        ),
      );
      $(id).append(card);
    }
  text(
    "achievementProgressText",
    `You've unlocked ${unlocked} out of ${badges.length} achievements!`,
  );
  percent("achievementProgressFill", (unlocked / badges.length) * 100);
  for (const [id, value] of Object.entries({
    progressStars: progress.lifetime_stars,
    progressQuizzes: data.quiz.count,
    progressArtworks: progress.artwork_count,
    progressAchievements: unlocked,
    progressCorrectAnswers: data.quiz.correct,
    progressQuizPoints: data.quiz.stars,
    progressPetPoints: progress.growth_units / 2,
    progressQuizPetPoints: data.quiz.growth_units / 2,
    progressPetName: progress.pet.name,
    progressCreatedArtworks: progress.artwork_count,
    progressChallenges: progress.completed_challenges.length,
  }))
    text(id, value);
  const attempted = weeklyAssessments.filter((a) => a.attempts).length,
    overall = Math.round(
      ((attempted + Object.keys(data.lab_counts).length) /
        (weeklyAssessments.length + 4)) *
        100,
    );
  text("progressOverallPercent", overall + "%");
  text(
    "progressOverallDetail",
    `${attempted} assessments completed · ${Object.keys(data.lab_counts).length} Creative Labs explored`,
  );
  percent("progressOverallBar", overall);
  for (const [key, id] of [
    ["latest", "progressLatestScore"],
    ["highest", "progressHighestScore"],
    ["average", "progressAverage"],
  ])
    text(id, data.quiz[key] === null ? "—" : data.quiz[key] + "%");
  const favorite = Object.entries(data.lab_counts).sort(
    (a, b) => b[1] - a[1],
  )[0];
  text(
    "progressFavoriteLab",
    favorite ? catalog.labs[favorite[0]].title : "Not yet explored",
  );
  for (const [lab, count] of Object.entries(data.lab_counts))
    $("labProgressList").append(
      node(
        "p",
        `${catalog.labs[lab].title}: ${count} saved artwork(s)`,
        "history-item",
      ),
    );
  for (const art of data.artworks.slice(0, 3)) {
    const card = node("article", undefined, "progress-artwork-card");
    card.append(
      node("strong", art.title),
      node("span", catalog.labs[art.lab].title),
    );
    $("progressRecentArtworks").append(card);
  }
  function meter(label, value) {
    const track = node("div", undefined, "progress-mini-track");
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", label);
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    track.setAttribute("aria-valuenow", String(Math.min(100, value)));
    const fill = node("span");
    fill.style.width = Math.min(100, value) + "%";
    track.append(fill);
    return track;
  }
  const concepts = {
    Subject: "The people, objects, places, or events shown in art.",
    Theme: "The main idea or message an artwork communicates.",
    Form: "How visual elements are organized into an artwork.",
    Style: "The artist's recognizable way of making art.",
    Symbolism: "Images or objects that stand for meaningful ideas.",
    Medium: "The materials or tools used to create an artwork.",
  };
  for (const [concept, description] of Object.entries(concepts)) {
    const card = node("article", undefined, "progress-skill-card"),
      categories = Object.entries(data.quiz.categories)
        .filter(([category]) =>
          category.toLowerCase().includes(concept.toLowerCase()),
        )
        .map(([, value]) => value);
    const answered = categories.reduce((sum, item) => sum + item.answered, 0),
      correct = categories.reduce((sum, item) => sum + item.correct, 0);
    card.append(
      node("h4", concept),
      node("p", description),
      node(
        "span",
        answered
          ? `${Math.round((correct / answered) * 100)}% quiz accuracy · ${answered} question(s)`
          : "Not yet assessed",
        "progress-measure",
      ),
    );
    if (answered)
      card.insertBefore(
        meter(
          concept + " quiz accuracy",
          Math.round((correct / answered) * 100),
        ),
        card.querySelector(".progress-measure"),
      );
    if (data.concept_counts[concept.toLowerCase()])
      card.append(
        node(
          "span",
          `Explored in ${data.concept_counts[concept.toLowerCase()]} saved artwork(s)`,
          "progress-measure",
        ),
      );
    $("artisticSkills").append(card);
  }
  for (const kind of ["Historical", "Cultural", "National"]) {
    const explored =
        data.quiz.categories[kind + " Filipino Identity"]?.explored || 0,
      card = node("article", undefined, "progress-identity-card");
    card.append(
      node("h4", kind + " Identity"),
      node("p", `${explored} questions explored`, "progress-measure"),
    );
    card.insertBefore(
      meter(kind + " identity questions explored", (explored / 5) * 100),
      card.lastElementChild,
    );
    $("identityJourney").append(card);
  }
  for (const reward of progress.recent_rewards) {
    const title = reward.key.startsWith("quiz:")
      ? "Assessment completed"
      : reward.key.startsWith("milestone:")
        ? "Creative milestone"
        : "Artwork saved";
    const row = node("div", undefined, "history-row");
    const details = node("div", undefined, "history-text");
    details.append(
      node("strong", title),
      node("p", new Date(reward.created_at).toLocaleDateString()),
    );
    row.append(
      node("span", "?", "history-icon"),
      details,
      node("div", "+" + reward.stars, "history-value"),
    );
    $("activityHistory").append(row);
  }
  if (!progress.recent_rewards.length) {
    const empty = node("div", undefined, "empty-state");
    empty.append(
      node("span", "??"),
      node(
        "p",
        "Your progress history will appear here after your first activity.",
      ),
    );
    $("activityHistory").append(empty);
  }
  const next = node("button", "Explore your Creative Labs →", "primary-btn");
  next.dataset.go = "studio";
  $("progressNextStep").append(next);
  const svg = $("quizScoreChart"),
    ns = "http://www.w3.org/2000/svg";
  function svgNode(tag, attrs, content) {
    const el = document.createElementNS(ns, tag);
    for (const [key, value] of Object.entries(attrs))
      el.setAttribute(key, String(value));
    if (content) el.textContent = content;
    return el;
  }
  svg.append(
    svgNode("title", { id: "quizChartTitle" }, "Recent quiz scores"),
    svgNode(
      "desc",
      { id: "quizChartDescription" },
      "Your scores out of 100 percent, oldest to newest.",
    ),
  );
  const chart = data.quiz.recent.slice().reverse();
  if (!chart.length)
    svg.append(
      svgNode(
        "text",
        { x: 35, y: 110, fill: "#756b5a" },
        "Complete a quiz to see your learning progress.",
      ),
    );
  else {
    const points = chart.map((a, i) => [
      35 + (i * 570) / Math.max(1, chart.length - 1),
      200 - a.percentage * 1.7,
    ]);
    svg.append(
      svgNode("polyline", {
        points: points.map((p) => p.join(",")).join(" "),
        fill: "none",
        stroke: "#d8a52c",
        "stroke-width": 4,
      }),
    );
    points.forEach(([x, y], i) =>
      svg.append(
        svgNode("circle", { cx: x, cy: y, r: 5, fill: "#3679c7" }),
        svgNode(
          "text",
          { x, y: y - 12, "text-anchor": "middle", fill: "#443629" },
          chart[i].percentage + "%",
        ),
      ),
    );
  }
  const views = {
    dashboard: ["My Creative Dashboard", "Your imagination starts here!"],
    studio: ["Creative Labs", "Choose a lab and make something original."],
    gallery: ["My LIKHA Gallery", "Your saved creations, all in one place."],
    avatar: ["My Avatar", "Customize your creative character."],
    pet: ["Grow-a-Pet", "Your companion grows as you complete activities."],
    assessments: ["Weekly Assessments", "Practice, learn, and try again."],
    progress: ["My Progress", "See your creative and learning milestones."],
  };
  const mobile = window.matchMedia("(max-width: 850px)");
  function closeMenu(restoreFocus = false) {
    $("dashboardSidebar").classList.remove("is-open");
    $("dashboardMenuToggle").setAttribute("aria-expanded", "false");
    $("dashboardMenuClose").hidden = true;
    if (restoreFocus) $("dashboardMenuToggle").focus();
  }
  $("dashboardMenuToggle").addEventListener("click", () => {
    $("dashboardSidebar").classList.add("is-open");
    $("dashboardMenuToggle").setAttribute("aria-expanded", "true");
    $("dashboardMenuClose").hidden = false;
    $("dashboardMenuClose").focus();
    window.scrollTo({ top: 0, behavior: "instant" });
  });
  $("dashboardMenuClose").addEventListener("click", () => closeMenu(true));
  $("dashboardSidebar").addEventListener("keydown", (event) => {
    if (event.key === "Escape" && mobile.matches) closeMenu(true);
  });
  mobile.addEventListener("change", () => {
    if (!mobile.matches) closeMenu();
  });
  function openView(name) {
    if (!views[name]) return;
    document
      .querySelectorAll(".view")
      .forEach((view) =>
        view.classList.toggle("active", view.id === "view-" + name),
      );
    document.querySelectorAll(".nav-item[data-view]").forEach((button) => {
      button.classList.toggle("active", button.dataset.view === name);
      if (button.dataset.view === name)
        button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    });
    text("pageTitle", views[name][0]);
    text("pageSubtitle", views[name][1]);
    if (name === "gallery")
      fullGallery().catch((error) => announce(error.message));
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  document.addEventListener("click", (event) => {
    const button = event.target.closest("[data-go],[data-view]");
    if (button) {
      closeMenu();
      location.hash = button.dataset.go || button.dataset.view;
    }
  });
  for (const id of ["welcomeCreate", "sidebarCreate"])
    $(id).addEventListener("click", () => {
      location.hash = "choose-lab";
    });
  $("topAvatar").addEventListener("click", () => {
    location.hash = "avatar";
  });
  document.querySelector(".view-progress-btn").addEventListener("click", () =>
    $("myAchievements").scrollIntoView({
      behavior: "smooth",
      block: "start",
    }),
  );
  function fromHash() {
    const hash = location.hash.slice(1);
    openView(
      hash === "choose-lab"
        ? "studio"
        : hash === "dailyChallenge"
          ? "dashboard"
          : views[hash]
            ? hash
            : "dashboard",
    );
    if (hash === "dailyChallenge") $("dailyChallenge").scrollIntoView();
  }
  window.addEventListener("hashchange", fromHash);
  fromHash();
}
