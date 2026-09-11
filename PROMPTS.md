# Prompts

Verbatim prompts used to develop Machina Practica packages.

---

> Read SETUP_MD.md and follow its directions.

Recorded 2026-09-11 from human maintainer. PR: pending organization creation. The named file was absent; the agent read SETUP_MP.md and asked whether that was the intended execution brief.

---

> yes

Recorded 2026-09-11 from human maintainer. PR: pending organization creation. Confirms SETUP_MP.md as the execution brief. SETUP_MP.md, SETUP_PROPOSAL.md, and OURWAY_PROPOSAL.md are imported planning artifacts; this agent did not author their research or original text.

---

> ok I logged into npm and created the machinapractica org. npm is logged in. Tell me again why I have to use github's website and waht the minimal steps are

Recorded 2026-09-11 from human maintainer. PR: pending bootstrap publication. Continues the authorized organization, repository, and website bootstrap.

---

> ok I have done it. let's complete setup

Recorded 2026-09-11 from human maintainer. PR: pending bootstrap publication. Continues the authorized organization, repository, and website bootstrap.

---

> GPLv3

Recorded 2026-09-11 from human maintainer. PR: pending bootstrap publication. Selects GPLv3 for original repository content.

Bootstrap implementation note (2026-09-11): the continuation prompt above also fixes provenance validation for an empty remote before the first push; the full proposed history must contain PROMPTS.md. Existing remotes still require the selected base branch.
The empty-tree calculation reads /dev/null explicitly so pre-push reference input cannot be mistaken for tree bytes.

Publication reference (2026-09-11): the bootstrap prompts recorded above produced https://github.com/machinapractica/packages/pull/1. This resolves their earlier pending PR references without changing historical prompt text.

---

> ok I have done it. let's complete setup

Recorded 2026-09-11 from human maintainer; repeated verbatim to associate the continuation with the operational follow-up PR (pending). Retain Git ancestry during provenance fetches and validate changes on main as well as pull requests.

Publication reference (2026-09-11): the operational follow-up above produced https://github.com/machinapractica/packages/pull/2.

---

> OK let's complete as much as possible from SETUP_PROPOSAL.md and OURWAY_PROPOSAL.md without modifying source repositories (that is, create components that are meant to be re-usable, but don't yet put up PRs that morph existing projects to use them; build out the skills that are needed, but don't yet use them to create a new project).

Recorded 2026-09-11 from human maintainer. PRs: pending reusable skills and package implementation. Source repositories are read-only evidence; no consumer migrations or new projects are authorized.
