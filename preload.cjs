const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("avatarForgeAI", Object.freeze({
  getKeyState: () => ipcRenderer.invoke("ai:get-key-state"),
  saveKey: (key) => ipcRenderer.invoke("ai:save-key", String(key ?? "")),
  clearKey: () => ipcRenderer.invoke("ai:clear-key"),
  generate: (options) => ipcRenderer.invoke("ai:generate", {
    description: String(options?.description ?? ""),
    style: String(options?.style ?? ""),
    quality: String(options?.quality ?? "")
  })
}));
