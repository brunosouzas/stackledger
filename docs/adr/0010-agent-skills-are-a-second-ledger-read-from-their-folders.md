# 10. Agent skills are a second ledger in the same tool, read from their own folders

- Status: Accepted
- Date: 2026-10-22

## Context

Developers and teams now run AI coding agents (Claude Code, Codex, Copilot, Cursor, Hermes and others) that load *skills*: folders with a `SKILL.md` file, described by the open [Agent Skills specification](https://agentskills.io/specification). Around the skills sit agent definitions (for example Claude Code subagents), multi-step processes that tell an agent which skills to use (we call them playbooks), and rules that reviewers cite by ID. Together they decide how an organisation's agents work, so they need the same governance as the software stack: what exists, who uses it, what is installed where, and what breaks when something changes.

A prototype run on a real setup read 117 skills from four tools, 339 rules, 4 agents and 2 playbooks. Only 25 of the skills lived in the person's skills repository; 25 others existed in a single tool and no other tool could load them; one rule ID was defined twice. Existing projects list public skills (directories, awesome lists) or draw a graph of one folder; none compares what each tool has installed with the source, links skills to the software they need, or treats rules as items of their own.

Skills differ from software in one way that shapes the design: they describe themselves. A `SKILL.md` already has a name, a description and a body; software has no such file, which is why the software catalogue is written by hand ([ADR 2](0002-catalogue-in-backstage-format-in-its-own-repository.md)).

## Options considered

1. A separate tool and npm package for skills, with its own site.
2. A monorepo: the map engine as a shared package, two tools on top of it, and a portal joining the two sites.
3. The same tool, package and site: skills become a second ledger next to the software one.

## Decision

Option 3. One package, one CLI, one site with a Software section and a Skills section, one release.

- **Skills are read, never copied.** stackledger reads skill folders, agent files and rules files where they already are. Nobody writes YAML to describe a skill. Only what a folder cannot say is written by hand: the map of the skills (lines and station positions, with the `Line` and `MapLayout` kinds the software map already uses, per [ADR 3](0003-lines-are-journeys.md) and [ADR 4](0004-own-map-engine-with-stored-positions.md)), kept in the skills repository.
- **Relations are declared, never guessed.** Which skills a playbook loads and which software a skill needs are written in the skill itself, in a form that keeps `SKILL.md` valid under the Agent Skills specification. The prototype guessed software from words in the text and was wrong both ways.
- **The site reads a repository; the comparison reads the machine.** Publishing needs the skills in a Git repository, because a pipeline sees only what is in Git. Comparing what each tool has installed with the source runs only on the person's machine, like `stackledger discover`.
- **Any person, any Git host, any CI.** A person with no skills repository still gets the map and the checks on localhost. A team gets the same commands in whatever pipeline it already runs; pipelines and hosting are recipes in the documentation, never dependencies.
- **Maps also work without the site.** stackledger writes one Markdown page per skill with a Mermaid diagram into the skills repository, readable offline, in an editor or on the Git host, and visible in pull-request diffs.

## Consequences

- One install, one site and one place to search for a person or a team; the software catalogue and the skills meet on the same pages ("which skills need this app?", "what breaks if we cancel it?").
- The map engine stops being software-only: its title, legend and station symbols become data, so a skill map does not show licence markers.
- The name stays `stackledger`: skills are part of the stack, and a skill adapted from another repository has a licence and an upstream like any software.
- The project's scope grows. The software features are not changed by the skills work, and each skills feature ships as its own OpenSpec change, in the order of the [roadmap](../roadmap.md).
- A person or company that keeps skills only inside each tool can use everything except publishing; the README explains why a skills repository is worth having.
