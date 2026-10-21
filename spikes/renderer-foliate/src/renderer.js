import '../vendor/foliate-js/view.js'

const reader = document.querySelector('#reader')
const pauseFrame = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
const FOLIATE_COMMIT = '78914aef4466eb960965702401634c2cb348e9b1'
const probeStartedAt = performance.now()
const rendererConsole = []
const rendererErrors = []
const rejectedPromises = []
const originalConsoleError = console.error.bind(console)
console.error = (...args) => { rendererConsole.push({ atMs: Math.round(performance.now() - probeStartedAt), args: args.map(String) }); originalConsoleError(...args) }
window.addEventListener('error', event => rendererErrors.push({ atMs: Math.round(performance.now() - probeStartedAt), message: event.message, source: event.filename, line: event.lineno }))
window.addEventListener('unhandledrejection', event => rejectedPromises.push({ atMs: Math.round(performance.now() - probeStartedAt), reason: String(event.reason) }))

function asRange(anchor, doc) {
  if (anchor instanceof Range) return anchor
  const range = doc.createRange()
  range.selectNodeContents(anchor)
  return range
}

function rangeData(range) {
  if (!range) return null
  return {
    startContainer: range.startContainer?.nodeName ?? null,
    startOffset: range.startOffset,
    endContainer: range.endContainer?.nodeName ?? null,
    endOffset: range.endOffset,
    rects: [...range.getClientRects()].map(rect => ({ x: rect.x, y: rect.y, width: rect.width, height: rect.height })),
  }
}

function rectData(rect) {
  return rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height, top: rect.top, right: rect.right, bottom: rect.bottom, left: rect.left } : null
}

function intersectsViewport(rect, viewport = { width: innerWidth, height: innerHeight }) {
  return Boolean(rect && rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.bottom > 0 && rect.left < viewport.width && rect.top < viewport.height)
}

function targetContentFor(view, index) {
  return view.renderer.getContents().find(item => item.index === index)
}

function markerFor(view, index) {
  return targetContentFor(view, index)?.doc.getElementById('two-mid') ?? null
}

function semanticResolution(view, targetCfi, index) {
  const resolved = view.resolveNavigation(targetCfi)
  const content = targetContentFor(view, resolved?.index)
  const marker = content?.doc.getElementById('two-mid')
  const anchor = resolved?.anchor?.(content?.doc)
  const anchorElement = anchor?.nodeType === Node.ELEMENT_NODE ? anchor : anchor?.startContainer?.parentElement
  const range = anchor && content ? asRange(anchor, content.doc) : null
  return {
    index: resolved?.index ?? null,
    expectedIndex: index,
    resolves: Boolean(resolved && anchor),
    identifiesMarker: Boolean(marker && anchorElement && (anchorElement === marker || marker.contains(anchorElement))),
    semanticContainment: Boolean(marker && anchorElement && (anchorElement === marker || marker.contains(anchorElement))),
    markerText: marker?.textContent.trim() ?? null,
    anchorElement: anchorElement?.id ? `#${anchorElement.id}` : anchorElement?.nodeName ?? null,
    range: rangeData(range),
  }
}

function computedAppearance(view, index) {
  const { doc } = targetContentFor(view, index) || {}
  const marker = doc?.getElementById('two-mid')
  const body = doc && getComputedStyle(doc.body)
  const paragraph = marker && getComputedStyle(marker)
  return {
    fontSize: body?.fontSize ?? null,
    lineHeight: paragraph?.lineHeight ?? null,
    paragraphMarginBottom: paragraph?.marginBottom ?? null,
    color: body?.color ?? null,
    backgroundColor: body?.backgroundColor ?? null,
    paginatorMargin: view.renderer?.getAttribute('margin') ?? null,
  }
}

function visibility(view, index) {
  const marker = markerFor(view, index)
  const range = view.lastLocation?.range
  const markerRect = marker?.getBoundingClientRect()
  const viewport = { width: innerWidth, height: innerHeight }
  return {
    rangeIntersectsMarker: Boolean(marker && range?.intersectsNode(marker)),
    markerRect: rectData(markerRect),
    viewport,
    markerIntersectsViewport: intersectsViewport(markerRect, viewport),
    markerTextVisible: Boolean(marker?.textContent.trim() && intersectsViewport(markerRect, viewport)),
  }
}

function createRelocationRecorder(view) {
  const events = []
  const startedAt = performance.now()
  let expectation = null
  const onRelocate = event => {
    const location = event.detail
    const accepted = Boolean(expectation && location.index === expectation.index && expectation.predicate(location))
    events.push({
      atMs: Math.round(performance.now() - startedAt),
      index: location.index ?? null,
      cfi: location.cfi ?? null,
      range: rangeData(location.range),
      viewport: { width: innerWidth, height: innerHeight },
      accepted,
      rejectionReason: accepted ? null : expectation ? (location.index !== expectation.index ? 'unexpected-index' : 'predicate-rejected') : 'no-active-waiter',
    })
    if (accepted) expectation.resolve(location)
  }
  view.addEventListener('relocate', onRelocate)
  return {
    events,
    wait(index, label, predicate = () => true) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { expectation = null; reject(new Error(`Timed out waiting for Foliate relocation: ${label}`)) }, 12000)
        expectation = { index, predicate, resolve: location => { clearTimeout(timer); expectation = null; resolve(location) } }
      })
    },
    stop: () => view.removeEventListener('relocate', onRelocate),
  }
}

async function runAppearanceProbe() {
  let recorder = null
  let phase = 'probe-start'
  let canonical = null
  let targetCfi = null
  const diagnostics = { probeStartedAtMs: probeStartedAt, fixtureRead: false, viewOpen: false, canonicalTarget: false, initialGoTo: false, initialGoToReturned: false, beforeScreenshot: false, styleApplied: false, finalGoTo: false, finalGoToReturned: false, finalScreenshot: false }
  const checkpoint = async (nextPhase, details = {}) => {
    phase = nextPhase
    await window.foliateHost.recordProbeCheckpoint({ phase, atMs: Math.round(performance.now() - probeStartedAt), details, diagnostics: { ...diagnostics }, canonical, targetCfi, relocations: recorder?.events ?? [], rendererConsole, rendererErrors, rejectedPromises })
  }
  try {
    await checkpoint('fixture-read-start')
    const bytes = await window.foliateHost.readFixture()
    diagnostics.fixtureRead = true
    await checkpoint('fixture-read-complete', { bytes: bytes.byteLength })
    const file = new File([bytes], 'toc-and-images.epub', { type: 'application/epub+zip' })
    const view = document.createElement('foliate-view')
    reader.replaceChildren(view)
    view.addEventListener('error', event => { const detail = event.detail ?? event.error ?? event.message ?? 'Foliate view error'; rendererErrors.push({ atMs: Math.round(performance.now() - probeStartedAt), type: 'foliate-error', detail: String(detail) }) })
    recorder = createRelocationRecorder(view)
    await checkpoint('view-open-start')
    await view.open(file)
    diagnostics.viewOpen = true
    await checkpoint('view-open-complete', { sectionCount: view.book.sections.length })
    view.renderer.setAttribute('flow', 'paginated')
    view.renderer.setAttribute('margin', '42px')
    const matchingSections = view.book.sections.filter(section => section.id?.endsWith('/shared.xhtml'))
    if (matchingSections.length !== 1) throw new Error(`Expected exactly one /shared.xhtml section, found ${matchingSections.length}`)
    const targetSection = matchingSections[0]
    const canonicalHref = `${targetSection.id}#two-mid`
    const destination = view.book.resolveHref(canonicalHref)
    if (!destination || !Number.isInteger(destination.index) || typeof destination.anchor !== 'function') throw new Error(`Foliate-js could not resolve ${canonicalHref}`)
    diagnostics.canonicalTarget = true
    canonical = { sectionId: targetSection.id, canonicalHref, destinationIndex: destination.index, hasAnchor: true, matchingSectionCount: matchingSections.length, anchorMetadata: { type: typeof destination.anchor, source: 'book.resolveHref(canonicalHref)' } }
    await checkpoint('canonical-derived', canonical)

    await checkpoint('initial-goTo-start', { href: canonicalHref, expectedIndex: destination.index })
    const initialRelocation = recorder.wait(destination.index, 'initial target spine item')
    const initialGoToResult = await view.goTo(canonicalHref)
    diagnostics.initialGoTo = true
    diagnostics.initialGoToReturned = Boolean(initialGoToResult && initialGoToResult.index === destination.index)
    await checkpoint('initial-goTo-returned', { href: canonicalHref, expectedIndex: destination.index, returned: initialGoToResult ? { index: initialGoToResult.index, hasAnchor: typeof initialGoToResult.anchor === 'function' } : null })
    if (!diagnostics.initialGoToReturned) throw new Error('Foliate view.goTo(canonicalHref) did not return the expected destination')
    const initialLocation = await initialRelocation
    await checkpoint('initial-relocation-accepted', { index: initialLocation.index, cfi: initialLocation.cfi ?? null })
    const targetContent = targetContentFor(view, destination.index)
    const targetMarker = targetContent?.doc.getElementById('two-mid')
    if (!targetMarker) throw new Error('Foliate-js did not load #two-mid after target relocation')
    const targetAnchor = destination.anchor(targetContent.doc)
    targetCfi = view.getCFI(destination.index, asRange(targetAnchor, targetContent.doc))
    if (!targetCfi) throw new Error('Foliate-js did not derive a stable CFI for #two-mid')
    await checkpoint('cfi-derived', { targetCfi })
    const before = { resolution: semanticResolution(view, targetCfi, destination.index), appearance: computedAppearance(view, destination.index), visibility: visibility(view, destination.index), initialLocation: { index: initialLocation.index, cfi: initialLocation.cfi ?? null, range: rangeData(initialLocation.range) } }
    if (!before.resolution.resolves || !before.resolution.identifiesMarker || !before.visibility.markerIntersectsViewport) throw new Error('Stable Foliate CFI did not identify and visibly reach #two-mid before appearance')
    await window.foliateHost.captureAppearanceScreenshot('before')
    diagnostics.beforeScreenshot = true
    await checkpoint('before-screenshot-captured')

    const css = `body { font-size: 130% !important; color: #432 !important; background: #f2e4c6 !important; } p { line-height: 2 !important; margin-bottom: 32px !important; }`
    view.renderer.setStyles(css)
    diagnostics.styleApplied = true
    await checkpoint('styles-applied')
    await pauseFrame()
    await targetContent.doc.fonts.ready
    await pauseFrame()
    const afterStyle = { resolution: semanticResolution(view, targetCfi, destination.index), appearance: computedAppearance(view, destination.index), visibility: visibility(view, destination.index) }
    const styles = afterStyle.appearance
    const styleAssertions = {
      fontSize: Number.isFinite(parseFloat(styles.fontSize)) && parseFloat(styles.fontSize) > 0,
      color: styles.color === 'rgb(68, 51, 34)',
      backgroundColor: styles.backgroundColor === 'rgb(242, 228, 198)',
      lineHeightRatio: Number.isFinite(parseFloat(styles.lineHeight) / parseFloat(styles.fontSize)) && Math.abs(parseFloat(styles.lineHeight) / parseFloat(styles.fontSize) - 2) < 0.01,
      paragraphMarginBottom: styles.paragraphMarginBottom === '32px',
      paginatorMargin: styles.paginatorMargin === '42px',
      cfiRetainsMarker: afterStyle.resolution.resolves && afterStyle.resolution.identifiesMarker && afterStyle.resolution.index === destination.index,
    }
    if (!Object.values(styleAssertions).every(Boolean)) throw new Error(`Settled appearance assertions failed: ${JSON.stringify(styleAssertions)}`)
    await checkpoint('appearance-assertions-complete', { styleAssertions, afterStyle })

    await checkpoint('targetCfi-goTo-start', { targetCfi, expectedIndex: destination.index })
    const finalRelocation = recorder.wait(destination.index, 'target CFI display', location => location.range?.intersectsNode(targetMarker))
    const finalGoToResult = await view.goTo(targetCfi)
    diagnostics.finalGoTo = true
    diagnostics.finalGoToReturned = Boolean(finalGoToResult && finalGoToResult.index === destination.index)
    await checkpoint('targetCfi-goTo-returned', { targetCfi, expectedIndex: destination.index, returned: finalGoToResult ? { index: finalGoToResult.index, hasAnchor: typeof finalGoToResult.anchor === 'function' } : null })
    if (!diagnostics.finalGoToReturned) throw new Error('Foliate view.goTo(targetCfi) did not return the expected destination')
    const location = await finalRelocation
    await checkpoint('targetCfi-relocation-accepted', { index: location.index, cfi: location.cfi ?? null })
    await pauseFrame()
    const final = { cfi: location.cfi ?? null, index: location.index, range: rangeData(location.range), visibility: visibility(view, destination.index) }
    const finalAssertions = { matchingIndex: final.index === destination.index, rangeIntersectsMarker: final.visibility.rangeIntersectsMarker, markerIntersectsViewport: final.visibility.markerIntersectsViewport, markerTextVisible: final.visibility.markerTextVisible, retainedAppearance: Object.values(styleAssertions).every(Boolean) }
    await window.foliateHost.captureAppearanceScreenshot('after')
    diagnostics.finalScreenshot = true
    await checkpoint('final-screenshot-captured')
    const assertions = { canonicalTarget: diagnostics.canonicalTarget, initialRelocation: initialLocation.index === destination.index, initialSemanticIdentity: before.resolution.identifiesMarker, initialVisible: before.visibility.markerIntersectsViewport, ...styleAssertions, ...finalAssertions }
    return { claim: 'On a functioning Windows 11 x64 Electron host, pinned Foliate-js preserves and visibly restores a deep semantic target after one settled paginated appearance transaction.', successCriteria: 'Canonical target, stable unchanged CFI, settled requested appearance values, and one target-filtered CFI redisplay all pass with visible nested paragraph.', failureCriteria: 'Any required environment, security, semantic, style, relocation, or visibility assertion fails.', classification: Object.values(assertions).every(Boolean) ? 'BEHAVIORAL_PASS' : 'BEHAVIORAL_FAIL', result: Object.values(assertions).every(Boolean) ? 'BEHAVIORAL_PASS' : 'BEHAVIORAL_FAIL', upstreamCommit: FOLIATE_COMMIT, canonical, targetCfi, before, afterStyle, final, relocations: recorder.events, assertions, diagnostics }
  } catch (error) {
    error.spikeFailureCategory = phase.includes('goTo') || phase.includes('relocation') ? 'navigation-or-relocation' : 'assertion-or-operation'
    error.spikeDetails = { phase, lastCompletedPhase: phase, diagnostics, canonical, targetCfi, relocations: recorder?.events ?? [], rendererConsole, rendererErrors, rejectedPromises }
    try { await checkpoint('terminal-error', { message: error.message, failureCategory: error.spikeFailureCategory }) } catch {}
    throw error
  } finally {
    recorder?.stop()
  }
}

window.__foliateSpike = { runAppearanceProbe }
