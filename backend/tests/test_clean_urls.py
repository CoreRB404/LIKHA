from urllib.parse import parse_qs, urlsplit
from django.test import Client, TestCase
from django.urls import reverse
from accounts.models import User
from tests.test_backend import MediaMixin, PASSWORD


class CleanURLTests(MediaMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.owner = User.objects.create_user('clean-url-artist', PASSWORD)

    def test_canonical_pages_require_login_and_preserve_original_templates(self):
        names = ['dashboard','studio','gallery','avatar','pet','quiz','settings']
        for name in names:
            path = reverse(name)
            self.assertEqual(path, '/' + name + '/')
            response = self.client.get(path)
            self.assertEqual(response.status_code, 302)
            self.assertEqual(urlsplit(response['Location']).path, '/accounts/login/')
            self.assertEqual(parse_qs(urlsplit(response['Location']).query)['next'], [path])
        self.client.force_login(self.owner)
        for name in names:
            self.assertEqual(self.client.get(reverse(name)).status_code, 200)
        self.assertContains(self.client.get('/dashboard/'), 'class="welcome-banner"')
        self.assertEqual(self.client.get('/dashboard')['Location'], '/dashboard/')

    def test_old_urls_redirect_in_one_hop_preserving_queries(self):
        for prefix in ['/', '/.vscode/']:
            response = self.client.get(prefix + 'studio.html?lab=fashion&challenge=textile-fashion&next=https%3A%2F%2Fevil.invalid')
            self.assertEqual(response.status_code, 301)
            target = urlsplit(response['Location'])
            self.assertEqual(target.path, '/studio/')
            self.assertEqual(target.netloc, '')
            self.assertEqual(parse_qs(target.query)['lab'], ['fashion'])
            self.assertEqual(parse_qs(target.query)['challenge'], ['textile-fashion'])
        for original, target in [('/index.html','/'),('/grow-a-pet.html','/pet/'),('/weekly-quiz.html','/quiz/'),('/.vscode/weekly-quiz.html/index.html','/quiz/')]:
            self.assertEqual(self.client.get(original)['Location'], target)
            self.assertEqual(self.client.head(original).status_code, 301)
        self.assertEqual(self.client.get('/challenges.html?lab=festival')['Location'], '/dashboard/?lab=festival#dailyChallenge')
        for unknown in ['/.vscode/not-a-page.html','/unknown.html','/unknown/']:
            self.assertEqual(self.client.get(unknown).status_code, 404)

    def test_page_redirects_reject_writes_and_password_forms_use_post(self):
        self.client.force_login(self.owner)
        for path in ['/dashboard/','/studio/','/dashboard.html','/.vscode/studio.html','/accounts/login/']:
            self.assertEqual(self.client.post(path, {'password':'synthetic-only'}).status_code, 405)
        for path in ['/accounts/login/','/accounts/signup/','/settings/']:
            response = self.client.get(path)
            self.assertContains(response, 'method="post"')
            self.assertNotContains(response, 'method="get"')
