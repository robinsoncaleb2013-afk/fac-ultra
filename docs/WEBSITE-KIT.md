# Website kit — setting up any Caleb project for robinsonaisystems.com/caleb

This kit is the starter pack. It lives in the FAC Ultra repo as the
reference copy. When a new Caleb project starts, this kit gets copied
into that project's repo **at setup time** — the website part of a
project is designed in from the beginning, not bolted on at the end.

## For Caleb (plain English)

You do not need to understand how any of this works under the hood. Your
job is one sentence. When you start a project, or when an agent is
working on one, say:

> **"Set this project up for the website using the website kit."**

(or point the agent at `docs/WEBSITE-KIT.md` and `docs/WEBSITE-UPDATES.md`
in this repo).

The agent does the setup. You keep building your project. When something
is ready to show, your agent updates the project's record file and you
send Dad the short request message from the playbook. Dad's side puts it
on the website. You never edit the website yourself, and no agent of
yours ever needs access to it — that part is on purpose, so the website
can't get messed up from a project repo.

## Copy-paste prompt for any agent

```
This project will be showcased at robinsonaisystems.com/caleb.
Read docs/WEBSITE-KIT.md and docs/WEBSITE-UPDATES.md (copied from the
FAC Ultra repo) and set this repo up the same way FAC Ultra is set up:
create docs/project-page.md from the template, create docs/website-plan.md
using the kit's plan outline, add the kit's website section to AGENTS.md,
and add the README pointer line. Then keep the record updated as the
project changes: features only once they're really in the build, a dated
Updates entry for every milestone. Never try to edit the website itself.
```

## Files to copy into a new project repo

| File | Where it goes | What it is |
| --- | --- | --- |
| `WEBSITE-UPDATES.md` | `docs/` | The full playbook: rules and workflows |
| `WEBSITE-KIT.md` | `docs/` | This kit |
| `project-page-template.md` | `docs/` | Blank website record template |
| the filled-in record | `docs/project-page.md` | This project's public page record |
| the plan outline below | `docs/website-plan.md` | This project's internal website plan |

Plus two small edits in the new repo: the AGENTS.md section and the
README pointer line (both below).

## Decide at design time: how this project uses the website

Every project uses Caleb's website section in one or more of these ways.
Pick the ones that fit when the project starts; they can change later,
and the choice goes in `docs/website-plan.md`.

1. **Access point.** The project runs somewhere (today, projects are
   hosted on Dad's gaming PC) and the website page's play address —
   `robinsonaisystems.com/caleb/<slug>/play` — forwards players there.
   The stable public address never changes even if the hosting moves.
2. **Progress updates.** The page works as a build journal: dated
   Updates entries as milestones land — first playable, new level,
   new mode — even before anything is public or playable.
3. **Launch page.** When a project is ready to show people, the page is
   the thing Caleb shares: summary, verified features, a screenshot,
   and the play address. Sharing means sharing the
   `robinsonaisystems.com/caleb/<slug>` link — never the raw hosting
   address.

"Marketing" for Caleb's projects means exactly that launch page and its
updates. Agents do not run ads, post to social platforms, or publish
anything anywhere else under this kit.

## The per-project plan: `docs/website-plan.md`

This file is internal (it is **not** copied to the website). Create it at
setup with these headings:

- **Website role** — which of the three uses above, in plain words.
- **Slug** — the page address piece, chosen once, never changed.
- **Hosting** — where the project runs or will run (e.g. "Dad's gaming
  PC, served like FAC Ultra"), what it needs to run (runtime, roughly
  how much memory/CPU), and how someone starts it. No passwords, keys,
  or private addresses — ever.
- **Update rhythm** — what counts as a milestone worth an Updates entry
  for this project.
- **Launch checklist** — the list below, checked off when the project
  is ready to share.
- **Never public** — anything about this project that must stay out of
  the record (unreleased surprises are fine to list here by topic, not
  by detail).

## AGENTS.md section for the new repo

Add this section to the new repo's `AGENTS.md` (create the file with
just this section if the repo doesn't have one):

```
## Website updates (robinsonaisystems.com/caleb)

This project is showcased at www.robinsonaisystems.com/caleb/<slug>.
Full rules: `docs/WEBSITE-UPDATES.md`; setup: `docs/WEBSITE-KIT.md`;
this project's plan: `docs/website-plan.md`.

- The website input for this project is `docs/project-page.md` and
  nothing else. Update it in the same PR as any change that affects
  what the public page should say, with a dated Updates entry.
- Features in the record are claims: only what the current build
  actually contains, verified. Plans go in Updates as plans.
- No personal information and no secrets in any docs file.
- Never attempt to edit the website itself — no PRs, pushes, or access
  requests against any Robinson AI Systems repository, hosting project,
  or DNS. This side proposes through the record; Chris's side screens
  and publishes. A Play URL in the record is a request, verified live
  on Chris's side before the public play address moves.
```

(Replace `<slug>` with the project's slug.)

## README pointer line

Add one line to the new repo's README:

```
Website: showcased at robinsonaisystems.com/caleb/<slug> — page record
in `docs/project-page.md`, setup in `docs/WEBSITE-KIT.md`.
```

## Launch checklist (per project)

- [ ] Record's Summary and About read well to a stranger
- [ ] Features list verified against the current build, item by item
- [ ] One good screenshot in `docs/assets/project-page/` with alt text
- [ ] Play URL verified loading today (if the project is playable)
- [ ] A launch-dated entry at the top of Updates
- [ ] The request message sent to Chris, marked as a launch
- [ ] Share link is `robinsonaisystems.com/caleb/<slug>` — not the raw host

## The standing duties (every project, always)

- Milestone lands → dated Updates entry in the record.
- Feature ships → Features list updated, same PR.
- Hosting moves or breaks → Play URL / Status updated, request sent.
- Project shelved → Status `Paused`, one-line Updates entry. No drama;
  paused projects are normal.
- Anything Caleb is unsure about → it goes in the request message under
  "Anything I'm unsure about", not silently onto the page.
