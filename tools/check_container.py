"""Build and smoke-test the real app container using disposable synthetic state.

Requires a running Linux-container Docker engine. Never modifies live volumes.
"""
import argparse
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile
import time
import urllib.request
import uuid

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--image', default='likha:engineering-test')
parser.add_argument('--skip-build', action='store_true')
args = parser.parse_args()


def docker(*arguments, check=True):
    result = subprocess.run(['docker',*arguments],cwd=ROOT,text=True,capture_output=True)
    if check and result.returncode:
        raise RuntimeError(result.stderr[-2000:])
    return result


if docker('info','--format','{{.ServerVersion}}',check=False).returncode:
    raise SystemExit('BLOCKED: a running Docker engine is required. No image execution was performed.')
if not args.skip_build:
    subprocess.run(['docker','build','-f','deploy/Dockerfile','-t',args.image,'.'],cwd=ROOT,check=True)
tag = uuid.uuid4().hex[:12]
volume, name = 'likha-test-data-'+tag, 'likha-test-app-'+tag
with tempfile.TemporaryDirectory(prefix='likha-container-') as temporary:
    envfile = Path(temporary)/'synthetic.env'
    token = secrets.token_urlsafe(32)
    values = {'LIKHA_ENV':'production','DJANGO_SECRET_KEY':secrets.token_urlsafe(64),'DJANGO_ALLOWED_HOSTS':'likha.example.test','LIKHA_ORIGIN':'https://likha.example.test','LIKHA_DATA_DIR':'/data','LIKHA_STATIC_ROOT':'/app/staticfiles','LIKHA_TRUST_PROXY':'1','LIKHA_PRIVACY_CONTACT':'synthetic-test','LIKHA_PRIVACY_APPROVED':'1','LIKHA_HEALTH_TOKEN':token}
    envfile.write_text('\n'.join(f'{key}={value}' for key,value in values.items())+'\n')
    common=['--env-file',str(envfile),'-v',volume+':/data']
    try:
        docker('volume','create',volume)
        for command in [('migrate','--noinput'),('seed_content',),('check','--deploy','--fail-level','WARNING')]:
            docker('run','--rm',*common,args.image,'python','backend/manage.py',*command)
        docker('run','-d','--name',name,*common,'-p','127.0.0.1::8000',args.image)
        port=json.loads(docker('inspect',name).stdout)[0]['NetworkSettings']['Ports']['8000/tcp'][0]['HostPort']
        base='http://127.0.0.1:'+port
        headers={'Host':'likha.example.test','X-Forwarded-Proto':'https','X-Health-Token':token}
        for _ in range(100):
            try:
                with urllib.request.urlopen(urllib.request.Request(base+'/health/ready',headers=headers),timeout=2) as response:
                    if response.status==200:break
            except OSError:time.sleep(.1)
        else:raise RuntimeError('Container did not become ready.')
        for path in ['/var/likha.sqlite3','/.env','/backend/learning/questions.json']:
            try:urllib.request.urlopen(urllib.request.Request(base+path,headers=headers),timeout=3)
            except urllib.error.HTTPError as error:assert error.code==404
            else:raise AssertionError('Private file exposed: '+path)
        docker('restart',name)
        docker('exec',name,'python','backend/manage.py','shell','-c','from learning.models import QuizDefinition; assert QuizDefinition.objects.count()==7')
        print('PASS real container build/start/readiness/private-file denial/restart/persistent SQLite.')
    finally:
        docker('rm','-f',name,check=False)
        docker('volume','rm',volume,check=False)
