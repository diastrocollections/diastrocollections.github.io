"""Post new version history entries to Discord.

Compares data/version-history.json at two git revisions and posts every
version that is in AFTER but not in BEFORE, oldest first, as a Discord embed.

Usage:
  python discord_update.py --before <ref> --after <ref>   # post what's new
  python discord_update.py --version 2.5.0                # (re)post one entry
  add --dry-run to print the message instead of sending it

  A ref of WORKTREE reads the file from disk instead of git.

Environment:
  DISCORD_WEBHOOK_URL  the channel webhook (a repo secret)
  DISCORD_ROLE_ID      optional: a role to @mention with every post
"""

import argparse
import html
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.request

SITE = "https://diastrogaming.com"
FILE = "data/version-history.json"
COLOUR = 0x4F8F52  # hub accent, light mode
MAX_NEW = 3  # more than this at once means something's off: post nothing
DESCRIPTION_LIMIT = 4096  # Discord's embed description limit


def load(ref):
    if ref == "WORKTREE":
        with open(FILE, encoding="utf-8") as f:
            return json.load(f)
    out = subprocess.run(["git", "show", f"{ref}:{FILE}"],
                         capture_output=True, text=True)
    if out.returncode != 0:
        return None
    return json.loads(out.stdout)


def to_markdown(text, in_bold=False):
    """Turn the small HTML subset used in the version history into Discord markdown."""
    def link(m):
        href, label = m.group(1), m.group(2)
        if href.startswith("/"):
            href = SITE + href
        return f"[{label}]({href})"

    text = re.sub(r'<a\s[^>]*href="([^"]+)"[^>]*>(.*?)</a>', link, text, flags=re.S)
    bold = "" if in_bold else "**"
    text = re.sub(r"</?(strong|b)>", bold, text)
    text = re.sub(r"</?(em|i|cite)>", "*", text)
    text = re.sub(r"<[^>]+>", "", text)
    return html.unescape(text).strip()


def build_message(entry, role_id):
    version = entry["version"]
    url = f"{SITE}/version-history/#v" + re.sub(r"[^0-9A-Za-z]+", "-", version)
    more = f"\n\n[Read the full notes on the site]({url})"

    blocks = []
    for section in entry.get("sections", []):
        lines = []
        if section.get("heading"):
            lines.append("**" + to_markdown(section["heading"], in_bold=True) + "**")
        if section.get("text"):
            lines.append(to_markdown(section["text"]))
        for b in section.get("bullets", []):
            lines.append("• " + to_markdown(b.get("text", "")))
            lines += ["  ◦ " + to_markdown(s.get("text", "") if isinstance(s, dict) else s)
                      for s in b.get("sub", [])]
        blocks.append("\n".join(lines))

    description = "\n\n".join(blocks)
    if len(description) > DESCRIPTION_LIMIT:
        cut = description[:DESCRIPTION_LIMIT - len(more) - 1]
        description = cut[:cut.rfind("\n")].rstrip() + "\n…" + more

    kind = {"major": "Major update", "minor": "Update", "patch": "Patch"}.get(entry.get("type"), "Update")
    message = {
        "embeds": [{
            "title": f"Version {version}",
            "url": url,
            "description": description,
            "color": COLOUR,
            "author": {"name": "Diastro Gaming Collections", "url": SITE},
            "footer": {"text": f"{kind} · {entry.get('date', '')}"},
        }],
        # Never ping anything by accident, only the configured role.
        "allowed_mentions": {"parse": [], "roles": [role_id] if role_id else []},
    }
    if role_id:
        message["content"] = f"<@&{role_id}>"
    return message


def send(webhook, message):
    req = urllib.request.Request(
        webhook + ("&" if "?" in webhook else "?") + "wait=true",
        data=json.dumps(message).encode(),
        headers={"Content-Type": "application/json",
                 # Discord refuses the default Python user agent.
                 "User-Agent": "DiastroGamingCollections-VersionFeed (https://diastrogaming.com, 1.0)"},
    )
    try:
        urllib.request.urlopen(req, timeout=20)
    except urllib.error.HTTPError as e:
        sys.exit(f"Discord said {e.code}: {e.read().decode(errors='replace')}")


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--before")
    p.add_argument("--after", default="HEAD")
    p.add_argument("--version")
    p.add_argument("--dry-run", action="store_true")
    a = p.parse_args()

    after = load(a.after)
    if after is None:
        sys.exit(f"Can't read {FILE} at {a.after}")

    if a.version:
        entries = [e for e in after if e["version"] == a.version]
        if not entries:
            sys.exit(f"No entry for version {a.version}")
    else:
        before = load(a.before) if a.before else None
        if before is None:
            print(f"Can't read {FILE} at {a.before!r}, so there's nothing to compare against. Posting nothing.")
            return
        seen = {e["version"] for e in before}
        entries = [e for e in after if e["version"] not in seen]
        if len(entries) > MAX_NEW:
            sys.exit(f"{len(entries)} new versions at once looks wrong. Posting nothing. "
                     "Use the manual run to post a specific version.")
        entries.reverse()  # the file is newest first; post oldest first

    if not entries:
        print("No new versions.")
        return

    role_id = os.environ.get("DISCORD_ROLE_ID", "").strip()
    webhook = os.environ.get("DISCORD_WEBHOOK_URL", "").strip()
    for entry in entries:
        message = build_message(entry, role_id)
        if a.dry_run:
            print(json.dumps(message, indent=2, ensure_ascii=False))
        elif not webhook:
            sys.exit("DISCORD_WEBHOOK_URL is not set")
        else:
            send(webhook, message)
            print(f"Posted {entry['version']}")


if __name__ == "__main__":
    main()
