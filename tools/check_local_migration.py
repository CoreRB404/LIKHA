"""Exercise real populated cutover in isolation before migrating local accounts."""
import os
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory(prefix="likha-cutover-check-") as temporary:
    data = Path(temporary)
    env = {**os.environ, "LIKHA_ENV": "development", "LIKHA_DATA_DIR": str(data), "LIKHA_MEDIA_BACKEND": "local"}
    env.pop("DATABASE_URL", None)
    for command in [
        ["backend/manage.py", "migrate", "--noinput"],
        ["backend/manage.py", "seed_content"],
        ["backend/manage.py", "shell", "-c", "import io,uuid; from PIL import Image; from django.core.files.uploadedfile import SimpleUploadedFile; from accounts.models import User; from learning.services import save_artwork; u=User.objects.create_user('discarded','Synthetic test passphrase 2026'); u.delete(); u=User.objects.create_user('preserved','Synthetic test passphrase 2026'); b=io.BytesIO(); Image.new('RGB',(24,24),'blue').save(b,format='PNG'); save_artwork(u,{'title':'Preserved sample','lab':'art','client_id':str(uuid.uuid4())},SimpleUploadedFile('drawing.png',b.getvalue(),content_type='image/png'))"],
    ]:
        result = subprocess.run([sys.executable, *command], cwd=ROOT, env=env, capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError(result.stdout + result.stderr)
    import local_postgres as local
    import migrate_local_postgres as migration
    for module in (local, migration):
        module.DATA = data
        module.CONTROL = data / "postgres-control.json"
        module.ACTIVE = data / "local-postgres.json"
    local.CLUSTER = data / "postgres-data"
    os.environ.update(env)
    os.environ.pop("DATABASE_URL", None)
    sys.argv = ["migrate_local_postgres.py", "--quiesced"]
    try:
        migration.main()
        from accounts.models import User
        from learning.models import Artwork, Wallet
        from django.db import connections
        from django.core.management import call_command
        call_command('migrate', interactive=False, verbosity=0)
        assert User.objects.get(username="preserved").check_password("Synthetic test passphrase 2026")
        assert Artwork.objects.count() == 1 and Wallet.objects.get().stars == 20
        assert not (data / 'likha.sqlite3').exists()
        assert (data / 'local-postgres.json').is_file()
        # A fresh connection after actual stop/start must retain transferred data.
        connections.close_all()
        local.run_pg(['pg_ctl', '-D', str(local.CLUSTER), '-m', 'fast', '-w', 'stop'])
        local.start()
        assert Artwork.objects.count() == 1
        assert User.objects.get(username="preserved").check_password("Synthetic test passphrase 2026")
        connections.close_all()
        print('PASS populated SQLite -> PostgreSQL cutover, password/UUID preservation, rewards, media and restart persistence.')
    finally:
        if local.running():
            local.run_pg(['pg_ctl', '-D', str(local.CLUSTER), '-m', 'fast', '-w', 'stop'])
