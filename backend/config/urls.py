from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, re_path

from accounts import views as auth
from accounts.admin import site
from core import pages
from learning import views as learning

urlpatterns = [
    path("", pages.home, name="home"),
    path("index.html", pages.legacy_redirect, {"target": "/"}),
    path("favicon.ico", pages.legacy_redirect, {"target": "/static/favicon.ico"}),
    re_path(r"^\.vscode/(?P<name>[a-z-]+)\.html$", pages.vscode_redirect),
    path(".vscode/weekly-quiz.html/index.html", pages.legacy_redirect, {"target": "/quiz/"}),
    path("accounts/<str:page>/", auth.account_page),
    path("health/live", pages.health),
    path("health/ready", pages.health, {"ready": True}),
    path("admin/", site.urls),
    path("api/v1/session", auth.session),
    path("api/v1/auth/signup", auth.signup),
    path("api/v1/auth/login", auth.sign_in), path("api/v1/auth/logout", auth.sign_out),
    path("api/v1/me", auth.me), path("api/v1/me/export", learning.export_account),
    path("api/v1/me/password", auth.change_password),
    path("api/v1/progress", learning.progress_view), path("api/v1/labs", learning.labs),
    path("api/v1/dashboard", learning.dashboard),
    path("api/v1/artworks", learning.artworks),
    path("api/v1/artworks/<uuid:art_id>", learning.artwork),
    path("api/v1/artworks/<uuid:art_id>/image", learning.artwork_image),
    path("api/v1/imports/artworks", learning.import_artwork),
    path("api/v1/quizzes/current", learning.quizzes),
    path("api/v1/quiz-attempts", learning.attempts),
    path("api/v1/quiz-attempts/<uuid:attempt_id>", learning.attempt),
    path("api/v1/quiz-attempts/<uuid:attempt_id>/submit", learning.attempt),
    path("api/v1/challenges/<slug:challenge_id>/complete", learning.complete_challenge),
    *[path(name + "/", pages.page, {"name": name}, name=name) for name in pages.PAGE_NAMES],
    re_path(r"^(?P<name>dashboard|studio|gallery|avatar|pet|quiz|settings)\.html$", pages.legacy_page),
    path("challenges.html", pages.legacy_redirect, {"target": "/dashboard/#dailyChallenge"}),
    path("grow-a-pet.html", pages.legacy_redirect, {"target": "/pet/"}),
    path("weekly-quiz.html", pages.legacy_redirect, {"target": "/quiz/"}),
]
if settings.DEBUG:
    urlpatterns += static(settings.STATIC_URL, document_root=settings.PUBLIC_ROOT)

handler404 = pages.error_page
handler403 = lambda request, exception: pages.error_page(request, exception, 403)
handler500 = lambda request: pages.error_page(request, status=500)
