# I5 — Confirm and open explicit external HTTPS links safely

> Historical record, archived 2026-10-22. Requirements, versions, findings, and workflow restrictions below describe the recorded stage; they are not current task instructions or proof of current failures. Start with the [current documentation map](../../../../../../README.md). Original findings and outcomes are preserved.



**Capability.** Intercept user-activated external book links, show understandable destination information, and open confirmed HTTPS destinations in the system browser.

**Why here.** Link activation is reader input behavior with a distinct security boundary.

**Acceptance criteria**

- EPUB resources cannot silently make remote requests or navigate the reader.
- An explicit HTTPS activation raises a host confirmation showing enough destination information to understand where it goes.
- Confirm opens the destination through the narrow main-process system-browser operation; Cancel makes no external request.
- The reader itself never navigates to the external site.
- HTTP and all other external schemes are rejected by the MVP.
- Sender/session/URL validation prevents publication content from invoking an arbitrary main-process URL opener.

**Constraints/dependencies.** Depends on F2 and R1. Only HTTPS is in product scope.
