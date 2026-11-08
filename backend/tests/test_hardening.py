import errno
import hashlib
import io
import json
import tempfile
import uuid
from pathlib import Path
from unittest.mock import patch

from django.core.exceptions import ValidationError
from django.conf import settings
from django.db import OperationalError
from django.test import Client, TestCase, override_settings

from accounts.models import User
from accounts.validators import BreachedPasswordValidator, load_blocklist
from learning.models import Artwork, RewardEvent
from learning.services import image_path, save_artwork
from tests.test_backend import MediaMixin, PASSWORD, upload


class FailureAndInputTests(MediaMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.user = User.objects.create_user('hardening-artist', PASSWORD)
        self.client = Client(enforce_csrf_checks=True)
        token = self.client.get('/api/v1/session').json()['data']['csrf']
        response = self.client.post('/api/v1/auth/login', json.dumps({'username': self.user.username, 'password': PASSWORD}), content_type='application/json', HTTP_X_CSRFTOKEN=token)
        self.token = response.json()['data']['csrf']

    def post_image(self, key=None):
        return self.client.post('/api/v1/artworks', {'title':'Retained drawing', 'lab':'art', 'client_id':str(key or uuid.uuid4()), 'image':upload()}, HTTP_X_CSRFTOKEN=self.token)

    def test_disk_full_rolls_back_record_and_returns_retryable_error(self):
        key = uuid.uuid4()
        with patch('learning.services.os.fsync', side_effect=OSError(errno.ENOSPC, 'synthetic disk full')):
            response = self.post_image(key)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json()['error']['code'], 'storage_unavailable')
        self.assertNotIn('Traceback', response.content.decode())
        self.assertFalse(Artwork.objects.exists())
        self.assertFalse(RewardEvent.objects.exists())
        self.assertEqual(list(self.private.iterdir()), [])
        retry = self.post_image(key)
        self.assertEqual(retry.status_code, 200)
        self.assertEqual(Artwork.objects.count(), 1)

    def test_finalize_failure_recovers_same_save_without_duplicate_reward(self):
        key = uuid.uuid4()
        with patch('learning.services.os.replace', side_effect=OSError(errno.EACCES, 'synthetic access failure')):
            response = self.post_image(key)
        self.assertEqual(response.status_code, 503)
        self.assertEqual(Artwork.objects.get().status, 'pending')
        self.assertFalse(RewardEvent.objects.exists())
        self.assertEqual(self.post_image(key).status_code, 200)
        self.assertEqual(Artwork.objects.count(), 1)
        self.assertEqual(sum(RewardEvent.objects.values_list('stars', flat=True)), 20)

    def test_busy_database_is_retryable_and_does_not_leak_details(self):
        with patch('learning.views.save_artwork', side_effect=OperationalError('database is locked; private-path')):
            response = self.post_image()
        self.assertEqual(response.status_code, 503)
        self.assertEqual(response['Retry-After'], '3')
        self.assertNotIn('private-path', response.content.decode())

    def test_missing_image_returns_404_not_private_path(self):
        art = save_artwork(self.user, {'title':'Missing file', 'lab':'art', 'client_id':str(uuid.uuid4())}, upload())
        image_path(art).unlink()
        response = self.client.get(f'/api/v1/artworks/{art.pk}/image')
        self.assertEqual(response.status_code, 404)
        self.assertNotIn(str(self.private), response.content.decode())

    def test_corrupted_image_is_not_served_as_valid_artwork(self):
        art = save_artwork(self.user, {'title':'Corrupted file', 'lab':'art', 'client_id':str(uuid.uuid4())}, upload())
        image_path(art).write_bytes(b'not a valid saved image')
        response = self.client.get(f'/api/v1/artworks/{art.pk}/image')
        self.assertEqual(response.status_code,404)
        self.assertEqual(response.json()['error']['code'],'image_integrity')

    def test_malformed_json_and_adversarial_metadata(self):
        for body in ['{', '[]', 'null', '1', '"text"', '{"version":1,"version":2}', '{"version":NaN}', '{"display_name":"\\ud800"}', '{"nested":'+'['*30+'0'+']'*30+'}']:
            response = self.client.patch('/api/v1/me', body, content_type='application/json', HTTP_X_CSRFTOKEN=self.token)
            self.assertEqual(response.status_code, 422, body)
        from core.http import APIError
        for lab in [[], {}, None, 42, "art' OR 1=1--", '../../var']:
            with self.assertRaises(APIError):
                save_artwork(self.user, {'title':'Malformed', 'lab':lab, 'client_id':str(uuid.uuid4())}, upload())
        for value in [[], {}, 42]:
            with self.assertRaises(APIError):
                save_artwork(self.user, {'title':'Malformed', 'lab':'art', 'challenge':value, 'client_id':str(uuid.uuid4())}, upload())

    def test_invalid_or_truncated_images_create_no_owned_record(self):
        from django.core.files.uploadedfile import SimpleUploadedFile
        from core.http import APIError
        for content in [b'<script>alert(1)</script>', b'\x89PNG\r\n\x1a\n', b'RIFF\x00\x00\x00\x00WEBP', b'']:
            with self.assertRaises(APIError):
                save_artwork(self.user, {'title':'Malformed', 'lab':'art', 'client_id':str(uuid.uuid4())}, SimpleUploadedFile('x.png', content))
        self.assertEqual(Artwork.objects.count(), 0)


class BreachedPasswordTests(TestCase):
    def test_corrupted_local_blocklist_fails_closed(self):
        with tempfile.TemporaryDirectory(prefix='likha-password-list-') as temporary:
            path=Path(temporary)/'invalid.sha1'
            path.write_text('invalid-data')
            with override_settings(PASSWORD_BLOCKLIST=path):
                with self.assertRaises(ValidationError) as raised:
                    BreachedPasswordValidator().validate(PASSWORD)
            self.assertEqual(raised.exception.code,'password_check_unavailable')

    def test_bundled_blocklist_contains_large_corpus_and_no_network_needed(self):
        self.assertGreaterEqual(len(load_blocklist(str(settings.PASSWORD_BLOCKLIST))),90000)
        validator = BreachedPasswordValidator()
        with patch('accounts.validators.urlopen') as network:
            with self.assertRaises(ValidationError):
                validator.validate('password')
            validator.validate('A locally safe and uncommon creative passphrase 2026')
        network.assert_not_called()

    @override_settings(PASSWORD_BREACH_MODE='online')
    def test_online_check_sends_only_hash_prefix_and_padding(self):
        password = 'A synthetic privacy-preserving passphrase 2026'
        digest = hashlib.sha1(password.encode(), usedforsecurity=False).hexdigest().upper()
        with patch('accounts.validators.urlopen') as network:
            network.return_value.__enter__.return_value.read.return_value = (digest[5:]+':7\r\n').encode()
            with self.assertRaises(ValidationError) as raised:
                BreachedPasswordValidator().validate(password)
        self.assertEqual(raised.exception.code, 'password_breached')
        request = network.call_args.args[0]
        self.assertTrue(request.full_url.endswith('/range/'+digest[:5]))
        self.assertNotIn(password, request.full_url)
        self.assertNotIn(digest, request.full_url)
        self.assertEqual(request.get_header('Add-padding'), 'true')

    @override_settings(PASSWORD_BREACH_MODE='online')
    def test_online_unavailable_fails_closed(self):
        with patch('accounts.validators.urlopen', side_effect=OSError('synthetic unavailable')):
            with self.assertRaises(ValidationError) as raised:
                BreachedPasswordValidator().validate(PASSWORD)
        self.assertEqual(raised.exception.code, 'password_check_unavailable')

    @override_settings(PASSWORD_BREACH_MODE='online')
    def test_empty_or_malformed_range_response_fails_closed(self):
        for body in [b'', b'<html>error</html>', b'INVALID:0']:
            with patch('accounts.validators.urlopen') as network:
                network.return_value.__enter__.return_value.read.return_value = body
                with self.assertRaises(ValidationError) as raised:
                    BreachedPasswordValidator().validate(PASSWORD)
                self.assertEqual(raised.exception.code,'password_check_unavailable')
