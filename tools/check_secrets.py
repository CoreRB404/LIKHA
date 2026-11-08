"""Focused source/artifact secret-pattern check; reports locations, never values."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
patterns = [
    re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    re.compile(r"\bAKIA[A-Z0-9]{16}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9]{30,}\b"),
    re.compile(r"\bsb_secret_[A-Za-z0-9_-]{20,}\b"),
    re.compile(r"(?m)^\s*(?:DJANGO_SECRET_KEY|LIKHA_BACKUP_KEY|LIKHA_HEALTH_TOKEN)\s*=\s*['\"]?[A-Za-z0-9_+/=-]{32,}['\"]?\s*$"),
]
files = [ROOT/'.env.example', ROOT/'render.yaml']
for folder in ['backend','tools','docs','deploy','.github']:
    files.extend(path for path in (ROOT/folder).rglob('*') if path.is_file() and path.suffix in {'.py','.js','.mjs','.md','.yaml','.yml','.html'} and not {'public','__pycache__','legacy'} & set(path.parts))
findings=[]
for file in files:
    for number,line in enumerate(file.read_text(encoding='utf-8').splitlines(),1):
        if any(pattern.search(line) for pattern in patterns):
            findings.append(f'{file.relative_to(ROOT)}:{number}')
if findings:
    raise SystemExit('Potential secret material; review without logging values:\n'+'\n'.join(findings))
print(f'PASS focused secret-pattern check across {len(files)} source/configuration files. Not a substitute for credential rotation or full history review.')
