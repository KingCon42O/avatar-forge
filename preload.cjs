const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("avatarForgeAI", Object.freeze({
  getState: () => ipcRenderer.invoke("ai:get-state"),
  install: () => ipcRenderer.invoke("ai:install"),
  onProgress: (callback) => ipcRenderer.on("ai:progress", (_event, value) => callback(value)),
  generate: (options) => ipcRenderer.invoke("ai:generate", {
    description: String(options?.description ?? ""),
    style: String(options?.style ?? ""),
    quality: String(options?.quality ?? "")
  })
}));
