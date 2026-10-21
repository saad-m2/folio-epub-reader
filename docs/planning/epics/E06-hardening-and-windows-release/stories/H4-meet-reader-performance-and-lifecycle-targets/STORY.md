# H4 — Meet reader performance and lifecycle targets


**Capability.** Measure and remediate first-read, navigation, reflow, memory, and repeated lifecycle behavior on documented ordinary and stress fixtures.

**Why here.** The architecture carries provisional quantitative release targets that require packaged runtime evidence.

**Acceptance criteria**

- On the recorded test machine/build/fixtures, first readable content is at most 2 seconds for ordinary and 5 seconds for stress fixtures.
- Page/scroll input response is at most 100 ms.
- Appearance reflow is at most 1 second ordinary and 2 seconds stress.
- Owner revision 2026-10-02 permits reasonable memory above 500 MiB after leak investigation: conservative aggregate working-set guards are 768 MiB ordinary and 1,024 MiB stress on the recorded host. Residual growth remains at most 75 MiB after 20 open/reflow/close cycles, with retained JS heap growth additionally investigated using diagnostic collection; separately measure Ollama's model and GPU memory. Collection is a diagnostic, not a production memory remedy.
- Twenty-cycle testing finds no leaked archive-byte reference, publication session, frame, blob URL, or event handler.
- Record warm translation latency, cold manual Load time, and GPU-memory use/release on the documented test machine. Verify repeated Load/Unload and book switching, plus a bounded best-effort app-exit release attempt.
- If targets prove unsuitable for the agreed MVP hardware baseline, evidence is recorded and returned to the owner rather than silently changing the gate.

**Constraints/dependencies.** Depends on all reader and translation lifecycle work. Targets are provisional architecture gates, not previously validated facts.
