"""Resolve official public image tags to immutable registry digests."""
import json
from pathlib import Path
from urllib.request import urlopen

root=Path(__file__).resolve().parents[1]
pins={}
for image,tag in [("python","3.12-slim"),("caddy","2-alpine")]:
    with urlopen(f"https://hub.docker.com/v2/repositories/library/{image}/tags/{tag}",timeout=30) as response:
        info=json.load(response)
    digest=info["digest"]
    assert digest.startswith("sha256:") and len(digest)==71
    pins[image]={"tag":tag,"digest":digest,"source":f"https://hub.docker.com/v2/repositories/library/{image}/tags/{tag}"}
file=root/"deploy/Dockerfile"
source=file.read_text()
lines=source.splitlines()
lines[0]=f"FROM python:{pins['python']['tag']}@{pins['python']['digest']}"
file.write_text("\n".join(lines)+"\n")
file=root/"deploy/compose.yaml"
source=file.read_text()
import re
source=re.sub(r"image: caddy:[^\n]+",f"image: caddy:{pins['caddy']['tag']}@{pins['caddy']['digest']}",source)
file.write_text(source)
(root/"deploy/image-pins.json").write_text(json.dumps(pins,indent=2)+"\n")
print("Pinned official Python and Caddy image digests. Container execution still requires staging verification.")
