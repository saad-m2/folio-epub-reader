import { ReaderAdapter } from "./reader-adapter";
import { validatePublicationProfile } from "./publication-validation";
import type { Appearance, ReaderLocation } from "../shared/contracts";

const appearance: Appearance = {
  theme: "light",
  fontSize: 18,
  margin: 48,
  lineHeight: 1.55,
  paragraphSpacing: 0.75,
  fontFamily: "Liberation Sans Reader",
};
function requireCheck(value: unknown, label: string): asserts value {
  if (!value) throw new Error(label);
}
const paint = () =>
  new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
  );

declare global {
  interface Window {
    releaseTest?: (
      bytes: number[],
      expected: string,
      cycles: number,
      restore?: ReaderLocation,
    ) => Promise<unknown>;
  }
}

window.releaseTest = async (bytes, expected, cycles, restore) => {
  let archive: ArrayBuffer | undefined = Uint8Array.from(bytes).buffer;
  if (expected !== "supported") {
    try {
      await validatePublicationProfile(archive);
    } catch (error) {
      requireCheck(
        (error as { code?: string }).code === expected,
        "wrong rejection category",
      );
      return { rejected: expected };
    }
    throw new Error("unsupported or invalid archive accepted");
  }
  const host = document.createElement("div");
  host.style.cssText = "position:fixed;inset:0;z-index:99999;background:#fff;";
  document.body.append(host);
  const adapter = new ReaderAdapter(host);
  const liveBlobs = new Set<string>();
  const create = URL.createObjectURL.bind(URL),
    revoke = URL.revokeObjectURL.bind(URL);
  const managerCallbacks = new Map<
    string,
    Set<EventListenerOrEventListenerObject>
  >(["unload", "resize", "orientationchange"].map((type) => [type, new Set()]));
  const addWindow = window.addEventListener.bind(window),
    removeWindow = window.removeEventListener.bind(window);
  window.addEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ) => {
    managerCallbacks.get(type)?.add(listener);
    addWindow(type, listener, options);
  }) as typeof window.addEventListener;
  window.removeEventListener = ((
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ) => {
    managerCallbacks.get(type)?.delete(listener);
    removeWindow(type, listener, options);
  }) as typeof window.removeEventListener;
  URL.createObjectURL = (blob) => {
    const url = create(blob);
    liveBlobs.add(url);
    return url;
  };
  URL.revokeObjectURL = (url) => {
    liveBlobs.delete(url);
    revoke(url);
  };
  const timings: Array<{
    openMs: number;
    modeChangeMs: number;
    nextMs: number;
    reflowMs: number;
  }> = [];
  const themes: string[] = [];
  let location: ReaderLocation | undefined;
  let hasNavigation = false;
  let binaryResources = false;
  let stage = "validation";
  let failed = false;
  try {
    await validatePublicationProfile(archive);
    for (let cycle = 0; cycle < cycles; cycle++) {
      stage = `open cycle ${cycle + 1}`;
      let start = performance.now();
      const snapshot = await adapter
        .open({
          archiveBytes: archive,
          mode: "continuous",
          appearance,
          initialLocation: restore,
        })
        .catch((error) => {
          throw new Error(`open: ${error.message}`);
        });
      await paint();
      const openMs = performance.now() - start;
      hasNavigation = snapshot.hasNavigation;
      requireCheck(
        host
          .querySelector("iframe")
          ?.contentDocument?.body?.textContent?.trim(),
        "no readable content",
      );
      const frames = Array.from(host.querySelectorAll("iframe"));
      for (const frame of frames) {
        requireCheck(
          frame.hasAttribute("sandbox") &&
            !frame.sandbox.contains("allow-scripts"),
          "publication scripts permitted",
        );
        requireCheck(
          !(
            frame.contentWindow as Window & {
              readerApi?: unknown;
              require?: unknown;
            }
          ).readerApi &&
            !(frame.contentWindow as Window & { require?: unknown }).require,
          "publication has app/Node bridge",
        );
        requireCheck(
          frame.contentDocument?.body?.dataset.scriptRan !== "yes",
          "publication script executed",
        );
      }
      const doc = frames[0].contentDocument!;
      if (doc.getElementById("two-mid")) {
        const sheet = [...doc.styleSheets].find((s) =>
          s.href?.startsWith("blob:"),
        );
        binaryResources =
          !!sheet &&
          !!doc.querySelector("img")?.currentSrc.startsWith("blob:") &&
          (await doc.fonts.load("16px ProofFont")).length > 0;
        requireCheck(binaryResources, "F4/F5 image/CSS/font regression");
      }
      const target = snapshot.toc[0]?.children[0] ?? snapshot.toc[0];
      if (target) await adapter.goTo({ href: target.href, navId: target.id });
      start = performance.now();
      stage = "switch to paginated";
      await adapter.setMode("paginated", appearance).catch((error) => {
        throw new Error(`setMode: ${error.message}`);
      });
      // Measure page movement from a painted page, rather than charging the
      // pending mode change to the next action. Keep that latency separately.
      await paint();
      const modeChangeMs = performance.now() - start;
      stage = "next page";
      start = performance.now();
      await adapter.next();
      await paint();
      const nextMs = performance.now() - start;
      stage = "previous page";
      await adapter.previous();
      start = performance.now();
      stage = "dark appearance";
      await adapter.applyAppearance({ ...appearance, theme: "dark" });
      await paint();
      const reflowMs = performance.now() - start;
      for (const theme of ["light", "dark", "sepia", "system"] as const) {
        stage = `theme ${theme}`;
        await adapter.applyAppearance({ ...appearance, theme });
        await paint();
        const frame = host.querySelector("iframe")!;
        const background = frame.contentWindow!.getComputedStyle(
          frame.contentDocument!.body,
        ).backgroundColor;
        if (theme !== "system")
          requireCheck(
            background ===
              {
                light: "rgb(250, 250, 245)",
                dark: "rgb(32, 37, 31)",
                sepia: "rgb(238, 231, 216)",
              }[theme],
            `theme ${theme} failed`,
          );
        if (!themes.includes(theme)) themes.push(theme);
      }
      location = adapter.captureLocation();
      stage = "close and resource cleanup";
      requireCheck(location.href, "no restorable location");
      await adapter.close();
      const internal = adapter as unknown as {
        archiveBytes?: ArrayBuffer;
        book?: unknown;
        rendition?: unknown;
        frameCleanups: Map<unknown, unknown>;
      };
      requireCheck(
        !internal.archiveBytes &&
          !internal.book &&
          !internal.rendition &&
          internal.frameCleanups.size === 0 &&
          !host.querySelector("iframe"),
        "reader resource leak",
      );
      requireCheck(
        liveBlobs.size === 0,
        `unreleased blob URLs: ${liveBlobs.size}`,
      );
      for (const [type, callbacks] of managerCallbacks)
        requireCheck(
          callbacks.size === 0,
          `retained ${type} callbacks: ${callbacks.size}`,
        );
      timings.push({ openMs, modeChangeMs, nextMs, reflowMs });
    }
    return {
      timings,
      themes,
      location,
      hasNavigation,
      binaryResources,
      cleanup: true,
      managerCallbacksReleased: true,
    };
  } catch (error) {
    failed = true;
    throw new Error(
      `${stage}: ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`,
    );
  } finally {
    // A secondary teardown error must not hide the operation that first failed.
    try {
      await adapter.close();
    } catch (error) {
      if (!failed) throw error;
    } finally {
      archive = undefined;
      host.remove();
      URL.createObjectURL = create;
      URL.revokeObjectURL = revoke;
      for (const [type, callbacks] of managerCallbacks)
        for (const callback of callbacks) removeWindow(type, callback);
      window.addEventListener = addWindow;
      window.removeEventListener = removeWindow;
    }
  }
};
