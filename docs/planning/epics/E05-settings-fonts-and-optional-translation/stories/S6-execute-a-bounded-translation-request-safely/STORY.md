# S6 — Execute a bounded local translation safely

**Capability.** Translate selected German text through a narrow main-process Ollama adapter using the fixed local model and prompt.

**Acceptance criteria**

- Main sends only explicitly selected bounded plain text and fixed German-to-English instructions to the fixed loopback endpoint and model. Renderer and publication frames cannot send arbitrary URLs, prompts, headers, or model names.
- Main verifies the model is loaded before each request, sends `keep_alive: -1` on translation requests, and uses finite timeout and cancellation; Unload, book close, or stale selection invalidates results.
- Ollama may reload after another client unloads between status check and Generate. Detect unexpected response load time, discard that result, make a bounded unload attempt, and prompt the user to press Load again.
- Source and output never enter durable storage or diagnostics; no cloud service, API key, shell execution, or automatic model download is involved.
- Output is length-bounded and normalized as plain text; HTML, Markdown, links, images, and executable content are never rendered as such.
- Safe results/errors contain no raw local-service exception or book text. Missing service/model, OOM, timeout, interrupted service, and invalid output map to bounded categories.

**Constraints/dependencies.** Depends on S5 and the local translation decision. Test word, sentence, and several-paragraph literary passages; do not use the small smoke test's timing as a release threshold.
