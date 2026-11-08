import io
import json
import uuid
import zipfile
import tempfile
from pathlib import Path
from unittest.mock import patch
from urllib.error import HTTPError, URLError

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, TestCase, Client, override_settings

from accounts.models import User
from config.database import database_config
from core.http import APIError
from learning import storage
from learning.models import Artwork, RewardEvent
from learning.services import save_artwork, progress, remove_artwork, delete_account
from tests.test_backend import MediaMixin, PASSWORD, upload


class DatabaseConfigurationTests(SimpleTestCase):
    def test_render_generated_secret_is_stable_and_short_keys_are_not_padded(self):
        import base64
        from config.secret_key import normalize_secret
        raw = base64.b64encode(bytes(range(32))).decode('ascii')
        key = normalize_secret(raw, on_render=True)
        self.assertEqual(len(key), 128)
        self.assertEqual(normalize_secret(raw, on_render=True), key)
        self.assertEqual(normalize_secret(raw), raw)
        self.assertNotEqual(normalize_secret(base64.b64encode(bytes(range(1,33))).decode('ascii'), on_render=True), key)
        for short in ('short-key', 'x' * 44, '?' * 44):
            self.assertEqual(normalize_secret(short, on_render=True), short)

    def test_private_local_postgres_config_is_loopback_only(self):
        from config.local_database import local_database
        with tempfile.TemporaryDirectory(prefix='likha-config-test-') as folder:
            path = Path(folder) / 'local-postgres.json'
            value = {'host':'127.0.0.1','port':55432,'database':'likha','user':'likha_local','password':'synthetic-' * 5}
            path.write_text(json.dumps(value), encoding='utf-8')
            config = local_database(path)
            self.assertEqual(config['ENGINE'], 'django.db.backends.postgresql')
            self.assertEqual(config['OPTIONS']['sslmode'], 'disable')
            value['host'] = 'external.example.test'
            path.write_text(json.dumps(value), encoding='utf-8')
            with self.assertRaises(ImproperlyConfigured):
                local_database(path)

    def test_render_proxy_uses_provider_client_address_only_when_enabled(self):
        from django.test import RequestFactory
        from accounts.services import client_ip
        request = RequestFactory().get('/', HTTP_X_FORWARDED_FOR='203.0.113.5, 10.0.0.8', REMOTE_ADDR='127.0.0.1')
        with override_settings(TRUST_PROXY=True, PROXY_MODE='render'):
            self.assertEqual(client_ip(request), '203.0.113.5')
        with override_settings(TRUST_PROXY=True, PROXY_MODE='single'):
            self.assertEqual(client_ip(request), '127.0.0.1')
        with override_settings(TRUST_PROXY=False, PROXY_MODE='render'):
            self.assertEqual(client_ip(request), '127.0.0.1')

    def test_postgres_credentials_tls_schema_and_pooler_options(self):
        config = database_config('postgresql://postgres.project:p%40ss%3Aword@pooler.supabase.com:5432/postgres?sslmode=require', Path('.'))
        self.assertEqual(config['PASSWORD'], 'p@ss:word')
        self.assertEqual(config['OPTIONS']['sslmode'], 'require')
        self.assertIsNone(config['OPTIONS']['prepare_threshold'])
        self.assertIn('search_path=likha,pg_catalog', config['OPTIONS']['options'])
        self.assertNotIn('transaction_mode', config['OPTIONS'])

    def test_invalid_urls_fail_without_echoing_credentials(self):
        for url in ['sqlite:///x', 'postgres://u:private@host/db?sslmode=disable', 'postgres://u:private@host/db?options=unsafe', 'postgres://u@host/db', 'postgres://u:private@host:wrong/db']:
            with self.assertRaises(ImproperlyConfigured) as result:
                database_config(url, Path('.'))
            self.assertNotIn('private', str(result.exception))


@override_settings(MEDIA_BACKEND='supabase', SUPABASE_URL='https://synthetic.supabase.co', SUPABASE_STORAGE_BUCKET='likha-private', SUPABASE_SERVICE_ROLE_KEY='synthetic-server-key')
class SupabaseArtworkTests(MediaMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.owner = User.objects.create_user('cloud-artist', PASSWORD)
        self.other = User.objects.create_user('cloud-other', PASSWORD)
        self.objects = {}
        self.fail_upload = False
        self.adapter = patch('learning.storage.request', side_effect=self.fake_request)
        self.adapter.start()
        self.addCleanup(self.adapter.stop)

    def fake_request(self, method, path, payload=None, content_type='application/json', missing_ok=False):
        if path.startswith('bucket/'):
            return b'{"public":false}'
        if method == 'POST':
            if self.fail_upload:
                raise APIError('Synthetic network outage', 503, 'storage_unavailable')
            self.objects[path.removeprefix('object/')] = payload
            return b'{}'
        if method == 'GET':
            return self.objects.get(path.removeprefix('object/authenticated/'))
        if method == 'DELETE':
            for key in json.loads(payload)['prefixes']:
                self.objects.pop('likha-private/' + key, None)
            return b'[]'
        self.fail('Unexpected storage operation')

    def save(self, key):
        return save_artwork(self.owner, {'title':'Cloud drawing', 'lab':'art', 'client_id':str(key)}, upload())

    def test_save_retry_owner_image_export_and_delete(self):
        key = uuid.uuid4()
        art = self.save(key)
        self.assertEqual(self.save(key).pk, art.pk)
        self.assertEqual(progress(self.owner)['stars'], 20)
        self.assertEqual(list(self.private.iterdir()), [])
        client = Client()
        client.force_login(self.other)
        self.assertEqual(client.get(f'/api/v1/artworks/{art.pk}/image').status_code, 404)
        client.force_login(self.owner)
        response = client.get(f'/api/v1/artworks/{art.pk}/image')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(b''.join(response.streaming_content), storage.read_image(art))
        exported = client.post('/api/v1/me/export', json.dumps({'password': PASSWORD}), content_type='application/json')
        self.assertEqual(exported.status_code, 200)
        with zipfile.ZipFile(io.BytesIO(b''.join(exported.streaming_content))) as archive:
            self.assertEqual(archive.read(f'artworks/{art.pk}.webp'), storage.read_image(art))
        remove_artwork(art)
        self.assertFalse(self.objects)
        self.assertEqual(progress(self.owner)['stars'], 20)

    def test_failed_upload_persists_intent_retry_awards_once(self):
        key = uuid.uuid4()
        self.fail_upload = True
        with self.assertRaises(APIError):
            self.save(key)
        self.assertEqual(Artwork.objects.get().status, 'pending')
        self.assertFalse(RewardEvent.objects.exists())
        self.fail_upload = False
        art = self.save(key)
        self.assertEqual(art.status, 'ready')
        self.assertEqual(Artwork.objects.count(), 1)
        self.assertEqual(progress(self.owner)['stars'], 20)

    def test_corrupt_cloud_image_and_private_bucket_fail_closed(self):
        art = self.save(uuid.uuid4())
        self.objects['likha-private/' + storage.object_key(art)] = b'corrupt'
        with self.assertRaises(APIError) as result:
            storage.read_image(art)
        self.assertEqual(result.exception.code, 'image_integrity')
        with patch('learning.storage.request', return_value=b'{"public":true}'):
            with self.assertRaises(APIError):
                storage.check_bucket()

    def test_account_deletion_keeps_remote_tombstone_and_removes_images(self):
        self.save(uuid.uuid4())
        owner_id = self.owner.pk
        delete_account(self.owner)
        self.assertFalse(User.objects.filter(pk=owner_id).exists())
        self.assertEqual(list(self.objects), ['likha-private/deletions/' + str(owner_id) + '.json'])


@override_settings(SUPABASE_URL='https://synthetic.supabase.co', SUPABASE_SERVICE_ROLE_KEY='synthetic-server-key')
class StorageTransportTests(SimpleTestCase):
    def test_timeout_and_redirect_do_not_expose_service_key(self):
        for error in [URLError('private-server-key'), HTTPError('https://synthetic', 302, 'redirect', {}, io.BytesIO())]:
            with patch('learning.storage.build_opener') as opener:
                opener.return_value.open.side_effect = error
                with self.assertRaises(APIError) as result:
                    storage.request('GET', 'bucket/likha-private')
                self.assertEqual(result.exception.status, 503)
                self.assertNotIn('private-server-key', str(result.exception))
