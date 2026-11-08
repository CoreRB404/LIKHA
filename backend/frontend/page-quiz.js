import { $, api, node, announce, busy, dialog } from "./ui.js";

export async function init(context) {
  let account = context.account;
  const assessment =
    new URLSearchParams(location.search).get("assessment") || "weekly-identity";
  const info = await api(
    "/api/v1/quizzes/current?assessment=" + encodeURIComponent(assessment),
  );
  $("weeklyQuizTitle").textContent = info.assessment.title;
  $("quizLearnerName").textContent = account.display_name;
  $("quizAvatar").textContent = "🎨";
  $("quizBadgeCount").closest("span").hidden = true;
  $("completedQuizCount").textContent = info.attempts.length;
  $("bestQuizScore").textContent =
    (info.attempts.length
      ? Math.max(
          ...info.attempts.map((a) => Math.round((a.score / a.total) * 100)),
        )
      : 0) + "%";
  const earned = info.attempts
    .filter((a) => a.rewarded)
    .reduce((sum, a) => sum + a.score * 10, 0);
  $("quizTotalPoints").textContent = earned;
  $("lifetimeQuizPoints").textContent = earned;
  $("quizHistoryList").replaceChildren(
    ...info.attempts.map((a) =>
      node(
        "p",
        `${a.title}: ${a.score}/${a.total} · ${a.rewarded ? "Rewarded" : "Practice"}`,
      ),
    ),
  );
  document.querySelectorAll('a[href*="assessment="]').forEach((link) => {
    const target = new URL(link.href).searchParams.get("assessment");
    if (target)
      link.href = "/quiz.html?assessment=" + encodeURIComponent(target);
  });
  const section = $("quizGameSection");
  section.replaceChildren();
  let pendingId = crypto.randomUUID();
  $("startQuizBtn").addEventListener("click", () =>
    busy(
      $("startQuizBtn"),
      async () => {
        const { attempt } = await api("/api/v1/quiz-attempts", {
          method: "POST",
          body: { assessment, client_id: pendingId },
        });
        section.hidden = false;
        section.replaceChildren(node("h2", attempt.title));
        const form = node("form");
        for (const question of attempt.questions) {
          const group = node("fieldset", undefined, "host-question"),
            legend = node("legend", question.question);
          group.append(legend);
          for (const option of question.options) {
            const label = node("label", undefined, "host-option"),
              input = node("input");
            input.type = "radio";
            input.name = question.id;
            input.value = option.id;
            input.required = true;
            label.append(input, node("span", option.text));
            group.append(label);
          }
          form.append(group);
        }
        const submit = node("button", "Submit assessment", "host-button"),
          message = node("p");
        message.setAttribute("role", "status");
        submit.type = "submit";
        form.append(submit, message);
        section.append(form);
        section.scrollIntoView({ block: "start" });
        form.addEventListener("submit", (event) => {
          event.preventDefault();
          busy(
            submit,
            async () => {
              const answers = Object.fromEntries(new FormData(form));
              const result = await api(
                  `/api/v1/quiz-attempts/${attempt.id}/submit`,
                  { method: "POST", body: { answers } },
                ),
                graded = result.attempt;
              section.replaceChildren(
                node("h2", `You scored ${graded.score}/${graded.total}`),
                node(
                  "p",
                  graded.rewarded
                    ? `You earned ${graded.score * 10} stars. Your pet also earned growth from your quiz answers and completion.`
                    : "Practice completed. Weekly rewards were already claimed, or this attempt's reward window ended.",
                ),
              );
              for (const q of graded.questions) {
                const feedback = graded.feedback.find(
                  (item) => item.id === q.id,
                );
                const card = node("article", undefined, "host-question");
                card.append(
                  node("h3", q.question),
                  node("p", feedback.explanation),
                );
                section.append(card);
              }
              pendingId = crypto.randomUUID();
              $("weeklyQuizStatus").textContent =
                "Saved to your account. You may practice again.";
            },
            message,
          );
        });
      },
      $("weeklyQuizStatus"),
    ),
  );
}
