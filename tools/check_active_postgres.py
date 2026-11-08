"""Verify the selected local PostgreSQL runtime using rolled-back synthetic data."""
import io
import json
import os
import sys
import tempfile
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()
from django.conf import settings
from django.db import connection, transaction
from django.test import Client, override_settings
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from accounts.models import User
from learning.models import Artwork, RewardEvent, QuizAttempt

if connection.vendor != 'postgresql' or settings.MEDIA_BACKEND != 'local':
    raise SystemExit('This verification requires the active local PostgreSQL application.')
models = [User, Artwork, RewardEvent, QuizAttempt]
before = [model.objects.count() for model in models]
with tempfile.TemporaryDirectory(prefix='likha-postgres-runtime-') as temporary:
    with override_settings(PRIVATE_MEDIA_ROOT=Path(temporary)):
        with transaction.atomic():
            name = 'migration-probe-' + uuid.uuid4().hex
            password = 'Private synthetic check ' + uuid.uuid4().hex
            User.objects.create_user(name, password)
            client = Client(enforce_csrf_checks=True)
            token = client.get('/api/v1/session').json()['data']['csrf']
            response = client.post('/api/v1/auth/login', json.dumps({'username':name, 'password':password}), content_type='application/json', HTTP_X_CSRFTOKEN=token)
            assert response.status_code == 200
            token = response.json()['data']['csrf']
            image = io.BytesIO()
            Image.new('RGB', (40,40), 'green').save(image, format='PNG')
            response = client.post('/api/v1/artworks', {'title':'Temporary PostgreSQL check', 'lab':'art', 'client_id':str(uuid.uuid4()), 'image':SimpleUploadedFile('probe.png',image.getvalue(),content_type='image/png')}, HTTP_X_CSRFTOKEN=token)
            assert response.status_code == 200
            value = response.json()['data']
            assert value['progress']['stars'] == 20
            image_response = client.get(value['artwork']['image_url'])
            assert image_response.status_code == 200
            assert b''.join(image_response.streaming_content)
            assert client.get('/api/v1/me').status_code == 200
            transaction.set_rollback(True)
        image_response.close()
assert [model.objects.count() for model in models] == before
print('PASS active PostgreSQL login, artwork save/read and rewards. Synthetic writes rolled back; original records unchanged.')
print(json.dumps(dict(zip(['accounts','artworks','reward_events','quiz_attempts'],before))))
