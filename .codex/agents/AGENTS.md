# Agent Instructions

## Working Style

Own the task end-to-end. Understand the relevant existing code and requirements before making substantial changes.

For non-trivial work, briefly determine an implementation approach and identify independent workstreams before editing.

Prefer simple solutions that fit the existing architecture. Do not introduce abstractions, dependencies, or architectural changes unless they are justified by the task.

## Delegation and Subagents

Use subagents when they materially improve the quality or speed of the work.

Decide dynamically which subagents are useful for the current task. Do not assume a fixed set of roles must be used.

Create/delegate roles based on the actual work required, for example investigation, implementation of an isolated component, test analysis, documentation research, or review.

When delegating:

* Give each subagent a narrow and explicit objective.
* Give it the relevant context, constraints, files, and expected output.
* Prefer independent workstreams that can safely run in parallel.
* Avoid having multiple agents modify the same files or tightly coupled code simultaneously.
* Use read-only/investigation subagents freely when useful.
* Do not delegate trivial work merely for the sake of using subagents.

The main agent remains responsible for architectural decisions, interfaces between workstreams, integration, resolving conflicting recommendations, and the final result.

Do not blindly accept subagent output. Review it before integrating it.

## Implementation

Follow existing project conventions and patterns unless there is a concrete reason not to.

Keep changes scoped to the requested task. Avoid unrelated refactors.

Fix root causes rather than adding workarounds where reasonably possible.

Before changing an interface used by multiple parts of the system, inspect its callers and understand the consequences.

## Verification

After implementation, verify the integrated result rather than considering individual subagent tasks sufficient.

Run the relevant tests, type checking, linting, and build commands for the affected area.

Review the final diff for:

* correctness
* regressions
* incomplete integration
* unnecessary complexity
* missing error handling
* violations of project conventions

If verification reveals a problem, fix it before considering the task complete.

## Project Context

Before substantial implementation work, read the relevant project documentation and existing implementation.

Use repository documentation as the source of truth for product requirements, architecture, and implementation decisions where applicable.

## Model and Delegation Policy

Use delegation aggressively when independent work can be performed
in parallel or when focused investigation would reduce the primary
agent's context load.

Prefer the `general` and `explore` subagents for delegated work.
These are the default workers and should handle the large majority
of subagent tasks.

Give these agents task-specific roles dynamically. Do not create a
fixed set of frontend/backend/test/etc. roles merely because they exist.

The `critical` subagent uses scarce high-capability model usage.
Use it only when the delegated task genuinely requires substantially
deeper reasoning, for example:

- difficult architectural decisions with significant downstream impact
- subtle concurrency, correctness, or state-management problems
- difficult debugging where cheaper agents have failed
- reviewing particularly risky or fundamental changes

Do not use `critical` for routine implementation, codebase exploration,
test writing, documentation, straightforward debugging, or ordinary
code review.

The primary agent should perform important reasoning itself before
delegating to `critical`.

Prefer multiple focused free-model investigations over immediately
escalating to `critical`.