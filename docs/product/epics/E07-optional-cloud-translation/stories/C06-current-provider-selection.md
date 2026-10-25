# C06 — Select and remember the current provider

Status: implemented with automated development coverage; real-account and release qualification remain outstanding (updated 2026-10-25). Parent: [E07](../../E07-optional-cloud-translation.md). Dependencies: C01, C02.

## User story

As a reader, I want to choose which provider I use now and have Leaf remember it, without keeping a separate preferred provider that later takes over.

## Acceptance criteria

- Settings lists the local Ollama option and configured cloud providers, with their readiness/exhaustion state. Unconfigured cloud providers cannot be selected for translation.
- The general **Reader settings / Translation** section offers current-provider selection and status alongside appearance while the book stays open. Local Load/Unload belongs in this panel too; there are no separate top-right translation controls. Preserve the passage, cancel pending work immediately, and clear the old selection/result. Unreadable credentials are shown as unavailable for selection. Native picker keyboard use, including Escape, never leaves the book or turns a page.
- Persist the current provider across restarts. There is no preferred-provider setting, user-managed priority order, or fallback opt-in.
- Manual switching invalidates in-progress translation/fallback before the new selection takes effect. It never submits the current selection or automatically retries an old request.
- The next explicit Translate uses the current provider, subject to known exhaustion handling in C07. Connecting an account does not change the current provider.
- Selecting Ollama never loads it. Retain explicit Load/Unload and actual model status; never select Ollama automatically because cloud allowances are exhausted.
- Existing installations without a provider setting retain local behavior. Migration on the first translation-provider state read removes AWS credentials/allowance state; an AWS current-provider value becomes a choose-provider state without automatic Ollama selection/loading. Removing the current cloud account leaves a clear choose-provider state until the user explicitly selects another option.
- Recovery of another provider's allowance does not change the saved current provider, including after restart.

## Verification

Test migration/defaults, manual switching, restart, credential removal, missing providers, selecting unloaded Ollama, and recovered-provider state. Race manual switching against a delayed translation/fallback; confirm the manual selection wins and no old text is resubmitted. Inspect main Settings and general Reader settings controls and focus behavior, including Escape closing the panel while retaining the book and restoring its trigger focus. Verify the retired-provider migration and that appearance controls remain available in the shared panel.
