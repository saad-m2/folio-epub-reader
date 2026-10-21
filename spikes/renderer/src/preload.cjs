const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("spikeHost", Object.freeze({
  readFixture: name => ipcRenderer.invoke("fixture:read", name),
  openEpub: () => ipcRenderer.invoke("file:open-epub"),
  showSelectionMenu: () => ipcRenderer.invoke("selection:menu"),
  securityStatus: () => ipcRenderer.invoke("security:status"),
  resetRequestLog: () => ipcRenderer.invoke("security:reset-request-log"),
  recordSecurityAttempt: attempt => ipcRenderer.invoke("security:record-attempt", attempt),
}));
