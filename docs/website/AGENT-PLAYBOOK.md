# Agent playbook — Caleb's website pages

You are an AI agent helping **Caleb Robinson** with one of his projects. Part of
that job is keeping his page on the Robinson AI Systems website current. This
playbook is the whole contract. The website-side rules live in the
`robinson-ai-systems` repo's `docs/WEBSITE-BLUEPRINT.md` ("The Caleb Robinson
projects section"); this file is the Caleb-side working copy of the same deal.

## Know your user

Caleb is a beginner who is just starting with AI tools. He built FAC Ultra
inside Grok's builder/preview space and is still learning what repositories,
hosting and publishing are. Therefore:

- **You do all the mechanics.** Files, commits, branches, records — yours.
  Caleb's part is saying what he wants in normal words.
- **Explain outcomes in one or two plain sentences.** No jargon dumps. If you
  must use a technical word, define it in the same breath.
- **Never make him operate the GitHub website UI** unless there is genuinely
  no other route, and then walk him through it one click at a time.

## The map

| Thing | Where it is | Who can change it |
| --- | --- | --- |
| This project (code + these docs) | This repository, owned by Caleb | Caleb and his agents |
| Caleb's public pages | `www.robinsonaisystems.com/caleb` and `/caleb/<slug>` | Caleb edits his section in his own fork of the website repo; Chris (Dad) and his agents screen and publish |
| A project's play address | `www.robinsonaisystems.com/caleb/<slug>/play` | A redirect set only by Chris's side |
| The live game itself | Wherever it is hosted (FAC Ultra: Dad's gaming PC) | Whoever hosts it |
| A Grok/builder **preview** | Inside the builder tool | Caleb — and it is **never** the public link |

## Hard rules — never do these

1. **Never try to edit the Robinson AI Systems website repo directly, its
   Vercel project, or any DNS.** Caleb's account is read-only there, by design.
   His section edits happen in his **fork** of that repo, inside his fenced
   area only (`src/caleb/`, `assets/caleb/`, `docs/caleb/`, `tests/caleb*.test.mjs`
   there), under that repo's own agent guide (its `docs/caleb` folder — read it
   before any section work; it wins for website work). If you somehow get write
   access to the real website repo, stop and tell Chris — the fence depends on
   him not having it. Publishing is his side's job, so Caleb's side can never
   break or deface the company site.
2. **Never put personal information in anything public-facing:** no age,
   school, location, contact details, account names, or anyone else's
   personal information. Public copy is Caleb's name + project facts, only.
3. **Never invent.** Features list only what the current build actually does.
   No player counts, reviews, rankings or promises about unbuilt features
   (upcoming things may be described as *planned*, labelled as such).
4. **Never share a preview URL or a hosting URL as the public link.** The only
   addresses anyone shares are the `robinsonaisystems.com/caleb/...` ones.
5. **Never change a Play URL yourself.** A new hosting address is a *request*
   inside the project record (see W4); Chris's side verifies it loads and
   sets the redirect.
6. **No secrets in records or docs** — no passwords, tokens, keys, or private
   addresses (including tailnet addresses) in any file meant to be read by
   people or published.
7. **Don't rewrite shared history** (no force-pushes, no deleting branches
   others use) without Chris's side agreeing first.

## The record: `docs/project-page.md`

Every project that has (or wants) a website page keeps this one file in its
own repo, with exactly these headings: *Name*, *Kind*, *Status*, *Summary*,
*About*, *Features*, *Updates*, *Play URL*, *Images*. Field rules:

- **Status** is one of: `Live now`, `In the workshop`, `Paused`.
- **Summary** is one or two sentences — it appears on the index card.
- **Features** lists what the build does **today**, as bullets.
- **Updates** are dated entries, newest first, in plain words a friend would
  understand ("Added the swamp level", not "Refactored biome pipeline").
- **Play URL** is where the project is actually hosted right now, or "Not
  hosted yet". It is information for Chris's side, never the public link.
- **Images** are paths to screenshots inside the same repo, or "None yet".

A blank record for a new project is in `docs/website/project-page-template.md`.

## Page modes — decide this for every project

A project's page does one of three jobs. The record is the same either way;
the mode is chosen at bootstrap (see `new-project-checklist.md`) and can
change as the project grows.

- **Showcase** — the project isn't playable by the public (yet, or ever).
  The page is a progress journal: honest Features as they land, dated
  Updates, screenshots. No Play button. Most projects live here.
- **Access point** — the project is hosted and playable. The page carries
  the Play button and the on-site play address forwards to the hosting.
  Status and hosting health are linked duties here: if it stops working,
  W3 applies the same day.
- **Launch** — the final stretch before a public release. The page may
  describe the release as *planned* (labelled as such, with the date if
  Caleb has committed to one), the checklist's launch steps run, and the
  mode flips to Access point (if hosted) or Showcase at release.

## Project bootstrap — part of starting any project

When Caleb starts a new project, its website setup is part of the design,
not a later favour: run `new-project-checklist.md` in this folder. In
short: choose the permanent slug, create the record from the template,
choose the page mode, register the project, put the website line in the
project's own plan, and signal Chris to create the page. If you arrive in
an existing Caleb project that has no `docs/project-page.md`, bootstrap it
the same way before doing website work of any kind.

## Workflows

**W1 — Update a page's words or features.** Edit the record in the project's
repo, run the quality checklist below, signal Chris (format below). Done when
Chris's side confirms it's live — until then, say "sent to Dad for
publishing", not "published".

**W2 — Announce something new in the project.** Add an *Updates* entry with
today's date, and refresh *Features* if the build changed. Then W1.

**W3 — Status change.** Change *Status* (e.g. the game is live → `Live now`;
taking a break → `Paused`). Then W1. If a live project stops working, set
`Paused` and signal Chris the same day — the website should never advertise a
dead game as live.

**W4 — The project moved hosting.** Put the new address in *Play URL*, say in
the signal how you checked it loads, then W1. Chris's side re-points the
website's play redirect; the public play address does not change.

**W5 — Start a new project page.** Run the bootstrap above
(`new-project-checklist.md`): record from the template, slug chosen, mode
chosen, registry updated. Signal Chris with the repo link and the proposed
slug. Chris's side creates the page and play address. One project, one
record, one slug — forever; slugs don't get renamed.

**W6 — Retire a project.** Set *Status* to `Paused` and add an *Updates* entry
saying it's retired, then signal Chris and ask for the page to be pulled.
Only Chris's side removes pages.

**W7 — Redesign Caleb's website section.** This is website work, not game
work: follow the website repo's own agent guide (the `docs/caleb` folder in
`Robinson-AI-Systems/robinson-ai-systems` — Caleb's fork of it). In short:
sync the fork, branch `caleb/<slug>-<topic>`, edit only his area there (pages,
styles, records — full edit), `npm run check` green, pull request to the real
repo, preview through Dad's side's intake, Dad's side screens and publishes.
The record workflow above (W1) still governs *news*; W7 governs the section
itself.

## How to signal Chris

One short message containing: the project slug; what changed (max three
bullets); a link to the commit or PR in Caleb's repo; and anything that needs
his decision, stated as a question. **No signal = no publish.** Batch small
changes into one signal rather than dribbling them.

## Quality checklist (before every signal)

- [ ] Every feature listed works in the current build — I checked, not assumed
- [ ] Updates have real dates and are newest-first
- [ ] No personal information anywhere (rule 2)
- [ ] Summary is one or two sentences
- [ ] Play URL loads (if the project is marked `Live now`)
- [ ] Spelling pass done; a friend who has never seen the project would
      understand every line

If anything on this list is uncertain, stop and ask Chris rather than
guessing about public content.
