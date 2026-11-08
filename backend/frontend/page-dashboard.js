import { $, api, node, announce, busy, dialog } from "./ui.js";

export async function init(context) {
  let account = context.account;
  const [{ progress }, quizzes] = await Promise.all([
    api("/api/v1/progress"),
    api("/api/v1/quizzes/current"),
  ]);
  $("dashboardStars").textContent = progress.stars;
  $("dashboardArtworks").textContent = progress.artwork_count;
  $("dashboardPet").src =
    `/static/images/pets/${progress.pet.species}-${progress.stage}-v1.webp`;
  $("dashboardStage").textContent =
    `${progress.pet.name} · ${progress.stage} · ${progress.growth_units / 2} growth activities`;
  for (const assessment of quizzes.assessments) {
    const link = node("a", assessment.title, "host-button secondary");
    link.href = "/quiz.html?assessment=" + assessment.slug;
    $("assessmentLinks").append(link);
  }
  const list = $("rewardHistory");
  if (!progress.recent_rewards.length)
    list.append(node("p", "Your first creation starts your learning journey."));
  for (const reward of progress.recent_rewards)
    list.append(
      node(
        "p",
        `+${reward.stars} stars · +${reward.growth / 2} growth · ${reward.key.startsWith("artwork:") ? "Artwork saved" : reward.key.includes("artwork:first") ? "First artwork bonus" : reward.key.includes("artwork:fourth") ? "Fourth artwork bonus" : reward.key.startsWith("quiz:") ? "Assessment completed" : "Learning progress"}`,
      ),
    );
}
