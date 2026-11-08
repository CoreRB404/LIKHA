$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$likhaPython = Join-Path $PSScriptRoot '.venv\Scripts\python.exe'
if (-not (Test-Path -LiteralPath $likhaPython)) {
    python -m venv .venv
    if ($LASTEXITCODE -ne 0) { throw 'Python 3.12 or later is required. Install Python, reopen the terminal, and retry.' }
}
& $likhaPython -m pip install --require-hashes -r requirements/production.txt
if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check the error above.' }
& $likhaPython tools/build_hosted.py
if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
& $likhaPython tools/local_postgres.py setup
if ($LASTEXITCODE -ne 0) { throw 'Local PostgreSQL setup failed.' }
& $likhaPython tools/local_postgres.py start
if ($LASTEXITCODE -ne 0) { throw 'PostgreSQL is not active. Complete the data transfer first.' }
& $likhaPython backend/manage.py migrate --noinput
if ($LASTEXITCODE -ne 0) { throw 'Database migration failed.' }
& $likhaPython backend/manage.py seed_content
if ($LASTEXITCODE -ne 0) { throw 'Assessment initialization failed.' }
Write-Host 'Open http://127.0.0.1:8000/ . Create an account with a username and password.'
& $likhaPython backend/manage.py runserver 127.0.0.1:8000 --noreload
