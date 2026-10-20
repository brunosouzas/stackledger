# 1. Record architecture decisions

- Status: Accepted
- Date: 2026-10-20

## Context

stackledger is designed and built with spec-driven development: every piece of work is an [OpenSpec](https://github.com/Fission-AI/OpenSpec) change with a proposal, specs with testable scenarios, a `design.md` and tasks. A change's `design.md` explains the choices of that change only. Some decisions shape the whole project and outlive any single change (where the data lives, how people sign in, which language we use). Those need a home that a new reader finds without knowing which change made them.

## Options considered

1. Keep every decision in the `design.md` of the change that made it.
2. Keep project-wide decisions as Architecture Decision Records (ADRs) in `docs/adr/`, and change-level decisions in each change's `design.md`.

## Decision

Option 2. A decision goes into an ADR when it constrains more than one change or would surprise a contributor who only reads the code. Each ADR has Status, Context, Options considered, Decision and Consequences, and is numbered `NNNN-<slug>.md`. A replaced ADR is marked `Superseded by NNNN` and kept. A change's `design.md` links the ADRs it relies on.

## Consequences

- The README explains each decision in one or two sentences and links here; the [ADR index](README.md) lists them all.
- Specs say *what* the tool does, `design.md` says *how* one change does it, and ADRs say *why* the project is shaped this way.
- Changing a recorded decision means writing a new ADR, not editing the old one.
