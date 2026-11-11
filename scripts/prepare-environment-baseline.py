"""Extract a read-only comparison build inside this feature worktree.

No branch/worktree reset, dependency installation, or asset regeneration.
"""
from pathlib import Path
import io
import json
import subprocess
import tarfile

root = Path(__file__).resolve().parents[1]
destination = root / ".audit-master-baseline"
revision = "2c3b62d9b8e2045024ac2c73baa07500023fbf54"
if destination.exists():
    receipt = destination / "baseline-source.json"
    if receipt.is_file() and json.loads(receipt.read_text())["revision"] == revision:
        print(f"Reusing baseline: {destination}")
        raise SystemExit(0)
    raise SystemExit(f"Refusing to overwrite existing directory: {destination}")
paths = ["src", "public", "index.html", "package.json", "tsconfig.json", "vite.config.ts", "tailwind.config.js", "postcss.config.js"]
archive = subprocess.check_output(["git", "archive", "--format=tar", revision, *paths], cwd=root)
destination.mkdir()
with tarfile.open(fileobj=io.BytesIO(archive), mode="r:") as bundle:
    bundle.extractall(destination, filter="data")
(destination / "baseline-source.json").write_text(json.dumps({"revision": revision, "paths": paths}, indent=2)+"\n")
print(f"Prepared baseline: {destination}")
