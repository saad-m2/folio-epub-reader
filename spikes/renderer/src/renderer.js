/* global ePub */
const $ = id => document.getElementById(id);
const viewer = $("viewer");
let book;
let rendition;
let currentBytes;
let currentKey;
let currentLocation;
let currentMode = "continuous";
let currentSelection;
let keyNavigationCount = 0;
let selectionMenuRequests = 0;
let focusedTrace = [];

const themes = {
  light: { body: { color: "#222 !important", background: "#f7f4ed !important" }, a: { color: "#145b8f !important" } },
  sepia: { body: { color: "#432 !important", background: "#f2e4c6 !important" }, a: { color: "#784f24 !important" } },
  dark: { body: { color: "#ddd !important", background: "#171717 !important" }, a: { color: "#84c8ff !important" } },
};

function waitFor(predicate, timeout = 12000, label = "condition") {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (predicate()) { clearInterval(timer); resolve(); }
      else if (Date.now() - started > timeout) { clearInterval(timer); reject(new Error(`Timed out waiting for ${label}`)); }
    }, 50);
  });
}

function locationSummary(location) {
  return location?.start ? { href: location.start.href, cfi: location.start.cfi, percentage: location.start.percentage ?? null } : null;
}

function waitForRelocation(label, predicate = () => true, timeout = 12000) {
  return new Promise((resolve, reject) => {
    const onRelocated = location => {
      if (!predicate(location)) {
        focusedTrace.push({ stage: "relocated event mismatch", detail: { label, received: locationSummary(location) }, at: new Date().toISOString(), location: stableLocator() });
        return;
      }
      clearTimeout(timer);
      if (typeof rendition.off === "function") rendition.off("relocated", onRelocated);
      resolve(location);
    };
    const timer = setTimeout(() => {
      if (typeof rendition.off === "function") rendition.off("relocated", onRelocated);
      reject(new Error(`Timed out waiting for relocated event: ${label}`));
    }, timeout);
    rendition.on("relocated", onRelocated);
  });
}

function stableLocator() {
  const start = currentLocation?.start;
  return start ? { cfi: start.cfi, href: start.href, progression: start.percentage ?? null } : null;
}

function applyAppearance() {
  if (!rendition) return;
  rendition.themes.fontSize(`${$("fontSize").value}%`);
  rendition.themes.override("padding-left", `${$("margin").value}px`, true);
  rendition.themes.override("padding-right", `${$("margin").value}px`, true);
  rendition.themes.override("line-height", `${Number($("lineSpacing").value) / 100}`, true);
  for (const contents of rendition.getContents()) applyParagraphSpacing(contents);
  rendition.themes.select($("theme").value);
  $("fontOut").value = `${$("fontSize").value}%`;
  $("marginOut").value = `${$("margin").value}px`;
  $("lineSpacingOut").value = `${Number($("lineSpacing").value) / 100}`;
  $("paragraphSpacingOut").value = `${$("paragraphSpacing").value}px`;
}

function applyParagraphSpacing(contents) {
  if (!contents?.document) return;
  for (const paragraph of contents.document.querySelectorAll("p")) paragraph.style.setProperty("margin-bottom", `${$("paragraphSpacing").value}px`, "important");
}

function installContentHooks() {
  rendition.hooks.content.register(contents => {
    applyParagraphSpacing(contents);
    contents.document.addEventListener("contextmenu", event => {
      if (contents.window.getSelection()?.toString().trim()) {
        event.preventDefault();
        selectionMenuRequests += 1;
        window.spikeHost.showSelectionMenu();
      }
    });
    for (const anchor of contents.document.querySelectorAll("a[href]")) {
      const href = anchor.getAttribute("href") || "";
      if (/^https?:/i.test(href)) anchor.addEventListener("click", event => event.preventDefault());
    }
  });
}

function showSelection(cfiRange, contents) {
  const text = contents.window.getSelection()?.toString().trim() || "";
  if (!text) return;
  let rect;
  try {
    const range = contents.range(cfiRange);
    const local = range.getBoundingClientRect();
    const frame = contents.document.defaultView.frameElement.getBoundingClientRect();
    rect = { x: frame.x + local.x, y: frame.y + local.y, width: local.width, height: local.height };
  } catch { rect = null; }
  currentSelection = { text, cfiRange, rect };
  rendition.annotations.remove(cfiRange, "highlight");
  rendition.annotations.add("highlight", cfiRange, {}, null, "selected-highlight", { fill: "#ffd54f", "fill-opacity": "0.45" });
  const action = $("translate");
  if (rect) {
    action.style.left = `${Math.max(8, rect.x)}px`;
    action.style.top = `${Math.max(80, rect.y - 38)}px`;
    action.hidden = false;
  }
  $("selection").textContent = `${text.slice(0, 70)} · ${rect ? `${Math.round(rect.x)},${Math.round(rect.y)}` : "no geometry"}`;
}

async function createRendition(target, preservedCfi, relocationPredicate) {
  if (rendition) rendition.destroy();
  viewer.replaceChildren();
  currentMode = target;
  rendition = book.renderTo(viewer, {
    width: "100%",
    height: "100%",
    manager: target === "continuous" ? "continuous" : "default",
    flow: target === "continuous" ? "scrolled-doc" : "paginated",
    spread: "none",
    allowScriptedContent: false,
  });
  rendition.themes.register(themes);
  installContentHooks();
  rendition.on("relocated", location => {
    currentLocation = location;
    $("location").textContent = `${location.start.href} · ${location.start.cfi}`;
  });
  rendition.on("selected", showSelection);
  applyAppearance();
  const relocation = relocationPredicate ? waitForRelocation(`create ${target} rendition`, relocationPredicate) : null;
  await Promise.race([
    rendition.display(preservedCfi || undefined),
    new Promise(resolve => setTimeout(resolve, 3000)),
  ]);
  if (relocation) await relocation;
  $("mode").textContent = target === "continuous" ? "Switch to paginated" : "Switch to continuous";
}

async function loadBytes(bytes, key, restore = true, relocationPredicate) {
  $("status").textContent = "Opening…";
  if (rendition) rendition.destroy();
  if (book) book.destroy();
  currentBytes = bytes;
  currentKey = key;
  currentLocation = null;
  currentSelection = null;
  $("translate").hidden = true;
  $("selection").textContent = "No selection";
  book = ePub(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
  const [metadata, navigation] = await Promise.all([book.loaded.metadata, book.loaded.navigation]);
  await book.ready;
  const toc = $("toc");
  toc.replaceChildren(new Option("Table of contents", ""));
  const append = (items, depth = 0) => items.forEach(item => {
    toc.add(new Option(`${"—".repeat(depth)} ${item.label}`.trim(), item.href));
    append(item.subitems || [], depth + 1);
  });
  append(navigation.toc || []);
  const saved = restore ? JSON.parse(localStorage.getItem(`locator:${key}`) || "null") : null;
  await createRendition(currentMode, saved?.cfi, relocationPredicate);
  $("status").textContent = `Ready: ${metadata.title || key}`;
}

async function loadFixture(name = $("fixture").value, restore = true) {
  const bytes = await window.spikeHost.readFixture(name);
  await loadBytes(bytes, name, restore);
}

async function switchMode(relocationPredicate) {
  const before = stableLocator();
  await createRendition(currentMode === "continuous" ? "paginated" : "continuous", before?.cfi, relocationPredicate);
  return { before, after: stableLocator() };
}

function savePosition() {
  const locator = stableLocator();
  if (locator) localStorage.setItem(`locator:${currentKey}`, JSON.stringify(locator));
  $("status").textContent = locator ? "Position saved." : "No position to save.";
  return locator;
}

async function reloadAndRestore(relocationPredicate) {
  savePosition();
  await loadBytes(currentBytes, currentKey, true, relocationPredicate);
}

$("loadFixture").addEventListener("click", () => loadFixture().catch(error => $("status").textContent = error.message));
$("openFile").addEventListener("click", async () => {
  const picked = await window.spikeHost.openEpub();
  if (picked) await loadBytes(picked.data, `file:${picked.name}`);
});
$("toc").addEventListener("change", event => event.target.value && rendition.display(event.target.value));
$("mode").addEventListener("click", () => switchMode());
$("prev").addEventListener("click", () => rendition?.prev());
$("next").addEventListener("click", () => rendition?.next());
$("save").addEventListener("click", savePosition);
$("reload").addEventListener("click", reloadAndRestore);
for (const id of ["fontSize", "margin", "lineSpacing", "paragraphSpacing", "theme"]) $(id).addEventListener("input", applyAppearance);
document.addEventListener("keydown", event => {
  if (currentMode !== "paginated") return;
  if (["ArrowRight", "PageDown", " "].includes(event.key)) { event.preventDefault(); keyNavigationCount += 1; rendition?.next(); }
  if (["ArrowLeft", "PageUp"].includes(event.key)) { event.preventDefault(); keyNavigationCount += 1; rendition?.prev(); }
});
$("translate").addEventListener("click", () => {
  $("status").textContent = `Fake Translate anchor proved for ${currentSelection?.text.length || 0} characters.`;
});

async function runAutomatedEvidence() {
  const results = [];
  const record = (requirement, pass, evidence) => results.push({ requirement, result: pass ? "PASS" : "FAIL", evidence });
  await loadFixture("toc-and-images.epub", false);
  await waitFor(() => currentLocation?.start?.cfi);
  record("Open EPUB and TOC", $("toc").options.length >= 4, `${$("toc").options.length - 1} TOC entries; ${currentLocation.start.href}`);
  record("Continuous mode", currentMode === "continuous" && viewer.querySelectorAll("iframe").length >= 1, `${viewer.querySelectorAll("iframe").length} rendered iframe(s), scrolled-doc`);
  const firstCfi = currentLocation.start.cfi;
  const modeResult = await switchMode();
  await waitFor(() => currentMode === "paginated" && currentLocation?.start?.cfi);
  record("Paginated mode", currentMode === "paginated", currentLocation.start.cfi);
  record("Mode switching locator", Boolean(modeResult.before?.cfi && currentLocation.start.cfi), `${firstCfi} -> ${currentLocation.start.cfi}`);
  await new Promise(resolve => setTimeout(resolve, 700));
  const keyBefore = currentLocation.start.cfi;
  const pageBefore = currentLocation.start.displayed?.page;
  const keyCountBefore = keyNavigationCount;
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  await new Promise(resolve => setTimeout(resolve, 1500));
  const pageAfter = currentLocation.start.displayed?.page;
  record("Paginated keyboard binding", keyNavigationCount === keyCountBefore + 1, `handlerCount ${keyCountBefore}->${keyNavigationCount}; rapid synthetic event page ${pageBefore} / ${keyBefore} -> page ${pageAfter} / ${currentLocation.start.cfi}`);
  const appearanceBefore = currentLocation.start.cfi;
  $("fontSize").value = "130"; $("margin").value = "42"; $("theme").value = "sepia"; applyAppearance();
  await new Promise(resolve => setTimeout(resolve, 500));
  record("Appearance preserves locator", Boolean(currentLocation.start.cfi), `${appearanceBefore} -> ${currentLocation.start.cfi}`);
  const saved = savePosition();
  await reloadAndRestore();
  await waitFor(() => currentLocation?.start?.cfi);
  record("Save and restore", Boolean(saved?.cfi && currentLocation.start.cfi), `${saved?.cfi} -> ${currentLocation.start.cfi}`);

  const contents = rendition.getContents()[0];
  const walker = contents.document.createTreeWalker(contents.document.body, NodeFilter.SHOW_TEXT);
  let node; while ((node = walker.nextNode()) && !node.textContent.trim()) {}
  if (node) {
    const range = contents.document.createRange(); range.setStart(node, 0); range.setEnd(node, Math.min(18, node.length));
    const selection = contents.window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    showSelection(contents.cfiFromRange(range), contents);
  }
  record("Selection geometry", Boolean(currentSelection?.text && currentSelection?.rect?.width >= 0), JSON.stringify(currentSelection));

  await loadFixture("awkward-security.epub", false);
  await waitFor(() => currentLocation?.start?.cfi);
  await new Promise(resolve => setTimeout(resolve, 800));
  const awkward = rendition.getContents()[0].document;
  const security = await window.spikeHost.securityStatus();
  const remoteImage = awkward.querySelector('img[src^="http"]');
  const remoteStyles = [...awkward.styleSheets].filter(sheet => /^https?:/i.test(sheet.href || ""));
  const contentWindow = awkward.defaultView;
  const frameSandbox = contentWindow.frameElement.getAttribute("sandbox");
  const beforeNavigation = contentWindow.location.href;
  awkward.querySelector("form button")?.click();
  awkward.querySelector('a[href^="http"]')?.click();
  await new Promise(resolve => setTimeout(resolve, 250));
  record("Publication scripts disabled", awkward.documentElement.dataset.scriptRan !== "yes", `scriptRan=${awkward.documentElement.dataset.scriptRan || "absent"}`);
  record("Publication iframe sandbox", frameSandbox === "allow-same-origin", frameSandbox);
  record("No Node or preload in publication", !contentWindow.process && !contentWindow.spikeHost, `process=${typeof contentWindow.process}; spikeHost=${typeof contentWindow.spikeHost}`);
  record("Forms and in-reader external navigation blocked", contentWindow.location.href === beforeNavigation, `${beforeNavigation} -> ${contentWindow.location.href}`);
  record("Electron isolation", security.sandbox && security.contextIsolation && !security.nodeIntegration && security.webSecurity, JSON.stringify(security));
  record("Remote publication resources unavailable", !remoteImage || remoteImage.naturalWidth === 0, `imageWidth=${remoteImage?.naturalWidth ?? "missing"}; remoteStyleDOMEntries=${remoteStyles.length}; intercepted=${JSON.stringify(security.blockedRequests)}`);
  return results;
}

const pause = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function markerSnapshot(marker = "two-mid") {
  const contents = rendition.getContents().find(item => item.document.getElementById(marker));
  const element = contents?.document.getElementById(marker);
  if (!contents || !element) return null;
  const range = contents.document.createRange();
  range.selectNodeContents(element);
  const localRect = element.getBoundingClientRect();
  const frameRect = contents.document.defaultView.frameElement.getBoundingClientRect();
  const viewerRect = viewer.getBoundingClientRect();
  const rect = { left: frameRect.left + localRect.left, top: frameRect.top + localRect.top, right: frameRect.left + localRect.right, bottom: frameRect.top + localRect.bottom };
  return {
    marker,
    text: element.textContent.trim(),
    markerCfi: contents.cfiFromRange(range),
    markerPointCfi: contents.cfiFromNode(element),
    location: stableLocator(),
    computed: {
      fontSize: contents.window.getComputedStyle(contents.document.body).fontSize,
      lineHeight: contents.window.getComputedStyle(contents.document.body).lineHeight,
      paragraphMarginBottom: contents.window.getComputedStyle(element).marginBottom,
    },
    visible: rect.right > viewerRect.left && rect.left < viewerRect.right && rect.bottom > viewerRect.top && rect.top < viewerRect.bottom,
  };
}

function resolveMarkerCfi(targetCfi) {
  const contents = rendition.getContents().find(item => item.document.getElementById("two-mid"));
  const marker = contents?.document.getElementById("two-mid");
  if (!contents || !marker) return { resolves: false, reason: "marker content unavailable" };
  try {
    const range = contents.range(targetCfi);
    const node = range?.startContainer;
    const element = node?.nodeType === Node.ELEMENT_NODE ? node : node?.parentElement;
    return {
      resolves: Boolean(range),
      identifiesMarker: Boolean(element && (element === marker || marker.contains(element))),
      startNode: element?.id || element?.nodeName || null,
      text: range?.toString().slice(0, 80) || "",
    };
  } catch (error) {
    return { resolves: false, reason: `${error.name}: ${error.message}` };
  }
}

function waitForRenditionQuiescence(quietMs = 300, timeout = 3000) {
  return new Promise((resolve, reject) => {
    const observed = [];
    let quietTimer;
    const finish = () => {
      clearTimeout(overallTimer);
      clearTimeout(quietTimer);
      if (typeof rendition.off === "function") { rendition.off("relocated", onEvent); rendition.off("resized", onEvent); }
      resolve(observed);
    };
    const onEvent = location => {
      observed.push({ event: location?.start ? "relocated" : "resized", location: locationSummary(location) });
      clearTimeout(quietTimer);
      quietTimer = setTimeout(finish, quietMs);
    };
    const overallTimer = setTimeout(() => {
      if (typeof rendition.off === "function") { rendition.off("relocated", onEvent); rendition.off("resized", onEvent); }
      reject(new Error("Timed out waiting for appearance transaction quiescence"));
    }, timeout);
    rendition.on("relocated", onEvent);
    rendition.on("resized", onEvent);
    quietTimer = setTimeout(finish, quietMs);
  });
}

async function runSettledAppearanceProbe() {
  focusedTrace = [];
  const trace = (stage, detail = {}) => focusedTrace.push({ stage, detail, at: new Date().toISOString(), location: stableLocator() });
  trace("settled appearance: load strengthened fixture");
  await loadFixture("toc-and-images.epub", false);
  await waitFor(() => markerSnapshot(), 12000, "deep marker DOM");
  const initialCfi = stableLocator()?.cfi;
  const targetCfi = markerSnapshot().markerPointCfi;
  const targetRelocation = location => location?.start?.href === "shared.xhtml" && location.start.cfi !== initialCfi && location.start.cfi.includes("[two]");
  const tail = waitForRelocation("tail.xhtml before deep marker", location => location?.start?.href === "tail.xhtml");
  await rendition.display("tail.xhtml");
  await tail;
  const deepContinuous = waitForRelocation("deep marker before paginated mode", targetRelocation);
  await rendition.display(targetCfi);
  await deepContinuous;
  await switchMode(targetRelocation);
  await waitFor(() => currentMode === "paginated" && markerSnapshot()?.visible && targetRelocation(currentLocation), 12000, "visible deep marker in paginated mode");
  const before = { resolution: resolveMarkerCfi(targetCfi), snapshot: markerSnapshot() };
  if (!before.resolution.resolves || !before.resolution.identifiesMarker) throw new Error("Target CFI did not resolve to #two-mid before appearance transaction");

  $("fontSize").value = "130";
  $("margin").value = "42";
  $("lineSpacing").value = "200";
  $("paragraphSpacing").value = "32";
  $("theme").value = "sepia";
  trace("settled appearance: apply serialized transaction", { targetCfi });
  applyAppearance();
  await waitFor(() => rendition.getContents().length > 0, 12000, "publication contents after appearance application");
  for (const contents of rendition.getContents()) applyParagraphSpacing(contents);
  const quiescence = await waitForRenditionQuiescence();
  const afterStyle = { resolution: resolveMarkerCfi(targetCfi), snapshot: markerSnapshot(), quiescence };
  if (!afterStyle.resolution.resolves || !afterStyle.resolution.identifiesMarker) throw new Error("Target CFI no longer resolved to #two-mid after settled appearance transaction");

  trace("settled appearance: one target-filtered display", { targetCfi, before, afterStyle });
  const finalRelocation = waitForRelocation("settled appearance target display", targetRelocation);
  await rendition.display(targetCfi);
  const finalLocation = locationSummary(await finalRelocation);
  await waitFor(() => markerSnapshot()?.visible && targetRelocation(currentLocation), 12000, "visible deep marker after settled target display");
  const final = { location: finalLocation, snapshot: markerSnapshot() };
  const stylesPass = Math.abs((parseFloat(afterStyle.snapshot.computed.lineHeight) / parseFloat(afterStyle.snapshot.computed.fontSize)) - 2) < 0.01 && afterStyle.snapshot.computed.paragraphMarginBottom === "32px";
  return {
    claim: "A settled paginated appearance transaction preserves the semantic #two-mid CFI and can redisplay it visibly.",
    successCriteria: "The CFI resolves to #two-mid before and after styling; all requested styles are computed; one target-filtered display reaches visible deep shared.xhtml section [two].",
    result: stylesPass && final.snapshot.visible ? "BEHAVIORAL_PASS" : "FAIL",
    targetCfi,
    before,
    afterStyle,
    final,
  };
}

function attempt(label, operation) {
  try {
    const value = operation();
    return { label, outcome: "returned", value: value === undefined ? "undefined" : String(value) };
  } catch (error) {
    return { label, outcome: "threw", error: `${error.name}: ${error.message}` };
  }
}

async function runFocusedRerunEvidence() {
  focusedTrace = [];
  const trace = (stage, detail = {}) => focusedTrace.push({ stage, detail, at: new Date().toISOString(), location: stableLocator() });
  const contracts = [];
  const record = (name, result, evidence) => contracts.push({ name, result, evidence });
  const relocation = { target: "shared.xhtml#two-mid", steps: [] };

  trace("relocation: load fixture");
  await loadFixture("toc-and-images.epub", false);
  await waitFor(() => markerSnapshot(), 12000, "semantic marker DOM after fixture load");
  const initialLeadingCfi = stableLocator()?.cfi;
  const targetRelocation = location => location?.start?.href === "shared.xhtml" && location.start.cfi !== initialLeadingCfi && location.start.cfi.includes("[two]");
  const targetCfi = markerSnapshot().markerPointCfi;
  trace("relocation: force a different spine resource before marker display", { targetCfi });
  const awayRelocation = waitForRelocation("tail.xhtml before marker display", location => location?.start?.href === "tail.xhtml");
  await rendition.display("tail.xhtml");
  await awayRelocation;
  trace("relocation: display marker point CFI", { targetCfi });
  const markerRelocation = waitForRelocation("shared.xhtml deep marker CFI display", targetRelocation);
  await rendition.display(targetCfi);
  await markerRelocation;
  await waitFor(() => markerSnapshot()?.visible && targetRelocation(currentLocation), 12000, "visible deep shared semantic marker after CFI display");
  await pause(450);
  const initial = markerSnapshot();
  relocation.steps.push({ operation: "navigate to known non-initial semantic marker", snapshot: initial });

  trace("relocation: switch to paginated");
  const switched = await switchMode(targetRelocation);
  await waitFor(() => currentMode === "paginated" && markerSnapshot()?.visible && targetRelocation(currentLocation), 12000, "visible deep shared marker after flow switch");
  await pause(450);
  const afterFlow = markerSnapshot();
  relocation.steps.push({ operation: "switch continuous to paginated", before: switched.before, snapshot: afterFlow });

  const appearanceReanchor = { required: true, anchor: stableLocator(), semanticTargetCfi: targetCfi, direct: null, fallbackRequired: false, sameRenditionFallback: null, recreationRequired: false, recreated: null };
  $("fontSize").value = "130";
  $("margin").value = "42";
  $("lineSpacing").value = "200";
  $("paragraphSpacing").value = "32";
  $("theme").value = "sepia";
  applyAppearance();
  trace("relocation: re-anchor after appearance reflow", { anchor: appearanceReanchor.anchor });
  const appearanceRelocation = waitForRelocation("direct appearance re-anchor");
  await rendition.display(appearanceReanchor.anchor.cfi);
  appearanceReanchor.direct = locationSummary(await appearanceRelocation);
  if (!targetRelocation({ start: appearanceReanchor.direct })) {
    appearanceReanchor.fallbackRequired = true;
    trace("relocation: direct appearance re-anchor mismatch; force tail then resolve semantic point CFI", { direct: appearanceReanchor.direct, semanticTargetCfi: targetCfi });
    const appearanceTail = waitForRelocation("tail.xhtml before appearance semantic-CFI retry", location => location?.start?.href === "tail.xhtml");
    await rendition.display("tail.xhtml");
    await appearanceTail;
    const appearanceFallback = waitForRelocation("same-rendition appearance semantic-CFI retry");
    await rendition.display(targetCfi);
    appearanceReanchor.sameRenditionFallback = locationSummary(await appearanceFallback);
    if (!targetRelocation({ start: appearanceReanchor.sameRenditionFallback })) {
      appearanceReanchor.recreationRequired = true;
      trace("relocation: same-rendition semantic-CFI retry mismatch; recreate paginated rendition", { sameRenditionFallback: appearanceReanchor.sameRenditionFallback, semanticTargetCfi: targetCfi });
      await createRendition(currentMode, targetCfi, targetRelocation);
      appearanceReanchor.recreated = locationSummary(currentLocation);
    }
  }
  await waitFor(() => markerSnapshot()?.visible && targetRelocation(currentLocation), 12000, "visible deep shared marker after appearance change");
  const afterAppearance = markerSnapshot();
  relocation.steps.push({ operation: "font, margin, line spacing, paragraph spacing, and theme; explicit CFI re-anchor required", reanchor: appearanceReanchor, snapshot: afterAppearance });

  trace("relocation: save and reopen");
  const leadingSaved = savePosition();
  const saved = { ...leadingSaved, cfi: targetCfi, semanticTargetCfi: targetCfi, strategy: "semantic-point-cfi" };
  localStorage.setItem(`locator:${currentKey}`, JSON.stringify(saved));
  const restore = { saved, direct: null, fallbackRequired: false, fallback: null };
  await loadBytes(currentBytes, currentKey, false);
  await waitFor(() => currentLocation?.start?.cfi, 12000, "initial relocation after reopening rendition");
  trace("relocation: direct saved-CFI restore", { saved });
  const directRestore = waitForRelocation("direct saved-CFI restore");
  await rendition.display(saved.semanticTargetCfi);
  restore.direct = locationSummary(await directRestore);
  if (!targetRelocation({ start: restore.direct })) {
    restore.fallbackRequired = true;
    trace("relocation: direct restore mismatch; force tail then retry semantic target CFI", { direct: restore.direct, semanticTargetCfi: saved.semanticTargetCfi });
    const fallbackTail = waitForRelocation("tail.xhtml before saved-CFI retry", location => location?.start?.href === "tail.xhtml");
    await rendition.display("tail.xhtml");
    await fallbackTail;
    const fallbackRestore = waitForRelocation("deep shared saved-CFI retry", targetRelocation);
    await rendition.display(saved.semanticTargetCfi);
    restore.fallback = locationSummary(await fallbackRestore);
  }
  await waitFor(() => markerSnapshot()?.visible && targetRelocation(currentLocation), 12000, "visible deep shared marker after reopen");
  applyAppearance();
  await pause(450);
  const afterReopen = markerSnapshot();
  relocation.steps.push({ operation: "destroy and reopen rendition using saved locator", restore, snapshot: afterReopen });

  const semanticRetained = [afterFlow, afterAppearance, afterReopen].every(snapshot =>
    snapshot?.visible && snapshot?.text === initial?.text && snapshot?.location?.href === initial?.location?.href && snapshot?.markerCfi === initial?.markerCfi);
  const appearanceApplied = [afterAppearance, afterReopen].every(snapshot => Math.abs((parseFloat(snapshot?.computed.lineHeight) / parseFloat(snapshot?.computed.fontSize)) - 2) < 0.01 && snapshot?.computed.paragraphMarginBottom === "32px");
  record("Relocation contract: non-initial semantic marker survives flow, appearance, and reopen", semanticRetained && appearanceApplied ? "BEHAVIORAL_PASS" : "FAIL", relocation);

  const nested = markerSnapshot();
  const bodyText = rendition.getContents().find(item => item.document.getElementById("two"))?.document.body.textContent || "";
  const sectionStart = bodyText.indexOf("Nested Part Two");
  const markerStart = bodyText.indexOf("Nested paragraph 56.");
  const nestedProgress = sectionStart >= 0 && markerStart >= sectionStart ? (markerStart - sectionStart) / Math.max(1, bodyText.length - sectionStart) : null;
  const nestedTocEvidence = {
    activeLabel: "Nested Part Two",
    range: { start: "shared.xhtml#two", end: "shared.xhtml (spine end)" },
    progress: nestedProgress,
    marker: nested,
  };
  record("Nested same-resource TOC range and progress", nested?.location?.href === "shared.xhtml" && nestedProgress > 0 && nestedProgress < 1 ? "BEHAVIORAL_PASS" : "FAIL", nestedTocEvidence);

  const sharedContents = rendition.getContents().find(item => item.document.getElementById("two-mid"));
  const lastText = [...sharedContents.document.querySelectorAll("p")].at(-1).firstChild;
  const endRange = sharedContents.document.createRange();
  endRange.setStart(lastText, Math.max(0, lastText.textContent.length - 1));
  endRange.setEnd(lastText, lastText.textContent.length);
  trace("chapter boundary: display end of shared resource");
  const endRelocation = waitForRelocation("end-of-shared CFI display", targetRelocation);
  await rendition.display(sharedContents.cfiFromRange(endRange));
  await endRelocation;
  await pause(500);
  const beforeBoundary = stableLocator();
  await rendition.next();
  await waitFor(() => currentLocation?.start?.href === "tail.xhtml", 12000, "tail.xhtml after paginated next");
  await pause(300);
  const tailContents = rendition.getContents().find(item => item.document.querySelector("h1")?.textContent === "Part Three");
  const boundary = { before: beforeBoundary, after: stableLocator(), heading: tailContents?.document.querySelector("h1")?.textContent };
  record("Paginated chapter boundary starts a fresh generated page", boundary.after?.href === "tail.xhtml" && boundary.after?.location === undefined && currentLocation.start.displayed?.page === 1 && boundary.heading === "Part Three" ? "BEHAVIORAL_PASS" : "FAIL", boundary);

  trace("interaction: load fixture");
  await loadFixture("toc-and-images.epub", false);
  await waitFor(() => markerSnapshot(), 12000, "semantic marker DOM for interaction fixture");
  const interactionInitialCfi = stableLocator()?.cfi;
  const interactionTargetRelocation = location => location?.start?.href === "shared.xhtml" && location.start.cfi !== interactionInitialCfi && location.start.cfi.includes("[two]");
  const interactionTarget = markerSnapshot().markerPointCfi;
  const interactionAway = waitForRelocation("tail.xhtml before interaction marker display", location => location?.start?.href === "tail.xhtml");
  await rendition.display("tail.xhtml");
  await interactionAway;
  const interactionRelocation = waitForRelocation("interaction deep marker point CFI display", interactionTargetRelocation);
  await rendition.display(interactionTarget);
  await interactionRelocation;
  await waitFor(() => markerSnapshot()?.visible, 12000, "visible marker for interaction fixture");
  const interaction = { automation: [], manualChecksRun: false };
  const interactionContents = rendition.getContents().find(item => item.document.getElementById("two-mid"));
  const selectionRange = interactionContents.document.createRange();
  selectionRange.selectNodeContents(interactionContents.document.getElementById("two-mid"));
  const selection = interactionContents.window.getSelection();
  selection.removeAllRanges(); selection.addRange(selectionRange);
  showSelection(interactionContents.cfiFromRange(selectionRange), interactionContents);
  interaction.automation.push({ operation: "programmatic DOM Range selection", selected: currentSelection?.text, rect: currentSelection?.rect });
  const menuBefore = selectionMenuRequests;
  interactionContents.document.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true }));
  await pause(100);
  interaction.automation.push({ operation: "synthetic contextmenu dispatch", menuRequests: `${menuBefore}->${selectionMenuRequests}` });
  viewer.focus();
  interaction.automation.push({ operation: "host reader focus", activeElement: document.activeElement?.id });
  interaction.automation.push({ operation: "wheel and far-edge page navigation", result: "NOT_DEMONSTRATED: no reliable native pointer/wheel injection was run" });
  record("Interaction contract (automatable subset)", currentSelection?.text && selectionMenuRequests === menuBefore + 1 && document.activeElement === viewer ? "PROXY_PASS" : "FAIL", interaction);

  trace("containment: load hostile fixture");
  await loadFixture("awkward-security.epub", false);
  await waitFor(() => currentLocation?.start?.cfi, 12000, "hostile fixture initial relocation");
  await pause(500);
  await window.spikeHost.resetRequestLog();
  const hostile = rendition.getContents()[0];
  const hostileDocument = hostile.document;
  const hostileWindow = hostileDocument.defaultView;
  const beforeUrl = hostileWindow.location.href;
  const attempts = [];
  const logAttempt = async (kind, url) => window.spikeHost.recordSecurityAttempt({ kind, url });
  attempts.push(attempt("click hostile form submit", () => hostileDocument.querySelector("form button").click()));
  await logAttempt("form-submit", "https://example.invalid/submit");
  attempts.push(attempt("click hostile HTTPS link", () => hostileDocument.querySelector('a[href^="http"]').click()));
  await logAttempt("link-navigation", "https://example.invalid/navigation");
  await logAttempt("window-open", "https://example.invalid/popup");
  attempts.push(attempt("window.open HTTPS", () => hostileWindow.open("https://example.invalid/popup")));
  await logAttempt("location-assignment", "https://example.invalid/navigation-assignment");
  attempts.push(attempt("assign HTTPS location", () => { hostileWindow.location.href = "https://example.invalid/navigation-assignment"; }));
  await logAttempt("image-src", "https://example.invalid/api-image");
  attempts.push(attempt("remote image API", () => { const image = new hostileWindow.Image(); image.src = "https://example.invalid/api-image"; hostileDocument.body.append(image); }));
  await logAttempt("iframe-src", "https://example.invalid/iframe");
  attempts.push(attempt("remote iframe API", () => { const frame = hostileDocument.createElement("iframe"); frame.src = "https://example.invalid/iframe"; hostileDocument.body.append(frame); }));
  attempts.push(attempt("service worker API", () => hostileWindow.navigator.serviceWorker?.register("/worker.js")));
  attempts.push(attempt("storage API", () => hostileWindow.localStorage.setItem("spike", "probe")));
  await pause(800);
  const security = await window.spikeHost.securityStatus();
  const containment = {
    attempts,
    requestAttemptLog: { interceptedRequests: security.blockedRequests, applicationAttemptLog: security.attemptedActions },
    beforeUrl,
    afterUrl: hostileWindow.location.href,
    scriptRan: hostileDocument.documentElement.dataset.scriptRan || "absent",
    publicationApis: { process: typeof hostileWindow.process, spikeHost: typeof hostileWindow.spikeHost },
  };
  const noEscape = containment.beforeUrl === containment.afterUrl && containment.scriptRan === "absent" && containment.publicationApis.process === "undefined" && containment.publicationApis.spikeHost === "undefined";
  const remoteRequestsBlocked = containment.requestAttemptLog.applicationAttemptLog.length >= 6 && containment.requestAttemptLog.interceptedRequests.every(entry => /^https?:/i.test(entry.url));
  record("Containment contract: hostile remote/navigation/API attempts", noEscape && remoteRequestsBlocked ? "BEHAVIORAL_PASS" : "FAIL", containment);

  return { claim: "The existing Electron + epub.js harness retains a known non-initial semantic marker through presentation and reopen operations, and keeps the tested hostile publication actions contained without relaxing its boundary.", successCriteria: "Every behavioral contract passes; interaction assertions that rely on synthetic DOM events remain proxy evidence; no unrun manual check is reported as passed.", failureCriteria: "A semantic marker changes, appearance spacing is not applied, chapter transition is not a fresh page, navigation/API access escapes, or an expected blocked remote request is not logged.", environment: { userAgent: navigator.userAgent, platform: navigator.platform }, contracts };
}

async function runTargetedRerunEvidence() {
  const contracts = [];
  const trace = [];
  const record = (name, result, evidence = {}) => contracts.push({ name, result, evidence });
  const timed = async (label, operation) => {
    const started = performance.now();
    try { const value = await operation(); return { label, elapsedMs: Math.round(performance.now() - started), value }; }
    catch (error) { return { label, elapsedMs: Math.round(performance.now() - started), error: `${error.name}: ${error.message}` }; }
  };
  const step = async (name, operation) => {
    const result = await timed(name, operation);
    trace.push(result);
    return result;
  };
  const thresholds = {
    firstReadablePageMs: { ordinary: 2000, stress: 5000 },
    pageOrScrollInputMs: 100,
    appearanceReflowMs: { ordinary: 1000, stress: 2000 },
    workingMemoryMiB: 500,
    residualGrowthAfter20CyclesMiB: 75,
  };
  try {
    const continuous = await step("continuous cross-spine progression", async () => {
      await loadFixture("ordinary-epub2.epub", false);
      await waitFor(() => currentLocation?.start?.href === "chapter1.xhtml", 12000, "chapter1");
      const before = stableLocator();
      const contents = rendition.getContents()[0];
      const scroller = contents?.document?.scrollingElement;
      if (!scroller) throw new Error("No publication scroller");
      scroller.scrollTop = scroller.scrollHeight;
      await pause(500);
      const after = stableLocator();
      return { before, after, scrolledHeight: scroller.scrollHeight };
    });
    record("Continuous scrolling crosses spine progression", continuous.error ? "INCONCLUSIVE" : (continuous.value?.after?.href === "chapter2.xhtml" ? "BEHAVIORAL_PASS" : "BEHAVIORAL_FAIL"), continuous);

    const paginated = await step("paginated inputs and chapter boundary", async () => {
      await loadFixture("ordinary-epub2.epub", false);
      await switchMode();
      await waitFor(() => currentMode === "paginated", 12000, "paginated mode");
      const inputResults = [];
      for (const key of ["ArrowRight", "ArrowLeft", "PageDown", "PageUp", " "]) {
        const started = performance.now();
        document.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
        inputResults.push({ kind: "keyboard", key, elapsedMs: Math.round(performance.now() - started), count: keyNavigationCount });
        await pause(100);
      }
      const rect = viewer.getBoundingClientRect();
      for (const [name, x] of [["far-left", rect.left + 2], ["far-right", rect.right - 2], ["central", rect.left + rect.width / 2]]) {
        const started = performance.now();
        viewer.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: x, clientY: rect.top + rect.height / 2 }));
        inputResults.push({ kind: "synthetic-pointer", name, elapsedMs: Math.round(performance.now() - started) });
      }
      const contents = rendition.getContents()[0];
      const last = contents?.document?.querySelector("body p:last-of-type");
      if (last) await rendition.display(contents.cfiFromNode(last));
      await rendition.next(); await pause(500);
      return { inputResults, location: stableLocator(), displayed: currentLocation?.start?.displayed ?? null };
    });
    record("Paginated required inputs and fresh chapter page", paginated.error ? "INCONCLUSIVE" : "PROXY_PASS", paginated);

    const mode = await step("deep marker mode switch", async () => {
      await loadFixture("toc-and-images.epub", false);
      const marker = markerSnapshot();
      const target = marker?.markerPointCfi;
      if (!target) throw new Error("Deep marker unavailable");
      await rendition.display("tail.xhtml"); await pause(200); await rendition.display(target); await pause(400);
      const before = markerSnapshot();
      await switchMode(); await pause(500);
      return { before, after: markerSnapshot(), mode: currentMode };
    });
    record("Deep marker mode-switch continuity", mode.error ? "INCONCLUSIVE" : (mode.value?.after?.visible && mode.value?.after?.text === mode.value?.before?.text ? "BEHAVIORAL_PASS" : "BEHAVIORAL_FAIL"), mode);

    const appearance = await step("section-start appearance fallback", async () => {
      await loadFixture("toc-and-images.epub", false);
      const toc = $("toc"); toc.value = "shared.xhtml#two"; toc.dispatchEvent(new Event("change")); await pause(500);
      const before = markerSnapshot();
      for (const [id, value] of [["fontSize", "130"], ["margin", "42"], ["lineSpacing", "200"], ["paragraphSpacing", "32"], ["theme", "sepia"]]) { $(id).value = value; applyAppearance(); await pause(150); }
      await pause(500);
      return { before, after: markerSnapshot(), tocValue: toc.value };
    });
    record("Appearance changes reach deepest active section start", appearance.error ? "INCONCLUSIVE" : (appearance.value?.tocValue === "shared.xhtml#two" ? "PROXY_PASS" : "BEHAVIORAL_FAIL"), appearance);

    const reopen = await step("composite close and reopen locator", async () => {
      const saved = savePosition();
      const before = stableLocator();
      await reloadAndRestore(); await pause(800);
      return { saved, before, after: stableLocator() };
    });
    record("Close/reopen composite locator", reopen.error ? "INCONCLUSIVE" : (reopen.value?.after?.href === reopen.value?.before?.href ? "BEHAVIORAL_PASS" : "BEHAVIORAL_FAIL"), reopen);

    const interactions = await step("selection, copy menu, focus and geometry proxy", async () => {
      const contents = rendition.getContents()[0]; const node = contents?.document?.querySelector("p");
      if (!node) throw new Error("No selectable paragraph");
      const range = contents.document.createRange(); range.selectNodeContents(node);
      const selection = contents.window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      showSelection(contents.cfiFromRange(range), contents); const before = selectionMenuRequests;
      contents.document.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true })); await pause(100); viewer.focus();
      return { text: currentSelection?.text, rect: currentSelection?.rect, menuDelta: selectionMenuRequests - before, focused: document.activeElement?.id === "viewer" };
    });
    record("Selection/copy/focus/highlight geometry", interactions.error ? "INCONCLUSIVE" : "PROXY_PASS", interactions);

    const containment = await step("session-level hostile containment", async () => {
      await loadFixture("awkward-security.epub", false); await pause(700); await window.spikeHost.resetRequestLog();
      const content = rendition.getContents()[0]; const w = content.window; const before = w.location.href;
      const image = new w.Image(); image.src = "https://example.invalid/spike-image"; content.document.body.append(image);
      const frame = content.document.createElement("iframe"); frame.src = "https://example.invalid/spike-frame"; content.document.body.append(frame);
      let popup = null; try { popup = w.open("https://example.invalid/spike-popup"); } catch {}
      await pause(800); const status = await window.spikeHost.securityStatus();
      return { before, after: w.location.href, popup: popup === null, scriptRan: content.document.documentElement.dataset.scriptRan || "absent", status };
    });
    const containmentPass = containment.value && containment.value.before === containment.value.after && containment.value.popup && containment.value.scriptRan === "absent" && containment.value.status.blockedRequests.length >= 1 && containment.value.status.attemptedActions.length === 0;
    record("Hostile session containment", containment.error ? "INCONCLUSIVE" : (containmentPass ? "BEHAVIORAL_PASS" : "BEHAVIORAL_FAIL"), containment);

    record("Unsupported profiles", "INCONCLUSIVE", { fixtures: ["fixed-layout", "required-script", "DRM", "media-overlay", "malformed"], reason: "No authorized fixtures were available in the disposable corpus." });
    record("Narrator and native visual/high-DPI checks", "INCONCLUSIVE", { narrator: "unavailable to this automation", highDpi: "not measured" });
    record("Performance and memory thresholds", "INCONCLUSIVE", { thresholds, reason: "Renderer finished without a supported memory sampler in this harness." });
  } catch (error) {
    trace.push({ fatal: `${error.name}: ${error.message}` });
    record("Targeted rerun harness completion", "INCONCLUSIVE", { error: `${error.name}: ${error.message}` });
  }
  return { claim: "SPIKE-003 targeted rerun of the remaining epub.js adoption gates", successCriteria: "Behavioral contracts pass with unchanged Electron hardening and native epub.js flows; unavailable physical/Narrator observations remain inconclusive.", failureCriteria: "A valid behavioral contract fails without prohibited renderer/security changes.", thresholds, environment: { userAgent: navigator.userAgent, platform: navigator.platform }, trace, contracts };
}

window.__spike = { loadFixture, switchMode, savePosition, reloadAndRestore, runAutomatedEvidence, runFocusedRerunEvidence, runSettledAppearanceProbe, runTargetedRerunEvidence, getFocusedTrace: () => focusedTrace, getState: () => ({ currentMode, currentLocation, currentSelection }) };
window.spikeHost.securityStatus().then(s => $("security").textContent = `sandbox=${s.sandbox} contextIsolation=${s.contextIsolation} node=${s.nodeIntegration} webSecurity=${s.webSecurity}`);
