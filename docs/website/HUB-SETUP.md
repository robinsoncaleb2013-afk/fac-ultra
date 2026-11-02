# The Caleb Projects Hub — setup plan

**Status:** designed 2026-11-02; the repo does not exist yet. One short
owner step creates it (below), then Vivienne seeds it in one move.

## Why a hub

Today FAC Ultra is Caleb's only project, so its website record lives in its
own repo (`docs/project-page.md`) and that is enough. As projects multiply,
hunting through every repo to answer "what does Caleb have, and what's the
state of its page?" gets silly — especially for a beginner and the agents
helping him. The hub is **one front door**:

- one registry of every project Caleb has, in every state;
- one copy of the agent playbook and the templates, so every new project
  starts the same way;
- one place Chris's side checks when publishing updates — instead of polling
  every project repo;
- room for projects that are not code repos at all (a story world, a robot,
  a video series) — they get a folder and a record, same as a game.

The hub changes **staging**, never **publishing**: the website still only
changes through Chris's side (screen → PR → Chris's merge), exactly as the
playbook describes.

## The repo

- **Owner / name:** `robinsoncaleb2013-afk/caleb-projects`
- **Visibility:** private. The public surface is the website; the hub is the
  workshop notebook.
- **Layout:**

```text
README.md                     — what this repo is, in Caleb's words-first style
START-HERE.md                 — Caleb's plain-language guide (generalised
                                from fac-ultra's docs/website/START-HERE-CALEB.md)
AGENTS.md                     — the agent playbook (from fac-ultra's
                                docs/website/AGENT-PLAYBOOK.md, generalised)
registry.json                 — machine-readable index of every project
projects/<slug>/project-page.md — the website record for that project
templates/project-page.md     — the blank record
templates/new-project-checklist.md — the W5 workflow as a checklist
```

- **`registry.json` shape** (one entry per project; Chris's side reads this
  to know what exists and what state each page is in):

```json
{
  "projects": [
    {
      "slug": "fac-ultra",
      "name": "FAC Ultra",
      "kind": "Fishing game",
      "status": "Live now",
      "repo": "robinsoncaleb2013-afk/fac-ultra",
      "page": "https://www.robinsonaisystems.com/caleb/fac-ultra",
      "play": "https://www.robinsonaisystems.com/caleb/fac-ultra/play",
      "record": "projects/fac-ultra/project-page.md",
      "updated": "2026-11-02"
    }
  ]
}
```

## How the flow works once the hub exists

1. Caleb or his agents update `projects/<slug>/project-page.md` and the
   `registry.json` entry in the hub (a branch + PR inside the hub is fine —
   it's Caleb's own repo), then signal Chris as the playbook describes.
2. Vivienne (Chris's agent) reads the hub — one place — screens the record,
   and publishes to the website as before.
3. The per-project `docs/project-page.md` files then become **pointers**
   ("the canonical record lives in caleb-projects/projects/<slug>/") so the
   words never drift in two directions. The hub copy wins any disagreement.
4. New project? Add a folder, a record from the template, and a registry row
   — the hub checklist walks the agent through it, and the signal to Chris
   asks for the page to be created.

## Create it (one owner step, ~2 minutes)

Chris's tools can only write to Caleb-account repos that are enrolled for
them; today only `fac-ultra` is enrolled, and the guard refuses to create a
brand-new repo there. So:

1. In Caleb's GitHub (with Chris's help): **New repository** → owner
   `robinsoncaleb2013-afk` → name `caleb-projects` → **Private** → Create.
   No template, no README needed — seeding brings everything.
2. Tell Vivienne "the hub repo exists". She seeds it from the package in
   fac-ultra's `docs/website/` (this file's layout), adds FAC Ultra as the
   first registry entry, and — if the write guard asks — walks Chris through
   enrolling `robinsoncaleb2013-afk/caleb-projects` the same way fac-ultra
   was enrolled.
3. Chris's side adds a one-line pointer to the hub in the website
   blueprint's Caleb section, and the system is fully hub-based.

Until then, nothing is blocked: FAC Ultra's own repo carries the record and
the playbook, and publishing already works.
