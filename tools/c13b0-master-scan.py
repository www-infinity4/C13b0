#!/usr/bin/env python3
"""C13b0 Master Scan — compact capability/index router for Infinity repositories.

Standard-library only. It discovers every public repository for an owner, reads
Git trees without cloning repositories, detects reusable Infinity infrastructure,
and emits a compact index for C13b0/front-end routing.

Usage:
  python tools/c13b0-master-scan.py
  python tools/c13b0-master-scan.py --owner www-infinity4 --out phi-index

Optional GITHUB_TOKEN increases API limits but is not required for public repos.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import Counter, defaultdict
from pathlib import Path

API = "https://api.github.com"
TEXT_EXT = {".md", ".txt", ".json", ".toml", ".yaml", ".yml", ".py", ".js", ".jsx", ".ts", ".tsx", ".html", ".css", ".xml", ".sql", ".gradle"}
SKIP = ("node_modules/", "vendor/", "dist/", "build/", ".next/", ".git/", "coverage/", "__pycache__/", "android/.gradle/")
MAX_FILE = 180_000
MAX_FILES_PER_REPO = 24

# Things repeatedly intended to travel with Infinity pages.
SHARED_FEATURES = {
    "preview-image": [r"og:image", r"twitter:image", r"preview", r"share-preview", r"c13b0-preview"],
    "open-graph": [r"openGraph", r"og:title", r"og:description"],
    "x-large-card": [r"twitter", r"summary_large_image"],
    "share-post": [r"navigator\.share", r"Share/Post", r"twitter\.com/intent", r"x\.com/intent"],
    "unified-wallet": [r"unified.?wallet", r"wallet\.ts", r"Infinity wallet", r"centralized.*wallet"],
    "star-coin": [r"StarCoin", r"Star Coin", r"star.?coin"],
    "share-reward": [r"share.*reward", r"reward.*share", r"10 shares", r"share.*coin"],
    "durable-ledger": [r"durable.?ledger", r"ledger", r"idempotenc", r"D1"],
    "token-engine": [r"token.?engine", r"action.?token", r"mint"],
    "scanner-manifest": [r"infinity-site\.json", r"infinity-site/v1"],
    "canonical-url": [r"canonical", r"canonicalUrl"],
    "mobile-first": [r"viewport", r"mobile-first", r"Capacitor"],
    "pwa": [r"manifest\.webmanifest", r"service.?worker", r"sw\.js"],
    "image-search": [r"image.?search", r"image generation", r"image generator"],
    "website-builder": [r"auto.?builder", r"site.?builder", r"Build Website", r"PuckBuilder"],
    "research": [r"research", r"overview", r"citation"],
    "3d": [r"three\.js", r"three", r"3d", r"webgl", r"blender"],
    "video": [r"ffmpeg", r"video", r"mp4", r"webm"],
    "audio": [r"audio", r"midi", r"sound", r"voice"],
    "computer-vision": [r"opencv", r"yolo", r"segment anything", r"depth anything", r"ocr"],
    "ai-generation": [r"comfyui", r"diffusers", r"flux", r"wan", r"ltx", r"trellis", r"hunyuan"],
}

CATEGORY_RULES = {
    "core-platform": ["infinity", "c13b0", "unifier", "spark", "index"],
    "wallet-token-economy": ["wallet", "coin", "token", "mint", "bitcoin"],
    "image-graphics": ["image", "graphic", "camera", "photo", "comfy", "flux", "diffuser"],
    "video-media": ["video", "tv", "theater", "flix", "ffmpeg", "cartoon"],
    "audio-music": ["audio", "music", "radio", "sound", "jukebox"],
    "3d-spatial": ["3d", "blender", "trellis", "hunyuan", "depth"],
    "ai-knowledge": ["ai", "gemma", "gpt", "knowledge", "doc"],
    "games": ["game", "mario", "atari", "tetris", "emulat", "escape", "pirates"],
    "engineering-robotics": ["robot", "r2d2", "actuator", "machine", "cnc", "engineering"],
    "science-research": ["research", "element", "ion", "radiation", "magnet", "inertia", "fission"],
    "web-infrastructure": ["git", "host", "web", "cloudflare", "vercel", "pages"],
}

PHI_STAGE = {
    "research": "yellow", "computer-vision": "yellow", "image-search": "yellow",
    "website-builder": "orange", "token-engine": "orange", "share-reward": "orange",
    "video": "blue", "audio": "blue", "durable-ledger": "blue", "unified-wallet": "blue",
    "ai-generation": "white", "3d": "white", "preview-image": "red", "scanner-manifest": "red",
}


def request_json(url: str, token: str | None, retries: int = 3):
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "C13b0-Master-Scanner", "X-GitHub-Api-Version": "2022-11-28"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=35) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            if e.code in (403, 429) and attempt + 1 < retries:
                reset = e.headers.get("X-RateLimit-Reset")
                wait = max(2, int(reset) - int(time.time()) + 1) if reset and reset.isdigit() else 5 * (attempt + 1)
                time.sleep(min(wait, 60))
                continue
            raise


def list_repos(owner: str, token: str | None):
    repos, page = [], 1
    while True:
        url = f"{API}/users/{urllib.parse.quote(owner)}/repos?per_page=100&page={page}&type=owner&sort=full_name"
        batch = request_json(url, token)
        if not batch:
            break
        repos.extend(batch)
        if len(batch) < 100:
            break
        page += 1
    return repos


def tree_for(repo: dict, token: str | None):
    owner = repo["owner"]["login"]
    name = repo["name"]
    branch = urllib.parse.quote(repo.get("default_branch") or "main", safe="")
    return request_json(f"{API}/repos/{owner}/{name}/git/trees/{branch}?recursive=1", token)


def raw_text(repo: dict, path: str, token: str | None):
    owner, name = repo["owner"]["login"], repo["name"]
    qpath = "/".join(urllib.parse.quote(x, safe="") for x in path.split("/"))
    url = f"{API}/repos/{owner}/{name}/contents/{qpath}?ref={urllib.parse.quote(repo.get('default_branch') or 'main', safe='')}"
    data = request_json(url, token)
    if isinstance(data, dict) and data.get("encoding") == "base64":
        import base64
        return base64.b64decode(data.get("content", "")).decode("utf-8", "replace")
    return ""


def worth(path: str, size: int) -> int:
    p = path.lower()
    if any(s in p for s in SKIP) or size > MAX_FILE:
        return -100
    ext = Path(p).suffix
    if ext not in TEXT_EXT and Path(p).name not in {"dockerfile", "makefile"}:
        return -100
    score = 0
    if p in {"readme.md", "package.json", "pyproject.toml", "requirements.txt", "infinity-site.json"}: score += 30
    if p.startswith("src/") or p.startswith("app/"): score += 14
    if "/api/" in p or "route." in p or "registry" in p or "manifest" in p: score += 16
    if "wallet" in p or "token" in p or "coin" in p or "share" in p: score += 18
    if "index" in p or "builder" in p or "scanner" in p: score += 14
    if "test" in p: score -= 8
    if p.endswith((".ts", ".tsx", ".py", ".js", ".jsx")): score += 5
    return score


def classify_categories(text: str):
    low = text.lower()
    scored = []
    for cat, words in CATEGORY_RULES.items():
        n = sum(low.count(w) for w in words)
        if n: scored.append((n, cat))
    return [c for _, c in sorted(scored, reverse=True)[:4]] or ["uncategorized"]


def feature_evidence(texts: list[tuple[str, str]]):
    found = defaultdict(list)
    joined = "\n".join(t for _, t in texts)
    for feature, patterns in SHARED_FEATURES.items():
        for pattern in patterns:
            rx = re.compile(pattern, re.I)
            paths = [p for p, t in texts if rx.search(p) or rx.search(t)]
            if paths:
                found[feature] = sorted(set(paths))[:6]
                break
    return dict(found), joined


def status_for(feature: str, evidence: list[str], all_paths: set[str]):
    if not evidence:
        return "SHOULD_DO" if feature in {"preview-image", "unified-wallet", "share-post", "scanner-manifest"} else "ABSENT"
    test_hint = any("test" in p.lower() for p in evidence)
    implementation = any(p.lower().endswith((".ts", ".tsx", ".js", ".jsx", ".py", ".html")) for p in evidence)
    if feature == "preview-image":
        image_present = any(Path(p).suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"} and "preview" in p.lower() for p in all_paths)
        return "CAN_DO" if image_present else "PARTIAL"
    if implementation and test_hint: return "CAN_DO"
    if implementation: return "NEEDS_TEST"
    return "PARTIAL"


def scan_repo(repo: dict, token: str | None):
    tree = tree_for(repo, token)
    entries = tree.get("tree", []) if isinstance(tree, dict) else []
    blobs = [e for e in entries if e.get("type") == "blob"]
    all_paths = {e.get("path", "") for e in blobs}
    ranked = sorted(((worth(e.get("path", ""), e.get("size") or 0), e) for e in blobs), key=lambda x: x[0], reverse=True)
    selected = [e for score, e in ranked if score >= 0][:MAX_FILES_PER_REPO]
    texts = []
    errors = []
    for e in selected:
        try:
            texts.append((e["path"], raw_text(repo, e["path"], token)))
        except Exception as ex:
            errors.append(f"{e['path']}: {type(ex).__name__}")
    features, joined = feature_evidence(texts)
    categories = classify_categories(" ".join([repo["name"], repo.get("description") or "", joined[:120000]]))
    capabilities = []
    for feature, evidence in sorted(features.items()):
        capabilities.append({
            "name": feature,
            "status": status_for(feature, evidence, all_paths),
            "phiStage": PHI_STAGE.get(feature, "orange"),
            "evidence": evidence,
        })
    for required in ("preview-image", "unified-wallet", "share-post", "scanner-manifest"):
        if required not in features:
            capabilities.append({"name": required, "status": "SHOULD_DO", "phiStage": PHI_STAGE.get(required, "orange"), "evidence": []})
    return {
        "name": repo["name"], "fullName": repo["full_name"], "url": repo["html_url"],
        "description": repo.get("description"), "fork": repo.get("fork", False),
        "defaultBranch": repo.get("default_branch"), "language": repo.get("language"),
        "sizeKB": repo.get("size"), "updatedAt": repo.get("updated_at"),
        "categories": categories, "capabilities": capabilities,
        "indexedFiles": [e["path"] for e in selected], "treeTruncated": bool(tree.get("truncated")),
        "scanErrors": errors,
    }


def write_outputs(out: Path, records: list[dict]):
    out.mkdir(parents=True, exist_ok=True)
    (out / "repos").mkdir(exist_ok=True)
    counts = Counter()
    category_map = defaultdict(list)
    frontend = []
    with (out / "search-index.jsonl").open("w", encoding="utf-8") as f:
        for r in records:
            safe = re.sub(r"[^A-Za-z0-9._-]+", "_", r["name"])
            (out / "repos" / f"{safe}.json").write_text(json.dumps(r, indent=2), encoding="utf-8")
            for cat in r["categories"]: category_map[cat].append(r["fullName"])
            for cap in r["capabilities"]:
                counts[cap["status"]] += 1
                row = {"repo": r["fullName"], "category": r["categories"], **cap}
                f.write(json.dumps(row, separators=(",", ":")) + "\n")
                if cap["status"] in {"CAN_DO", "NEEDS_TEST", "PARTIAL"}:
                    frontend.append(row)
    catalog = {
        "schema": "c13b0-capability-index/v1", "owner": records[0]["fullName"].split("/")[0] if records else None,
        "repositories": len(records), "statusCounts": dict(counts), "categories": dict(sorted(category_map.items())),
        "routingRule": "Prefer CAN_DO; then NEEDS_TEST; then PARTIAL. SHOULD_DO is backlog, never a claimed runtime capability.",
    }
    (out / "catalog.json").write_text(json.dumps(catalog, indent=2), encoding="utf-8")
    (out / "frontend-index.json").write_text(json.dumps(frontend, indent=2), encoding="utf-8")
    (out / "capabilities.json").write_text(json.dumps(sorted({x["name"] for r in records for x in r["capabilities"]}), indent=2), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--owner", default="www-infinity4")
    ap.add_argument("--out", default="phi-index")
    ap.add_argument("--limit", type=int, default=0, help="development limit; 0 scans all")
    args = ap.parse_args()
    token = os.environ.get("GITHUB_TOKEN")
    repos = list_repos(args.owner, token)
    if args.limit: repos = repos[:args.limit]
    records = []
    print(f"C13b0 Master Scan: {len(repos)} repositories discovered for {args.owner}")
    for i, repo in enumerate(repos, 1):
        print(f"[{i}/{len(repos)}] {repo['full_name']}")
        try:
            records.append(scan_repo(repo, token))
        except Exception as ex:
            records.append({"name": repo["name"], "fullName": repo["full_name"], "url": repo["html_url"], "categories": ["scan-error"], "capabilities": [], "scanErrors": [repr(ex)]})
    write_outputs(Path(args.out), records)
    print(f"Index written to {args.out}/ — compact frontend routing index: {args.out}/frontend-index.json")


if __name__ == "__main__":
    main()
