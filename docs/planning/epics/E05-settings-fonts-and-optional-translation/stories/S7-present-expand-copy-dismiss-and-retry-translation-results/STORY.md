# S7 — Present, expand, copy, dismiss, and retry translation results


**Capability.** Show loading, result, and recoverable error states in an anchored bubble, with a larger centered overlay when space or result length requires it.

**Why here.** This completes the user-visible translation workflow without leaving the reading context.

**Acceptance criteria**

- The anchored surface appears promptly above or below the selection according to available space and shows loading state while the request runs.
- The source selection remains visible/highlighted; clicking elsewhere dismisses the current temporary result.
- A fitting result shows translated plain text and Copy; a constrained/long result shows a compact preview and Expand.
- The expanded centered overlay appears above the reader, preserves the source highlight behind it, and provides Copy and Close.
- Translation is temporary and is not saved to the book, library, history, or diagnostics.
- Missing/unloaded model points to Load or setup; timeout and local-service failures offer Retry when appropriate.
- Retry repeats only the still-valid explicit pending selection intent, and stale session/selection state cannot be resubmitted.

**Constraints/dependencies.** Depends on S6 and I4/I6. React renders escaped text only; all translation UI remains outside the publication frame.

**Epic exit condition.** Global preferences and installed fonts persist; ordinary reading and local translation work offline; manual load/unload, missing service/model, cancellation, retry, long-result, and plain-text checks pass.
