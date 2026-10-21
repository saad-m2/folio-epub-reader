const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("foliateHost", Object.freeze({
  readFixture: () => ipcRenderer.invoke("fixture:read"),
  signalRendererReady: () => ipcRenderer.send("renderer:ready"),
  captureAppearanceScreenshot: phase => ipcRenderer.invoke("appearance:screenshot", phase),
  recordProbeCheckpoint: checkpoint => ipcRenderer.invoke("probe:checkpoint", checkpoint),
}));

window.addEventListener("DOMContentLoaded", () => ipcRenderer.send("renderer:ready"), { once: true });
