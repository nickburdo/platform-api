# Platform API — Development Process Rules

These rules override default behavior for this project. Follow them exactly.

## Planning

- **Maximum decomposition.** Break work into the smallest sensible, concrete steps — in plans, in tasks, in discussion. Avoid vague or bundled items.
- **No implementation without an approved plan.** Every version/feature gets a written plan (see `docs/plans/`) before any code is written. Do not start implementation on an unapproved plan, and do not implement anything the approved plan doesn't cover.
- **Do not deviate from an approved plan during implementation.** If reality forces a deviation, stop and go back to plan revision (see below) instead of silently improvising.
- **Plans can be revised when needed** — but a revision is itself a planning change: propose it, discuss it, get it approved, then continue. Never patch an approved plan silently.

## Discussion

- **Every unclear, undocumented, or debatable point must be discussed and resolved explicitly before proceeding.** Never silently assume, guess, or pick a default on the user's behalf for anything ambiguous or consequential. Surface it and ask.
- Purely mechanical/low-stakes technical details may be proposed with a clear rationale (not silently applied) so the user can object — but genuine product/architecture decisions always require an explicit answer, not just a proposal.

## Source of truth

- `docs/` holds the living project documentation (architecture, models, API contract, decisions, etc.).
- `docs/plans/` holds one implementation plan per version (`v1-plan.md`, `v2-plan.md`, ...), each carrying its own approval status and decision log.
- Documentation is written/updated before implementation, not after (see `docs/decisions.md`, ADR-005).
