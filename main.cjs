const { app, BrowserWindow, session, shell } = require("electron");
const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

let server;
const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".wasm": "application/wasm", ".task": "application/octet-stream" };

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
  session.defaultSession.setPermissionCheckHandler((_webContents, permission) => permission === "media");
  session.defaultSession.setPermissionRequestHandler((_webContents, permission, callback) => callback(permission === "media"));
  const origin = await startLocalApp();
  const window = new BrowserWindow({ width: 1440, height: 900, minWidth: 1050, minHeight: 700, backgroundColor: "#08070c", title: "Avatar Forge", webPreferences: { contextIsolation: true, nodeIntegration: false } });
  window.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  window.webContents.on("will-navigate", (event, url) => { if (!url.startsWith(origin)) { event.preventDefault(); shell.openExternal(url); } });
  await window.loadURL(origin);
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => server?.close());
