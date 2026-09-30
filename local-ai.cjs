const fs = require("node:fs");
const path = require("node:path");
const { spawn } = require("node:child_process");

const MODEL_NAME = "stable-diffusion-v1-5-pruned-emaonly-Q4_0.gguf";
const MODEL_URL = `https://huggingface.co/second-state/stable-diffusion-v1-5-GGUF/resolve/main/${MODEL_NAME}`;

function paths(app) {
  const root = path.join(app.getPath("userData"), "local-ai");
  return { root, model: path.join(root, MODEL_NAME), partial: path.join(root, `${MODEL_NAME}.part`) };
}

function state(app) {
  const p = paths(app);
  const installed = fs.existsSync(p.model) && fs.statSync(p.model).size > 1_000_000_000;
  return { installed, modelName: MODEL_NAME, modelSize: "1.6 GB", backend: "Vulkan GPU with automatic CPU fallback" };
}

async function install(app, progress) {
  const p = paths(app); fs.mkdirSync(p.root, { recursive: true });
  const existing = fs.existsSync(p.partial) ? fs.statSync(p.partial).size : 0;
  const response = await fetch(MODEL_URL, { headers: existing ? { Range: `bytes=${existing}-` } : {}, redirect: "follow" });
  if (!response.ok && response.status !== 206) throw new Error(`Model download failed (${response.status}).`);
  const total = existing + Number(response.headers.get("content-length") || 0);
  const stream = fs.createWriteStream(p.partial, { flags: existing ? "a" : "w" });
  let received = existing;
  try {
    for await (const chunk of response.body) { stream.write(chunk); received += chunk.length; progress?.({ received, total, percent: total ? Math.round(received / total * 100) : 0 }); }
  } finally { await new Promise((resolve) => stream.end(resolve)); }
  if (received < 1_000_000_000) throw new Error("The model download was incomplete. Press Download again to resume.");
  fs.renameSync(p.partial, p.model); return state(app);
}

function prompt(description, style) {
  const text = String(description || "").replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, 1200);
  if (text.length < 8) throw new Error("Describe the avatar you want in a little more detail.");
  return `${style || "streaming mascot"}, one original front-facing head and shoulders avatar, ${text}, centered symmetrical character, both eyes clearly visible, mouth clearly visible, bold clean silhouette, professional game-stream mascot, isolated on a perfectly solid pure white background, no scenery, no text, no logo, no watermark`;
}

function run(exe, cwd, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(exe, args, { cwd, windowsHide: true }); let output = "";
    child.stdout.on("data", (value) => output += value); child.stderr.on("data", (value) => output += value);
    child.once("error", reject); child.once("close", (code) => code === 0 ? resolve(output) : reject(new Error(`Local generator stopped (${code}). ${output.slice(-500)}`)));
  });
}

async function generate(app, appRoot, options) {
  const p = paths(app); if (!state(app).installed) throw new Error("Download the free local AI model first.");
  const output = path.join(p.root, `avatar-${Date.now()}.png`);
  const steps = options.quality === "high" ? 28 : options.quality === "low" ? 12 : 20;
  const common = ["--model", p.model, "--prompt", prompt(options.description, options.style), "--negative-prompt", "background scene, multiple characters, cropped face, hidden eyes, hidden mouth, text, letters, logo, watermark, frame, border, complex background", "--width", "512", "--height", "512", "--steps", String(steps), "--cfg-scale", "7", "--seed", "-1", "--output", output, "--color"];
  const vulkanDir = path.join(appRoot, "native", "windows", "vulkan");
  const cpuDir = path.join(appRoot, "native", "windows", "cpu");
  try { await run(path.join(vulkanDir, "sd-cli.exe"), vulkanDir, [...common, "--backend", "vulkan0", "--auto-fit", "on"]); }
  catch (gpuError) { await run(path.join(cpuDir, "sd-cli.exe"), cpuDir, [...common, "--backend", "cpu", "--threads", String(Math.max(2, require("node:os").availableParallelism() - 1))]); }
  const data = fs.readFileSync(output); try { fs.unlinkSync(output); } catch {}
  return { imageData: `data:image/png;base64,${data.toString("base64")}`, backend: "local" };
}

module.exports = { state, install, generate, MODEL_NAME, MODEL_URL };
