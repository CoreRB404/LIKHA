import { $, api, node, announce, busy } from "./ui.js";

// Keep the original one-question-at-a-time game and original results card.
// The server supplies opaque choices and grades the finished attempt.
export async function init(context) {
  const assessment =
    new URLSearchParams(location.search).get("assessment") || "weekly-identity";
  const info = await api(
    "/api/v1/quizzes/current?assessment=" + encodeURIComponent(assessment),
  );
  $("weeklyQuizTitle").textContent = info.assessment.title;
  $("quizLearnerName").textContent = context.account.display_name;
  $("quizAvatar").textContent = "🎨";
  $("quizQuestionCount").textContent = info.assessment.question_count;
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
  for (const item of info.attempts) {
    const entry = node("article", undefined, "history-entry");
    entry.append(
      node("strong", item.title),
      node(
        "p",
        `${item.score}/${item.total} · ${item.rewarded ? "Rewarded" : "Practice"}`,
      ),
    );
    $("quizHistoryList").append(entry);
  }
  document.querySelectorAll('a[href*="assessment="]').forEach((link) => {
    const value = new URL(link.href).searchParams.get("assessment");
    if (value) link.href = "/quiz.html?assessment=" + encodeURIComponent(value);
  });
  const section = $("quizGameSection"),
    results = $("quizResultsSection");
  let pendingId = crypto.randomUUID(),
    attempt,
    index = 0,
    answers = {};
  function question() {
    const item = attempt.questions[index];
    $("gameQuizTitle").textContent = attempt.title;
    $("questionCounter").textContent =
      `Question ${index + 1} of ${attempt.questions.length}`;
    $("questionCategory").textContent = item.category;
    $("questionText").textContent = item.question;
    $("liveScore").textContent = "—";
    $("answerFeedback").hidden = true;
    $("questionImageWrap").hidden = true;
    const percentage = Math.round((index / attempt.questions.length) * 100);
    $("quizProgressFill").style.width = percentage + "%";
    $("quizProgressBar").setAttribute("aria-valuenow", String(percentage));
    $("answerOptions").replaceChildren();
    $("nextQuestionBtn").disabled = !answers[item.id];
    $("nextQuestionBtn").textContent =
      index === attempt.questions.length - 1
        ? "See Results →"
        : "Next Question →";
    item.options.forEach((option, displayIndex) => {
      const button = node(
        "button",
        `${"ABCD"[displayIndex]}. ${option.text}`,
        "answer-option",
      );
      button.type = "button";
      button.setAttribute(
        "aria-pressed",
        String(answers[item.id] === option.id),
      );
      if (answers[item.id] === option.id) button.classList.add("selected");
      button.addEventListener("click", () => {
        answers[item.id] = option.id;
        question();
        $("answerOptions").children[displayIndex].focus();
      });
      $("answerOptions").append(button);
    });
  }
  function showResults(graded) {
    section.hidden = true;
    results.hidden = false;
    $("resultHeading").textContent =
      `You scored ${graded.score}/${graded.total}`;
    $("resultMessage").textContent = graded.rewarded
      ? "Your quiz rewards have been added to your account."
      : "Practice completed. Your results are saved.";
    $("resultPercentage").textContent =
      Math.round((graded.score / graded.total) * 100) + "%";
    $("resultCorrect").textContent = graded.score;
    $("resultTotal").textContent = graded.total;
    $("resultPoints").textContent =
      "+" + (graded.rewarded ? graded.score * 10 : 0);
    $("resultPetPoints").textContent =
      "+" + (graded.rewarded ? graded.score + 1 : 0);
    $("answerReviewList").replaceChildren();
    for (const item of graded.questions) {
      const feedback = graded.feedback.find((value) => value.id === item.id),
        card = node("article", undefined, "review-item");
      const correct = answers[item.id] === feedback.answer;
      card.append(
        node("h4", item.question),
        node(
          "p",
          correct ? "Correct" : "Keep learning!",
          correct ? "right" : "wrong",
        ),
        node("p", feedback.explanation),
      );
      $("answerReviewList").append(card);
    }
    $("weeklyQuizStatus").textContent =
      "Saved to your account. You may practice again.";
    pendingId = crypto.randomUUID();
    results.scrollIntoView({ block: "start" });
  }
  async function start() {
    const result = await api("/api/v1/quiz-attempts", {
      method: "POST",
      body: { assessment, client_id: pendingId },
    });
    if (attempt?.id !== result.attempt.id) answers = {};
    attempt = result.attempt;
    index = 0;
    if (attempt.submitted) {
      showResults(attempt);
      return;
    }
    results.hidden = true;
    section.hidden = false;
    question();
    section.scrollIntoView({ block: "start" });
  }
  $("startQuizBtn").addEventListener("click", () =>
    busy($("startQuizBtn"), start, $("weeklyQuizStatus")),
  );
  $("retryQuizBtn").addEventListener("click", () =>
    busy($("retryQuizBtn"), start, $("weeklyQuizStatus")),
  );
  $("exitQuizBtn").addEventListener("click", () => {
    section.hidden = true;
    $("weeklyQuizCard").scrollIntoView({ block: "start" });
  });
  $("nextQuestionBtn").addEventListener("click", () => {
    if (index < attempt.questions.length - 1) {
      index += 1;
      question();
      $("questionText").tabIndex = -1;
      $("questionText").focus();
      return;
    }
    busy($("nextQuestionBtn"), async () => {
      const result = await api(`/api/v1/quiz-attempts/${attempt.id}/submit`, {
        method: "POST",
        body: { answers },
      });
      showResults(result.attempt);
    }).catch((error) => announce(error.message));
  });
}
