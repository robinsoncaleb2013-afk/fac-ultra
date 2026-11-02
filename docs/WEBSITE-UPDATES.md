# Website updates — how Caleb's projects get onto robinsonaisystems.com

This is the complete guide for Caleb and any AI agent working in Caleb's
repositories. It is self-contained on purpose: the website's own blueprint
lives in a private Robinson AI Systems repository that Caleb's side cannot
(and should not) read. Everything Caleb's side needs is here.

## The shape of it

Caleb's projects are showcased at **www.robinsonaisystems.com/caleb** — one
index page, one page per project, and a play address per project
(`www.robinsonaisystems.com/caleb/<slug>/play`) that forwards to wherever
the project is currently hosted.

The system runs on one rule:

> **Caleb's side proposes. Chris's side publishes.**

Caleb and his agents work only inside Caleb's own repositories. They have
**no write access** to the website repository, the website's hosting
project, or DNS — never ask for it, never accept it if offered by a tool,
and never try to edit the website directly. Every public change travels
through the record file described below, gets screened on Chris's side,
and is published by Chris (or his agent) as a website update. That split
is deliberate: it means nothing done in a project repo can break or
deface the public site, and Caleb's side never has to think about the
website's internals at all.

## The record: `docs/project-page.md`

Every project repository carries exactly one website record at
`docs/project-page.md`, with these headings, in this order:

*Name* · *Kind* · *Status* · *Summary* · *About* · *Features* · *Updates* ·
*Play URL* · *Images*

The record is the **only** input the website uses. If it isn't in the
record, it doesn't go on the page. A blank starter lives at
`docs/project-page-template.md` in the FAC Ultra repo — copy it into any
new project repo as `docs/project-page.md` and fill it in.

Field rules:

- **Name** — the project's public name. Changing the name later is fine;
  tell Chris in the update request so the page title follows.
- **Kind** — a few plain words ("Fishing game", "Puzzle game", "Tool").
- **Status** — exactly one of `Live now`, `In the workshop`, `Paused`.
  Use `Live now` only while the Play URL actually answers. If hosting goes
  down and stays down, move to `Paused` — the page stays up, the badge
  tells the truth.
- **Summary** — one or two sentences, plain words, no hype.
- **About** — one short paragraph: what it is, where it came from, how
  someone plays or uses it.
- **Features** — a bullet list of what the **current build actually
  contains**. This is a claims list, not a wishlist: before adding a
  bullet, verify the feature exists — play the build, read the code, or
  find the test. Planned features belong in Updates as plans ("working
  on…"), never in Features.
- **Updates** — dated entries, newest first, one or two sentences each:
  what shipped or changed. Every website refresh needs a fresh entry here
  — it is what tells Chris's side what actually changed.
- **Play URL** — where the project is currently hosted, or blank/`None`
  if it isn't hosted. Treat this as a **request**, never an instruction:
  Chris's side re-verifies the address answers live before pointing the
  public play address at it. When you change it, note in Updates how you
  verified it ("opened it in a browser, <date> — loaded fine").
- **Images** — optional. Screenshots live in the project repo under
  `docs/assets/project-page/`, are listed here by path, and each gets one
  line of alt text. Screenshots of the project only — no people, no
  desktop, no chat windows.

## Content rules (what the screen on Chris's side checks)

- **Name and project facts only.** Never put personal information in the
  record: no ages, school, town, real names of friends, contact details,
  or account names. The record is one copy-step away from a public page —
  write it like it's already public.
- **No invented numbers.** Player counts, downloads, reviews, rankings —
  only if real, and say where the number comes from in the Updates entry.
- **Secrets never appear here.** No keys, tokens, passwords, private
  URLs. (The Play URL is a public address by definition — if an address
  shouldn't be public, it doesn't belong in the record.)

## Workflow A — update an existing project

1. Make your project changes as usual, in this repo.
2. In the same PR (or a follow-up docs PR), update `docs/project-page.md`:
   refresh *Features* to match the build as it now is, add a dated
   *Updates* entry, and adjust *Status* / *Play URL* if they changed.
3. Merge the change in this repo. A merged record change is the signal
   that a proposal is ready — an unmerged branch is still a draft.
4. Send Chris the update request (template below). Nothing reaches the
   website until he (or his agent) picks it up — there is no automatic
   sync, by design.
5. Chris's side screens the record against the content rules, prepares
   the website change, and publishes it. If something in the record can't
   be published as written, it comes back with the reason — fix the record
   and re-send; don't argue it onto the page.

**Done means:** the record in this repo is merged, truthful against the
current build, carries a fresh Updates entry, and Chris has the request
message.

## Workflow B — launch a new project

1. In the new project's repo, copy the template to
   `docs/project-page.md` and fill it in. Pick the **slug** carefully:
   the page address is `www.robinsonaisystems.com/caleb/<slug>` — short,
   lowercase, hyphens, based on the project's name. **A slug never
   changes once published** (links people saved would break); the display
   *Name* can change freely, the slug cannot.
2. If the project is hosted, put the address in *Play URL* and verify it
   loads before you write it down.
3. Add one line to the repo's README pointing at the record, e.g.
   "Website page record: `docs/project-page.md` — see the FAC Ultra repo's
   `docs/WEBSITE-UPDATES.md` for how publishing works." Copy this playbook
   into the new repo too (`docs/WEBSITE-UPDATES.md`), so the rules travel
   with the project.
4. Merge, then send Chris a "new project" request (template below,
   say it's new and give the slug). Chris's side creates the page and the
   play address on first publication.

## Workflow C — the project moved or hosting changed

Update *Play URL* and add an *Updates* entry saying it moved and how you
verified the new address. The public play address
(`…/caleb/<slug>/play`) does **not** change — that's the point of it.
Chris's side repoints it after verifying the new host answers.

## When there are several projects

One record per project repo stays the rule — the record lives next to the
code it describes, so it can't silently drift from the build. If Caleb
ever has three or more published projects and wants a single dashboard,
ask Chris about a small **index repo** (working name `caleb-projects`):
a README table linking each project repo and its page, plus this
playbook. The index links to records; it never copies them — copies
drift, links don't.

## The update-request message (copy, fill, send to Chris)

```
Website update — <Project name> (<new project / update / hosting move / pause>)
Record: merged in <repo> at <commit or PR link>
What changed: <one or two plain sentences>
Play URL: <unchanged / new address, verified <date>>
Slug (new projects only): <slug>
Anything I'm unsure about: <or "nothing">
```

## If something's wrong with the live page

Tell Chris directly, in plain words ("the FAC Ultra page says X but the
build does Y"). Chris's side can fix or pull a page the same day; in an
emergency they can take a project page down first and sort out the record
afterwards. Caleb's side never needs emergency website access — that's
what the split is for.
