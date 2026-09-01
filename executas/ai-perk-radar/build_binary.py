import hashlib
import json
import os
import platform
import shutil
import subprocess
import sys
import tarfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent
NAME = "ai-perk-radar-matcher"

with (ROOT / "executa.json").open("r", encoding="utf-8") as f:
    META = json.load(f)

VERSION = META["version"]

system = platform.system().lower()
machine = platform.machine().lower()

machine_aliases = {
    "amd64": "x86_64",
    "x64": "x86_64",
    "arm64": "arm64",
    "aarch64": "aarch64",
}

machine = machine_aliases.get(machine, machine)

if system == "darwin":
    if machine == "arm64":
        PLATFORM = "darwin-arm64"
    elif machine == "x86_64":
        PLATFORM = "darwin-x86_64"
    else:
        raise RuntimeError(f"Unsupported macOS architecture: {machine}")

elif system == "linux":
    if machine == "x86_64":
        PLATFORM = "linux-x86_64"
    else:
        raise RuntimeError(f"Unsupported Linux architecture: {machine}")

elif system == "windows":
    if machine == "x86_64":
        PLATFORM = "windows-x86_64"
    else:
        raise RuntimeError(f"Unsupported Windows architecture: {machine}")

else:
    raise RuntimeError(f"Unsupported system: {system}")

exe_name = NAME + (".exe" if system == "windows" else "")

build_root = ROOT / ".build-pyinstaller"
pyi_dist = build_root / "dist"
pyi_work = build_root / "work"
pyi_spec = build_root / "spec"

for p in (pyi_dist, pyi_work, pyi_spec):
    p.mkdir(parents=True, exist_ok=True)

data_file = ROOT / "ai_perk_radar" / "opportunities.json"

if not data_file.exists():
    raise RuntimeError(f"Missing catalog: {data_file}")

cmd = [
    sys.executable,
    "-m",
    "PyInstaller",
    "--onefile",
    "--clean",
    "--noupx",
    "--name",
    NAME,
    "--distpath",
    str(pyi_dist),
    "--workpath",
    str(pyi_work),
    "--specpath",
    str(pyi_spec),
    "--add-data",
    f"{data_file}{os.pathsep}ai_perk_radar",
    str(ROOT / "executa_entry.py"),
]

print("Building:", PLATFORM)
subprocess.run(cmd, cwd=ROOT, check=True)

binary = pyi_dist / exe_name

if not binary.exists():
    raise RuntimeError(f"Binary was not created: {binary}")

# Smoke test the packaged binary.
request = '{"jsonrpc":"2.0","method":"describe","id":1}\n'

test = subprocess.run(
    [str(binary)],
    input=request,
    text=True,
    capture_output=True,
    timeout=30
)

if test.returncode != 0:
    print(test.stdout)
    print(test.stderr, file=sys.stderr)
    raise RuntimeError(
        f"Packaged Executa failed smoke test: {test.returncode}"
    )

if '"result"' not in test.stdout:
    print(test.stdout)
    raise RuntimeError(
        "Packaged Executa did not return a describe result."
    )

print("Smoke test: OK")

out = ROOT / "dist"
out.mkdir(exist_ok=True)

base = f"{NAME}-{VERSION}-{PLATFORM}"

if system == "windows":
    artifact = out / f"{base}.zip"

    with zipfile.ZipFile(
        artifact,
        "w",
        compression=zipfile.ZIP_DEFLATED
    ) as z:
        z.write(binary, arcname=exe_name)

else:
    artifact = out / f"{base}.tar.gz"

    with tarfile.open(artifact, "w:gz") as tf:
        tf.add(binary, arcname=exe_name)

digest = hashlib.sha256(
    artifact.read_bytes()
).hexdigest()

sha_file = Path(str(artifact) + ".sha256")
sha_file.write_text(
    f"{digest}  {artifact.name}\n",
    encoding="utf-8"
)

print("Artifact:", artifact)
print("SHA256 :", digest)
