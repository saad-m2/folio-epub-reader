# Spike Validation Workflow

## Purpose
Validate a risky technical assumption using a disposable spike and independent evidence review.

## Inputs
- spike question
- relevant product/architecture docs
- existing spike artifacts, if resuming

## Workflow

1. Determine current workflow state.
2. If no spike exists:
   - run `spike_builder`
3. If spike exists but no review exists:
   - run `evidence_reviewer`
4. If review says targeted rerun:
   - run `spike_builder`
   - then run `evidence_reviewer` again
5. If accepted:
   - mark complete
6. If still unresolved after one rerun:
   - escalate to human/architect

## Exit Conditions
- accepted by evidence reviewer, or
- escalated after maximum rerun count

## Rules
- maximum one targeted rerun
- do not switch technologies automatically
- do not start production implementation