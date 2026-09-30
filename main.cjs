const { app, BrowserWindow, ipcMain, safeStorage, session, shell } = require("electron");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const { generateTransparentAvatar } = require("./ai-avatar.cjs");

let server;
let sessionApiKey = "";
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".wasm": "application/wasm", ".task": "application/octet-stream" };

function keyFile() { return path.join(app.getPath("userData"), "openai-api-key.bin"); }
function loadApiKey() {
  if (process.env.OPENAI_API_KEY) return process.env.OPENAI_API_KEY.trim();
  if (sessionApiKey) return sessionApiKey;
  try {
    if (safeStorage.isEncryptionAvailable() && fs.existsSync(keyFile())) return safeStorage.decryptString(fs.readFileSync(keyFile()));
  } catch (error) { console.error("Could not read encrypted API key:", error.message); }
  return "";
}

function registerAiHandlers() {
  ipcMain.handle("ai:get-key-state", () => ({ configured: Boolean(loadApiKey()), persistent: safeStorage.isEncryptionAvailable() }));
  ipcMain.handle("ai:save-key", (_event, rawKey) => {
    const key = String(rawKey ?? "").trim();
    if (!key.startsWith("sk-") || key.length < 20 || key.length > 300) throw new Error("Enter a valid OpenAI API key.");
    sessionApiKey = key;
    if (safeStorage.isEncryptionAvailable()) {
      fs.mkdirSync(path.dirname(keyFile()), { recursive: true });
      fs.writeFileSync(keyFile(), safeStorage.encryptString(key), { mode: 0o600 });
      return { configured: true, persistent: true };
    }
    return { configured: true, persistent: false };
  });
  ipcMain.handle("ai:clear-key", () => {
    sessionApiKey = "";
    try { if (fs.existsSync(keyFile())) fs.unlinkSync(keyFile()); } catch (error) { console.error("Could not remove encrypted API key:", error.message); }
    return { configured: false, persistent: safeStorage.isEncryptionAvailable() };
  });
  ipcMain.handle("ai:generate", async (_event, options) => {
    try { return { ok: true, ...(await generateTransparentAvatar({ apiKey: loadApiKey(), ...options })) }; }
    catch (error) { return { ok: false, error: error.message || "Avatar generation failed.", requestId: error.requestId || "" }; }
  });
}

function startLocalApp() {
  const root = path.join(__dirname, "app");
  return new Promise((resolve, reject) => {
    server = http.createServer((request, response) => {
      const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
      const target = path.resolve(root, `.${pathname === "/" ? "/index.html" : pathname}`);
      if (!target.startsWith(root) || !fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        response.writeHead(404); response.end("Not found"); return;
      }
      response.writeHead(200, { "Content-Type": mime[path.extname(target)] || "application/octet-stream", "Cache-Control": "no-store" });
      fs.createReadStream(target).pipe(response);
    });
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(`http://127.0.0.1:${server.address().port}`));
  });
}

app.whenReady().then(async () => {
  registerAiHandlers();
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => permission === "media");
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => callback(permission === "media"));
  const origin = await startLocalApp();
  const window = new BrowserWindow({ width: 1440, height: 900, minWidth: 1050, minHeight: 700, backgroundColor: "#08070c", title: "Avatar Forge", webPreferences: { contextIsolation: true, nodeIntegration: false, preload: path.join(__dirname, "preload.cjs") } });
  window.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  window.webContents.on("will-navigate", (event, url) => { if (!url.startsWith(origin)) { event.preventDefault(); shell.openExternal(url); } });
  await window.loadURL(origin);
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => server?.close());
