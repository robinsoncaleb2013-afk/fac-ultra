# New project checklist — website setup is part of starting a project

Agent: run this when Caleb starts **any** new project that might ever be
shown to friends or the public — a game, a world, a tool, anything. The
website piece is part of the project's design from day one, not an
afterthought. It takes about five minutes and Caleb doesn't need to
understand any of it; explain the result to him in one plain sentence.

## Bootstrap

- [ ] Pick the slug together with the project name: short, lowercase,
      hyphens (e.g. `fac-ultra`). The slug becomes the permanent website
      address — `www.robinsonaisystems.com/caleb/<slug>` — so choose it
      like it will be printed on a poster, because one day it might be.
- [ ] Create `docs/project-page.md` in the project's repo from
      `project-page-template.md`; fill in Name, Kind, Summary and About
      from the project's design notes. Leave Play URL as "Not hosted yet"
      until it truly is.
- [ ] Choose the page mode (see the playbook's "Page modes"): most projects
      start in **Showcase** mode; a project that is already playable
      somewhere starts in **Access point** mode; a project building toward
      a public release date uses **Launch** mode for its final stretch.
- [ ] Set Status to `In the workshop`.
- [ ] Add the project to the registry (the hub repo's `registry.json` once
      it exists; until then, this project's own record is the registry of
      one).
- [ ] Put one line in the project's own plan/roadmap: "Website page:
      /caleb/<slug> — updates flow through docs/project-page.md."
- [ ] Signal Chris that a new project exists (playbook signal format) and
      ask for the page to be created. (Caleb's agent can also add the
      project's record directly in his fork of the website repo — playbook
      W7 — but the page shell and any play redirect are Chris's side's to
      create.) Until Chris's side publishes it, Caleb's address is
      "coming soon", not live.

## While building

- [ ] Every time something becomes true in the build (a level works, a
      feature lands), refresh the record's Features and add a dated
      Updates entry — in the same work session, while it's fresh.
- [ ] Screenshots worth showing go in the repo; list them under Images.

## At launch (if the project launches publicly)

- [ ] Status → `Live now`; Play URL set to the real hosting address
      (W4 rules: it's a request — Chris's side verifies and sets the
      website redirect).
- [ ] Launch Updates entry written like an announcement a friend would
      enjoy reading.
- [ ] Final pass of the playbook quality checklist, then signal Chris:
      "ready to publish the launch update".
