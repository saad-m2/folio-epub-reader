# Historical documentation

The app was renamed from Folio to **Leaf** on 2026-10-22. Original product names in these records are preserved as history; use Leaf in current guides and new work.

Archived on 2026-10-22 after reviewing project documentation and comparing current behavior with source. These files retain original dates, proposals, review findings, decisions, acceptance criteria, and recorded verification. Their historical banners and repaired paths do not change the original conclusions.

Start new work with the [current documentation map](../README.md). This archive is for targeted background research. Statements such as "no renderer selected," "implementation has not started," old dependency pins, or spike stop rules describe the stage at which they were written.

## What was archived and why

| Group | Contents | Why historical / current replacement |
| --- | --- | --- |
| [Initial architecture proposal](planning/TECHNICAL-PROPOSAL.md), [review](planning/ARCHITECTURE-REVIEW-01.md), [resolution](planning/ARCHITECTURE-REVIEW-01-RESOLUTION.md), [recovery](planning/ARCHITECTURE-RECOVERY-01.md) | Framework comparisons, helper/protocol designs, renderer selection and cloud-translation proposals | Superseded by trusted-local EPUBs, local Ollama translation, implemented source, and the [current overview](../architecture/OVERVIEW.md) |
| [Trusted-local implementation plan](planning/ARCHITECTURE-IMPLEMENTATION-PLAN-01.md) | Accepted architecture and original delivery phases | Still useful rationale; contains older pins, phase plans, and network assumptions predating updates. Use the current overview and retained [decision records](../architecture/decisions/) |
| [Initial implementation breakdown](planning/IMPLEMENTATION-BREAKDOWN-01.md) and [epics/stories](planning/epics/README.md) | Six original epics and all 38 story specifications | Initial delivery history, with mixed later amendments and stale exclusions/pins; not the active feature backlog. Use [product](../product/PRODUCT.md), [roadmap](../product/ROADMAP.md), and [qualification](../release/QUALIFICATION.md) |
| [Early gaps/remediation](planning/CONFIRMED-EPIC-1-2-GAPS-AND-REMEDIATION.md), [E01–03 review](reviews/EPICS-01-03-IMPLEMENTATION-REVIEW.md), [E04 review](reviews/EPIC-04-IMPLEMENTATION-REVIEW.md), [E05 review](reviews/EPIC-05-IMPLEMENTATION-REVIEW.md), [E06 review](reviews/EPIC-06-IMPLEMENTATION-REVIEW.md) | Snapshot findings, fixes, old test counts and then-open gates | Findings and qualification evolved afterward. Preserve evidence; verify current source and use the qualification guide rather than treating all findings as open |
| [Original improvements request](planning/READER-IMPROVEMENTS-01.md), [design worktrees](planning/FRONTEND-DESIGN-WORKTREES.md), [frontend integration](reviews/FRONTEND-IMPLEMENTATION.md) | Mixed-status requests, competing-design setup, integration verification | Design A is implemented; unfinished formats and single-page requests are carried into the roadmap. Use the [design guide](../design/README.md) |
| [Repository privacy review](reviews/REPOSITORY-PRIVACY-REVIEW.md) | 2026-10-21 scope-limited scan and ignore changes | A point-in-time audit, including then-uncommitted-baseline language; ongoing practical guidance is in [agent guidelines](../workflow/AGENT-GUIDELINES.md#profiles-evidence-and-privacy) and `.gitignore` |
| Renderer experiments below | SPIKE-001, 001B, 002, and 003 definitions/reports/reviews/escalations | Pre-production engine/helper experiments. They are not current engine selection or production gates; use the trusted-local decision and current runtime suites |

## Renderer experiment records

- [SPIKE-001 renderer report](spikes/SPIKE-001-RENDERER.md), [independent review](spikes/SPIKE-001-REVIEW.md), [Foliate escalation](spikes/SPIKE-001-FOLIATE-ESCALATION.md).
- [SPIKE-001B Foliate validation](spikes/SPIKE-001B-FOLIATE-VALIDATION.md), [review](spikes/SPIKE-001B-REVIEW.md).
- [SPIKE-002 helper and book protocol decision](spikes/SPIKE-002-DECISION.md).
- [SPIKE-003 validation](spikes/SPIKE-003-EPUBJS-ADOPTION-VALIDATION.md), [builder report](spikes/SPIKE-003-BUILDER-REPORT.md), [escalation](spikes/SPIKE-003-ESCALATION.md).

The harness code stays under root `spikes/`. Generated evidence stays ignored in its original directories and was not promoted to current documentation. Missing local artifacts do not establish a pass or failure. The accepted trusted-local decision and local-translation decision were retained outside this archive because they still describe current architectural choices; their status notes point to later verification records.

## Relocation reference

`docs/planning/` moved here as `planning/`, except local translation moved to `../architecture/decisions/LOCAL-TRANSLATION.md` and manual qualification to `../release/QUALIFICATION.md`. `docs/spikes/` moved here as `spikes/`, except the trusted-local decision moved to `../architecture/decisions/TRUSTED-LOCAL-EPUB.md`. Root `docs/` reviews moved to `reviews/`; product and updates moved to `../product/PRODUCT.md` and `../release/UPDATES.md`. The design prototype moved from root `design/frontend-a/` to `../design/frontend-a/`, with its integration report archived in `reviews/`. The release evidence template moved from `scripts/` to `../release/templates/RELEASE-EVIDENCE.md`.
