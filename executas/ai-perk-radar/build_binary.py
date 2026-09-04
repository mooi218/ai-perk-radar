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

ARCHIVE_NAME = "ai-perk-radar-matcher"

RUNTIME_TOOL_ID = os.environ.get(
    "ANNA_RUNTIME_TOOL_ID",
    "tool-chiku-ai-perk-radar-matcher-68rpuryp",
)

with (ROOT / "executa.json").open(
    "r",
    encoding="utf-8",
) as f:
    META = json.load(f)

VERSION = META["version"]
DISPLAY_NAME = META.get(
    "name",
    "AI Perk Radar Matcher",
)
DESCRIPTION = META.get(
    "description",
    "AI Perk Radar matching tool.",
)

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
        raise RuntimeError(
            f"Unsupported macOS architecture: {machine}"
        )

elif system == "linux":
    if machine == "x86_64":
        PLATFORM = "linux-x86_64"
    else:
        raise RuntimeError(
            f"Unsupported Linux architecture: {machine}"
        )

elif system == "windows":
    if machine == "x86_64":
        PLATFORM = "windows-x86_64"
    else:
        raise RuntimeError(
            f"Unsupported Windows architecture: {machine}"
        )

else:
    raise RuntimeError(
        f"Unsupported system: {system}"
    )

exe_name = (
    RUNTIME_TOOL_ID + ".exe"
    if system == "windows"
    else RUNTIME_TOOL_ID
)

build_root = ROOT / ".build-pyinstaller"
pyi_dist = build_root / "dist"
pyi_work = build_root / "work"
pyi_spec = build_root / "spec"
stage = build_root / "stage"

if stage.exists():
    shutil.rmtree(stage)

for p in (
    pyi_dist,
    pyi_work,
    pyi_spec,
    stage / "bin",
):
    p.mkdir(parents=True, exist_ok=True)

data_file = (
    ROOT
    / "ai_perk_radar"
    / "opportunities.json"
)

if not data_file.exists():
    raise RuntimeError(
        f"Missing catalog: {data_file}"
    )

cmd = [
    sys.executable,
    "-m",
    "PyInstaller",
    "--onefile",
    "--clean",
    "--noupx",
    "--name",
    RUNTIME_TOOL_ID,
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
print("Runtime tool ID:", RUNTIME_TOOL_ID)

subprocess.run(
    cmd,
    cwd=ROOT,
    check=True,
)

binary = pyi_dist / exe_name

if not binary.exists():
    raise RuntimeError(
        f"Binary was not created: {binary}"
    )

# Ad-hoc sign macOS binaries for internal distribution.
if system == "darwin":
    subprocess.run(
        [
            "codesign",
            "--force",
            "--sign",
            "-",
            str(binary),
        ],
        check=False,
    )

# Verify describe, ranking, and UTF-8 catalog data before packaging.
review_profile = {
    "country": "JP",
    "student": True,
    "researcher": False,
    "developer": True,
    "creator": False,
    "founder": False,
    "limited_only": False,
    "priority": "free",
    "interests": [
        "ai",
        "coding",
        "cloud",
    ],
}

requests = [
    {
        "jsonrpc": "2.0",
        "method": "describe",
        "id": 1,
    },
    {
        "jsonrpc": "2.0",
        "method": "invoke",
        "params": {
            "tool": "find_perks",
            "arguments": review_profile,
        },
        "id": 2,
    },
]

request = "\n".join(
    json.dumps(item)
    for item in requests
) + "\n"

test = subprocess.run(
    [str(binary)],
    input=request,
    text=True,
    capture_output=True,
    timeout=30,
)

if test.returncode != 0:
    print(test.stdout)
    print(test.stderr, file=sys.stderr)
    raise RuntimeError(
        "Packaged Executa failed smoke test."
    )

try:
    replies = [
        json.loads(line)
        for line in test.stdout.splitlines()
        if line.strip()
    ]
except json.JSONDecodeError as error:
    print(test.stdout)
    raise RuntimeError(
        "Packaged Executa returned invalid JSON."
    ) from error

by_id = {
    reply.get("id"): reply
    for reply in replies
}

if "result" not in by_id.get(1, {}):
    print(test.stdout)
    raise RuntimeError(
        "Describe RPC did not return a result."
    )

invoke_result = by_id.get(
    2,
    {},
).get("result", {})

if not invoke_result.get("success"):
    print(test.stdout)
    raise RuntimeError(
        "find_perks smoke invoke failed."
    )

data = invoke_result["data"]
results = data["results"]
recommended = data.get("recommended")

recommendable = [
    item
    for item in results
    if item.get("availability") != "check"
]

if not recommended or (
    recommended["match_score"]
    != max(
        item["match_score"]
        for item in recommendable
    )
):
    raise RuntimeError(
        "Recommendation is not a highest-score perk."
    )

google = next(
    (
        item
        for item in results
        if item["id"]
        == "google-ai-plus-student-2026"
    ),
    None,
)

if (
    google is not None
    and (
        recommended["match_score"]
        <= google["match_score"]
        or recommended["id"]
        == google["id"]
    )
):
    raise RuntimeError(
        "Review regression: Google outranked a higher match."
    )

codedex = next(
    item
    for item in results
    if item["id"] == "github-pack-codedex"
)

if (
    codedex["title"]
    != "Codédex Club Student"
    or codedex["provider"] != "Codédex"
    or "Codédex" not in codedex["value_display"]
    or "Codédex" not in codedex["why"]
):
    raise RuntimeError(
        "Codédex UTF-8 smoke check failed."
    )

print("Smoke test: OK")

# -------------------------------------------------
# Anna canonical archive layout
# -------------------------------------------------

stage_binary = stage / "bin" / exe_name
shutil.copy2(binary, stage_binary)

if system != "windows":
    stage_binary.chmod(0o755)

entrypoint = f"bin/{exe_name}"

archive_manifest = {
    "name": RUNTIME_TOOL_ID,
    "display_name": DISPLAY_NAME,
    "version": VERSION,
    "description": DESCRIPTION,
    "runtime": {
        "binary": {
            "entrypoint": {
                "default": entrypoint
            },
            "permissions": {
                entrypoint: "0o755"
            },
        }
    },
}

(stage / "manifest.json").write_text(
    json.dumps(
        archive_manifest,
        ensure_ascii=False,
        indent=2,
    ) + "\n",
    encoding="utf-8",
)

out = ROOT / "dist"
out.mkdir(exist_ok=True)

base = (
    f"{ARCHIVE_NAME}-"
    f"{VERSION}-"
    f"{PLATFORM}"
)

if system == "windows":
    artifact = out / f"{base}.zip"

    with zipfile.ZipFile(
        artifact,
        "w",
        compression=zipfile.ZIP_DEFLATED,
    ) as z:
        for file in stage.rglob("*"):
            if file.is_file():
                z.write(
                    file,
                    arcname=file.relative_to(stage),
                )

else:
    artifact = out / f"{base}.tar.gz"

    with tarfile.open(
        artifact,
        "w:gz",
    ) as tf:
        for child in stage.iterdir():
            tf.add(
                child,
                arcname=child.name,
            )

digest = hashlib.sha256(
    artifact.read_bytes()
).hexdigest()

sha_file = Path(str(artifact) + ".sha256")
sha_file.write_text(
    f"{digest}  {artifact.name}\n",
    encoding="utf-8",
)

print("Artifact:", artifact)
print("Entrypoint:", entrypoint)
print("SHA256:", digest)

print("Archive layout:")

if system == "windows":
    with zipfile.ZipFile(artifact) as z:
        for name in z.namelist():
            print(" ", name)
else:
    with tarfile.open(artifact, "r:gz") as tf:
        for name in tf.getnames():
            print(" ", name)
