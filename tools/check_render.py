"""Exercise the Render build and production static middleware without cloud secrets."""
import os
import secrets
import subprocess
import sys
import tempfile
import threading
from http.client import HTTPConnection
from pathlib import Path

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix='likha-render-check-') as temporary:
    os.environ.update({
        'LIKHA_ENV': 'production', 'DJANGO_SECRET_KEY': secrets.token_urlsafe(64),
        'DJANGO_ALLOWED_HOSTS': 'likha.example.test', 'LIKHA_ORIGIN': 'https://likha.example.test',
        'LIKHA_DATA_DIR': temporary, 'LIKHA_STATIC_ROOT': str(Path(temporary) / 'staticfiles'),
        'LIKHA_HEALTH_TOKEN': secrets.token_urlsafe(32), 'LIKHA_PRIVACY_CONTACT': 'Test administrator',
        'LIKHA_PRIVACY_APPROVED': '1', 'DATABASE_URL': 'postgresql://synthetic:synthetic@127.0.0.1:1/postgres',
        'LIKHA_MEDIA_BACKEND': 'supabase', 'SUPABASE_URL': 'https://synthetic.supabase.co',
        'SUPABASE_SERVICE_ROLE_KEY': 'synthetic-test-key', 'SUPABASE_STORAGE_BUCKET': 'likha-private',
        'DJANGO_SETTINGS_MODULE': 'config.settings',
    })
    subprocess.run([sys.executable, 'deploy/render_build.py'], cwd=root, check=True)
    sys.path.insert(0, str(root / 'backend'))
    import django
    django.setup()
    from django.test import Client
    client = Client(HTTP_HOST='likha.example.test')
    for path in ['/static/api.js', '/static/hosted.js', '/static/admin/css/base.css', '/static/assets/labs/fashion.webp']:
        response = client.get(path, secure=True)
        assert response.status_code == 200, (path, response.status_code)
        response.close()
    response = client.get('/static/craftlab/Banig_v3.mp4', secure=True, HTTP_RANGE='bytes=0-99')
    assert response.status_code == 206, response.status_code
    assert len(b''.join(response.streaming_content)) == 100
    response.close()
    for path in ['/.env', '/backend/config/settings.py', '/static/../requirements/production.txt']:
        response = client.get(path, secure=True)
        assert response.status_code == 404, (path, response.status_code)
    assert client.get('/health/live').status_code == 200
    assert client.get('/health/ready', secure=True).status_code == 404
    from waitress import create_server
    from config.wsgi import application
    from core.hosting import RENDER_PROXY_OPTIONS
    server = create_server(application, host='127.0.0.1', port=0, **RENDER_PROXY_OPTIONS)
    thread = threading.Thread(target=server.run, daemon=True)
    thread.start()
    try:
        conn = HTTPConnection('127.0.0.1', int(server.effective_port), timeout=5)
        conn.request('GET', '/accounts/login/', headers={'Host':'likha.example.test', 'X-Forwarded-Proto':'https'})
        response = conn.getresponse()
        assert response.status == 200, response.status
        response.read()
        conn.close()
    finally:
        server.task_dispatcher.shutdown()
        server.close()
    print('Render build, production static assets/admin CSS, tutorial byte ranges, private-file denial and liveness pass.')
    print('Real Waitress request preserves HTTPS proxy indication without a redirect loop.')
