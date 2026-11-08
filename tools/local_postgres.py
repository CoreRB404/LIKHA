"""Control only LIKHA's private local PostgreSQL cluster; not the system service."""
import argparse
import json
import os
import secrets
import shutil
import socket
import subprocess
from pathlib import Path

if os.name != "nt":
    os.umask(0o077)

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "var"
CONTROL = DATA / "postgres-control.json"
ACTIVE = DATA / "local-postgres.json"
CLUSTER = DATA / "postgres-data"


def pg_binary(name):
    found = shutil.which(name)
    if found:
        return found
    if os.name == "nt":
        candidates = sorted(Path("C:/Program Files/PostgreSQL").glob("*/bin/" + name + ".exe"), reverse=True)
        if candidates:
            return str(candidates[0])
    raise RuntimeError("Install PostgreSQL server tools and add their bin directory to PATH.")


def run_pg(args, check=True):
    DATA.mkdir(exist_ok=True)
    with (DATA / "postgres-control.log").open("a", encoding="utf-8") as output:
        result = subprocess.run([pg_binary(args[0]), *args[1:]], stdout=output, stderr=subprocess.STDOUT,
                                timeout=90, creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    if check and result.returncode:
        raise RuntimeError("PostgreSQL control failed. Inspect the private var/postgres-control.log.")
    return result.returncode


def configuration():
    return json.loads(CONTROL.read_text(encoding="utf-8"))


def connect(config, database=None):
    import psycopg
    return psycopg.connect(host=config["host"], port=config["port"], user=config["user"],
                           password=config["password"], dbname=database or config["database"],
                           connect_timeout=10, autocommit=True)


def running():
    if not (CLUSTER / "PG_VERSION").exists() or not CONTROL.exists():
        return False
    import psycopg
    try:
        with connect(configuration()) as conn:
            actual = Path(conn.execute("SHOW data_directory").fetchone()[0]).resolve()
            if os.path.normcase(str(actual)) != os.path.normcase(str(CLUSTER.resolve())):
                raise RuntimeError("The configured PostgreSQL port belongs to another cluster; refusing to control it.")
            return True
    except psycopg.Error:
        return run_pg(["pg_ctl", "-D", str(CLUSTER), "status"], check=False) == 0


def start():
    if not CONTROL.exists() or not (CLUSTER / "PG_VERSION").exists():
        raise RuntimeError("Initialize LIKHA PostgreSQL with tools/local_postgres.py setup first.")
    if not running():
        run_pg(["pg_ctl", "-D", str(CLUSTER), "-l", str(DATA / "postgres-server.log"), "-w", "start"])
    with connect(configuration()) as conn:
        conn.execute("SELECT 1")


def setup():
    if CONTROL.exists():
        start()
        return configuration()
    if CLUSTER.exists():
        raise RuntimeError("PostgreSQL data already exists without control configuration; refusing to overwrite it.")
    DATA.mkdir(exist_ok=True)
    with socket.socket() as probe:
        probe.bind(("127.0.0.1", 0))
        port = probe.getsockname()[1]
    config = {"host": "127.0.0.1", "port": port, "user": "likha_local",
              "password": secrets.token_urlsafe(48), "database": "likha"}
    password_file = DATA / "postgres-init-password"
    try:
        with password_file.open("x", encoding="utf-8") as output:
            output.write(config["password"])
        run_pg(["initdb", "-D", str(CLUSTER), "-U", config["user"], "--pwfile=" + str(password_file),
                "--auth=scram-sha-256", "--encoding=UTF8", "--no-locale"])
    finally:
        password_file.unlink(missing_ok=True)
    with (CLUSTER / "postgresql.conf").open("a", encoding="utf-8") as output:
        output.write(f"\n# LIKHA: this cluster is private to this laptop.\nlisten_addresses = '127.0.0.1'\nport = {port}\n")
    with CONTROL.open("x", encoding="utf-8") as output:
        json.dump(config, output)
    run_pg(["pg_ctl", "-D", str(CLUSTER), "-l", str(DATA / "postgres-server.log"), "-w", "start"])
    with connect(config, "postgres") as conn:
        conn.execute('CREATE DATABASE likha')
    with connect(config) as conn:
        conn.execute('CREATE SCHEMA likha')
        conn.execute('REVOKE ALL ON SCHEMA likha FROM PUBLIC')
    return config


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("action", choices=["setup", "start", "stop", "status"])
    args = parser.parse_args()
    if args.action == "setup":
        setup()
        if not ACTIVE.exists() and not (DATA / "likha.sqlite3").exists():
            shutil.copyfile(CONTROL, ACTIVE)
            (DATA / "postgresql-active").write_text("PostgreSQL only; no SQLite fallback.\n", encoding="utf-8")
        print("LIKHA PostgreSQL is initialized. Existing SQLite data requires the migration tool before activation.")
    elif args.action == "start":
        start()
        if not ACTIVE.exists():
            raise RuntimeError("PostgreSQL is running but data transfer is not activated. Run tools/migrate_local_postgres.py --quiesced.")
        print("LIKHA PostgreSQL is running on loopback; the application uses PostgreSQL.")
    elif args.action == "stop":
        if running():
            run_pg(["pg_ctl", "-D", str(CLUSTER), "-m", "fast", "-w", "stop"])
        print("LIKHA PostgreSQL stopped; no other database service was changed.")
    else:
        print("LIKHA PostgreSQL: " + ("running" if running() else "stopped"))
        print("Application database: " + ("PostgreSQL" if ACTIVE.exists() else "not yet switched"))


if __name__ == "__main__":
    main()
