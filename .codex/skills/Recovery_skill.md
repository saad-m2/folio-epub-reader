# Architecture Recovery

## Purpose

Use this skill when evidence shows that the current architecture, technology choice, or major technical approach may no longer be suitable.

The goal is to determine the smallest justified architecture change—not to redesign the system from scratch.

## Agents

* `architect`
* `architecture_reviewer`

## Inputs

Before starting, inspect the relevant repository sources of truth:

* product requirements
* current architecture/proposal
* previous architecture decisions
* the failure, spike, test, review, or implementation evidence that triggered reconsideration

Do not rely on chat history when repository evidence exists.

## Workflow

```text
Failure / new evidence
        ↓
    architect
        ↓
revised architecture proposal
        ↓
architecture_reviewer
        ↓
    architect resolves
        ↓
 ┌──────┼────────────┐
 ↓      ↓            ↓
ready  empirical    owner
       uncertainty  decision
          ↓            ↓
        spike         HUMAN
```

### 1. Diagnose

Use `architect`.

First determine:

* what actually failed,
* whether it is an architecture problem rather than an implementation/test problem,
* which existing decisions are still valid.

Do not change unrelated architecture.

### 2. Propose

If architecture change is justified, the `architect` proposes the smallest viable revision.

The proposal must explain:

* what changes,
* what stays,
* why the change addresses the observed failure,
* important tradeoffs and added complexity,
* assumptions that still lack evidence.

Do not implement production code.

### 3. Review

Use `architecture_reviewer` to independently review the proposal against:

* product requirements,
* observed failure evidence,
* existing constraints.

Focus on:

* whether the proposal actually addresses the failure,
* unsupported assumptions,
* unnecessary complexity,
* regressions or product changes,
* expensive-to-reverse decisions.

### 4. Resolve

Return significant findings to `architect`.

Classify each as:

* `ACCEPT`
* `REJECT`
* `NEEDS TECHNICAL VALIDATION`
* `NEEDS OWNER DECISION`

Revise the proposal for accepted findings.

### 5. Branch

If `NEEDS TECHNICAL VALIDATION`:

→ invoke the `spike-validation` skill.

If `NEEDS OWNER DECISION`:

→ stop and ask the user.

If the architecture changed substantially after review:

→ allow one final `architecture_reviewer` pass.

Maximum architecture review rounds: **2**.

Do not continue agent debate beyond that. Convert empirical disagreements into spikes and judgment/product disagreements into owner decisions.

## Completion

Finish when one of these is true:

* revised architecture is ready for implementation,
* revised architecture requires a technical spike,
* current architecture should be retained,
* proposed replacement is rejected,
* owner decision is required.

## Rules

* Evidence triggers architecture changes; novelty does not.
* A failed technology does not automatically imply a particular replacement.
* Prefer the smallest change that resolves the demonstrated problem.
* Preserve valid existing architecture decisions.
* Do not silently alter product requirements.
* Do not begin production implementation inside this skill.
* Completed stages should not be repeated when resuming from repository state.
