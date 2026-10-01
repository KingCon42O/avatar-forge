import { FaceLandmarker, FilesetResolver } from "./vendor/vision_bundle.mjs";

const $ = (selector) => document.querySelector(selector);
const refs = {
  file: $("#file"), upload: $("#upload"), art: $("#art"), avatar: $("#avatar"), camera: $("#camera"), toggle: $("#toggle"),
  status: $("#status"), statusDot: $("#statusDot"), left: $("#leftLid"), right: $("#rightLid"), mouth: $("#mouth"), arrange: $("#arrangeFeatures"), name: $("#name"), toast: $("#toast"),
  aiCard: $(".ai-card"), aiPrompt: $("#aiPrompt"), aiStyle: $("#aiStyle"), aiQuality: $("#aiQuality"), aiStatus: $("#aiStatus"), generateAi: $("#generateAi"), downloadPng: $("#downloadPng")
};
const ranges = {
  background: $("#background"), head: $("#head"), blink: $("#blink"), mouth: $("#mouthRange"), smoothing: $("#smoothing"),
  leftEyeX: $("#leftEyeX"), leftEyeY: $("#leftEyeY"), leftEyeWidth: $("#leftEyeWidth"), leftEyeHeight: $("#leftEyeHeight"), leftEyeShape: $("#leftEyeShape"),
  rightEyeX: $("#rightEyeX"), rightEyeY: $("#rightEyeY"), rightEyeWidth: $("#rightEyeWidth"), rightEyeHeight: $("#rightEyeHeight"), rightEyeShape: $("#rightEyeShape"),
  mouthX: $("#mouthX"), mouthY: $("#mouthY"), mouthWidth: $("#mouthWidth"), mouthHeight: $("#mouthHeight"), mouthShape: $("#mouthShape")
};
const featureDefaults = { leftEyeX: 41, leftEyeY: 41, leftEyeWidth: 9, leftEyeHeight: 4, leftEyeShape: 100, rightEyeX: 59, rightEyeY: 41, rightEyeWidth: 9, rightEyeHeight: 4, rightEyeShape: 100, mouthX: 50, mouthY: 62, mouthWidth: 8, mouthHeight: 7, mouthShape: 100 };
let featurePreviewTimer;
let arrangingFeatures = false;
let imageData = refs.art.src, frame = 0, stream, tracker, lastVideoTime = -1, sourceFile, backgroundTimer;
let current = { x: 0, y: 0, rotation: 0, scale: 1, jaw: 0, blinkL: 0, blinkR: 0 };

function rig() { return Object.fromEntries(Object.entries(ranges).map(([key, input]) => [key, Number(input.value)])); }
function showToast(message) { refs.toast.textContent = message; refs.toast.classList.add("show"); setTimeout(() => refs.toast.classList.remove("show"), 2200); }
function applyFeatureLayout() {
  const value = rig(), apply = (element, prefix) => {
    element.style.left = `${value[`${prefix}X`]}%`; element.style.top = `${value[`${prefix}Y`]}%`;
    element.style.width = `${value[`${prefix}Width`]}%`; element.style.height = `${value[`${prefix}Height`]}%`;
    element.style.borderRadius = `${value[`${prefix}Shape`] / 2}%`;
  };
  apply(refs.left, "leftEye"); apply(refs.right, "rightEye"); apply(refs.mouth, "mouth"); render(current);
}
function previewFeature(key) {
  const element = key.startsWith("leftEye") ? refs.left : key.startsWith("rightEye") ? refs.right : refs.mouth;
  refs.left.classList.remove("feature-preview"); refs.right.classList.remove("feature-preview"); refs.mouth.classList.remove("feature-preview");
  element.classList.add("feature-preview"); clearTimeout(featurePreviewTimer);
  featurePreviewTimer = setTimeout(() => { element.classList.remove("feature-preview"); render(current); }, 900);
}
function syncRanges() { for (const [key, input] of Object.entries(ranges)) { const output = $(`#${key}Out`); if (output) output.textContent = `${input.value}%`; input.oninput = () => { if (output) output.textContent = `${input.value}%`; if (key in featureDefaults) { applyFeatureLayout(); previewFeature(key); } }; } }
syncRanges();
applyFeatureLayout();
$("#resetFeatures").addEventListener("click", () => { for (const [key, value] of Object.entries(featureDefaults)) ranges[key].value = value; syncRanges(); applyFeatureLayout(); showToast("Feature placement reset"); });

function setArrangeMode(enabled) {
  arrangingFeatures = enabled;
  if (enabled && stream) stopCamera();
  refs.avatar.classList.toggle("arranging", enabled); refs.arrange.classList.toggle("active", enabled);
  refs.arrange.textContent = enabled ? "✓ Done arranging" : "✥ Arrange face";
  refs.status.textContent = enabled ? "Drag either eye or the mouth directly on the avatar" : "Preview ready";
  if (!enabled) { refs.left.classList.remove("dragging"); refs.right.classList.remove("dragging"); refs.mouth.classList.remove("dragging"); render(current); }
}

function bindFeatureDrag(element, prefix) {
  let pointerId;
  const move = (event) => {
    if (!arrangingFeatures || event.pointerId !== pointerId) return;
    const bounds = refs.avatar.getBoundingClientRect();
    ranges[`${prefix}X`].value = Math.round(Math.max(0, Math.min(100, (event.clientX - bounds.left) / bounds.width * 100)));
    ranges[`${prefix}Y`].value = Math.round(Math.max(0, Math.min(100, (event.clientY - bounds.top) / bounds.height * 100)));
    applyFeatureLayout(); refs.status.textContent = `${element.getAttribute("aria-label")}: ${ranges[`${prefix}X`].value}% across, ${ranges[`${prefix}Y`].value}% down`;
  };
  element.addEventListener("pointerdown", (event) => { if (!arrangingFeatures) return; event.preventDefault(); pointerId = event.pointerId; element.setPointerCapture(pointerId); element.classList.add("dragging"); move(event); });
  element.addEventListener("pointermove", move);
  const finish = (event) => { if (event.pointerId !== pointerId) return; element.classList.remove("dragging"); pointerId = undefined; refs.status.textContent = "Drag another feature or press Done arranging"; };
  element.addEventListener("pointerup", finish); element.addEventListener("pointercancel", finish);
}
bindFeatureDrag(refs.left, "leftEye"); bindFeatureDrag(refs.right, "rightEye"); bindFeatureDrag(refs.mouth, "mouth");
refs.arrange.addEventListener("click", () => setArrangeMode(!arrangingFeatures));

refs.upload.addEventListener("click", () => refs.file.click());
refs.file.addEventListener("change", async () => {
  sourceFile = refs.file.files?.[0]; if (!sourceFile) return;
  refs.name.value = sourceFile.name.replace(/\.[^.]+$/, "");
  await processAvatar(sourceFile);
});

const capacitorAi = window.Capacitor?.Plugins?.AvatarForgeAI;
const aiBridge = window.avatarForgeAI || (capacitorAi ? {
  getState: () => capacitorAi.getState(),
  install: () => capacitorAi.install(),
  onProgress: (callback) => capacitorAi.addListener("progress", callback),
  generate: (options) => capacitorAi.generate(options)
} : undefined);
let aiInstalled = false;

async function refreshAiState() {
  if (!aiBridge) {
    refs.generateAi.disabled = true;
    refs.aiStatus.textContent = "AI creation is not available on this device yet.";
    return;
  }
  const state = await aiBridge.getState(); aiInstalled = state.installed;
  refs.generateAi.textContent = aiInstalled ? "Create PNG locally" : "Download local AI";
  refs.aiStatus.textContent = aiInstalled ? `${state.backend || "On-device AI"} ready. No key, fees, or account.` : `One-time ${state.modelSize || "model"} download required.`;
}

aiBridge?.onProgress?.((value) => { refs.aiStatus.textContent = `Downloading local AI: ${value.percent}% (${Math.round(value.received / 1048576)} MB)`; });

refs.generateAi.addEventListener("click", async () => {
  if (!aiBridge) return;
  if (!aiInstalled) {
    refs.generateAi.disabled = true; refs.aiStatus.textContent = "Starting the one-time local AI download…";
    try { await aiBridge.install(); aiInstalled = true; await refreshAiState(); showToast("Local AI installed"); }
    catch (error) { refs.aiStatus.textContent = error.message || "Model download failed. Press again to resume."; }
    finally { refs.generateAi.disabled = false; }
    return;
  }
  const description = refs.aiPrompt.value.trim();
  if (description.length < 8) { refs.aiStatus.textContent = "Describe your avatar in a little more detail."; refs.aiPrompt.focus(); return; }
  refs.aiCard.classList.add("generating"); refs.status.textContent = "AI is creating a transparent PNG…"; refs.aiStatus.textContent = "Generating—complex avatars can take up to two minutes.";
  try {
    const result = await aiBridge.generate({ description, style: refs.aiStyle.value, quality: refs.aiQuality.value });
    if (!result.ok) throw new Error(result.error);
    const raw = await (await fetch(result.imageData)).blob();
    imageData = await transparentPng(new File([raw], "local-ai-avatar.png", { type: "image/png" })); sourceFile = undefined; refs.art.src = imageData;
    refs.name.value = description.slice(0, 52); refs.downloadPng.disabled = false;
    refs.status.textContent = "AI transparent PNG ready"; refs.aiStatus.textContent = "Ready—transparent PNG imported into the live avatar rig."; showToast("AI avatar created and imported");
  } catch (error) {
    refs.status.textContent = "AI generation unavailable"; refs.aiStatus.textContent = error.message || "Avatar generation failed."; showToast("Could not create the avatar");
  } finally { refs.aiCard.classList.remove("generating"); }
});

refs.downloadPng.addEventListener("click", () => {
  if (!imageData.startsWith("data:image/png")) return;
  const anchor = document.createElement("a"); anchor.href = imageData;
  anchor.download = `${(refs.name.value || "ai-avatar").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()}-transparent.png`; anchor.click();
  showToast("Transparent PNG downloaded");
});

refreshAiState().catch((error) => { refs.aiStatus.textContent = `AI setup unavailable: ${error.message}`; });

function colorDistance(data, offset, background) {
  return Math.hypot(data[offset] - background.r, data[offset + 1] - background.g, data[offset + 2] - background.b);
}

function dominantBorderColor(data, width, height) {
  const bins = new Map(), samples = [], step = Math.max(1, Math.floor(Math.min(width, height) / 160));
  const add = (x, y) => {
    const offset = (y * width + x) * 4;
    if (data[offset + 3] < 220) return;
    const key = `${data[offset] >> 4},${data[offset + 1] >> 4},${data[offset + 2] >> 4}`;
    const sample = { r: data[offset], g: data[offset + 1], b: data[offset + 2] };
    samples.push({ key, ...sample }); bins.set(key, (bins.get(key) ?? 0) + 1);
  };
  for (let x = 0; x < width; x += step) { add(x, 0); add(x, height - 1); }
  for (let y = step; y < height - step; y += step) { add(0, y); add(width - 1, y); }
  const winner = [...bins].sort((a, b) => b[1] - a[1])[0]?.[0];
  const selected = samples.filter((sample) => sample.key === winner);
  if (!selected.length) return { r: 255, g: 255, b: 255 };
  return selected.reduce((sum, sample) => ({ r: sum.r + sample.r / selected.length, g: sum.g + sample.g / selected.length, b: sum.b + sample.b / selected.length }), { r: 0, g: 0, b: 0 });
}

async function transparentPng(file) {
  const bitmap = await createImageBitmap(file), maxSize = 2048, scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale)), height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true }); context.drawImage(bitmap, 0, 0, width, height); bitmap.close();
  const pixels = context.getImageData(0, 0, width, height), data = pixels.data, total = width * height;
  let transparentPixels = 0;
  for (let offset = 3; offset < data.length; offset += 4) if (data[offset] < 245) transparentPixels++;
  if (transparentPixels / total < .005) {
    const background = dominantBorderColor(data, width, height), strength = Number(ranges.background.value), threshold = 18 + strength * .62, feather = 10 + strength * .3;
    const visited = new Uint8Array(total), queue = new Int32Array(total); let start = 0, end = 0;
    const enqueue = (index) => {
      if (index < 0 || index >= total || visited[index]) return;
      const offset = index * 4;
      if (colorDistance(data, offset, background) > threshold + feather) return;
      visited[index] = 1; queue[end++] = index;
    };
    for (let x = 0; x < width; x++) { enqueue(x); enqueue((height - 1) * width + x); }
    for (let y = 1; y < height - 1; y++) { enqueue(y * width); enqueue(y * width + width - 1); }
    while (start < end) {
      const index = queue[start++], offset = index * 4, distance = colorDistance(data, offset, background);
      data[offset + 3] = distance <= threshold ? 0 : Math.round(data[offset + 3] * Math.min(1, (distance - threshold) / feather));
      const x = index % width;
      if (x) enqueue(index - 1); if (x < width - 1) enqueue(index + 1); if (index >= width) enqueue(index - width); if (index < total - width) enqueue(index + width);
    }
    context.putImageData(pixels, 0, 0);
  }
  return canvas.toDataURL("image/png");
}

async function processAvatar(file) {
  refs.upload.classList.add("processing"); refs.status.textContent = "Creating transparent PNG…";
  try {
    imageData = await transparentPng(file); refs.art.src = imageData; refs.status.textContent = "Transparent PNG ready"; showToast("Background removed — transparent PNG ready");
  } catch (error) {
    const reader = new FileReader(); imageData = await new Promise((resolve, reject) => { reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); });
    refs.art.src = imageData; refs.status.textContent = "Avatar loaded"; showToast("Avatar loaded; background removal was unavailable"); console.error(error);
  } finally { refs.upload.classList.remove("processing"); }
}

ranges.background.addEventListener("input", () => {
  clearTimeout(backgroundTimer);
  if (sourceFile) backgroundTimer = setTimeout(() => processAvatar(sourceFile), 280);
});

async function prepareTracker() {
  if (tracker) return tracker;
  refs.status.textContent = "Loading face tracker…";
  const vision = await FilesetResolver.forVisionTasks("./vendor/wasm");
  tracker = await FaceLandmarker.createFromOptions(vision, {
    baseOptions: { modelAssetPath: "./vendor/face_landmarker.task", delegate: "CPU" }, runningMode: "VIDEO", numFaces: 1,
    outputFaceBlendshapes: true, minFaceDetectionConfidence: .35, minFacePresenceConfidence: .35, minTrackingConfidence: .35,
  });
  return tracker;
}

function stopCamera() {
  cancelAnimationFrame(frame); frame = 0; stream?.getTracks().forEach((track) => track.stop()); stream = null; refs.camera.srcObject = null;
  refs.toggle.textContent = "▶ Start camera tracking"; refs.toggle.classList.remove("active"); refs.statusDot.classList.remove("live"); refs.status.textContent = "Preview ready";
  current = { x: 0, y: 0, rotation: 0, scale: 1, jaw: 0, blinkL: 0, blinkR: 0 }; render(current);
}

function render(value) {
  refs.avatar.style.transform = `translate(calc(-50% + ${value.x}px),calc(-50% + ${value.y}px)) rotate(${value.rotation}rad) scale(${value.scale})`;
  refs.left.style.transform = `translate(-50%,-50%) scaleY(${value.blinkL})`; refs.right.style.transform = `translate(-50%,-50%) scaleY(${value.blinkR})`; refs.mouth.style.transform = `translate(-50%,-50%) scaleY(${Math.max(.05, value.jaw)})`;
}

async function startCamera() {
  if (stream) { stopCamera(); return; }
  if (arrangingFeatures) setArrangeMode(false);
  try {
    await prepareTracker();
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: 1280, height: 720, facingMode: "user" }, audio: false });
    refs.camera.srcObject = stream; await refs.camera.play(); refs.toggle.textContent = "■ Stop camera"; refs.toggle.classList.add("active"); refs.statusDot.classList.add("live"); refs.status.textContent = "Camera tracking live";
    const loop = () => {
      if (refs.camera.currentTime !== lastVideoTime) {
        lastVideoTime = refs.camera.currentTime;
        const result = tracker.detectForVideo(refs.camera, performance.now()), points = result.faceLandmarks?.[0];
        if (points) {
          const left = points[33], right = points[263], nose = points[1], scores = new Map((result.faceBlendshapes?.[0]?.categories ?? []).map((item) => [item.categoryName, item.score])), settings = rig(), strength = settings.head / 100;
          const target = { x: (.5 - nose.x) * 145 * strength, y: (nose.y - .48) * 110 * strength, rotation: Math.atan2(right.y - left.y, right.x - left.x) * .8 * strength, scale: Math.max(.9, Math.min(1.1, Math.hypot(right.x - left.x, right.y - left.y) / .255)), jaw: (scores.get("jawOpen") ?? 0) * settings.mouth / 100, blinkL: (scores.get("eyeBlinkLeft") ?? 0) * settings.blink / 100, blinkR: (scores.get("eyeBlinkRight") ?? 0) * settings.blink / 100 };
          const speed = .08 + (1 - settings.smoothing / 100) * .28;
          for (const key of Object.keys(current)) current[key] += (target[key] - current[key]) * speed;
          render(current);
        }
      }
      frame = requestAnimationFrame(loop);
    };
    loop();
  } catch (error) { stopCamera(); refs.status.textContent = "Camera unavailable"; showToast("Camera could not start. Check Windows privacy settings."); console.error(error); }
}
refs.toggle.addEventListener("click", startCamera);

function saveAvatar() {
  localStorage.setItem("avatar-forge-profile", JSON.stringify({ name: refs.name.value, image: imageData, rig: rig() })); showToast("Avatar saved on this computer");
}
$("#save").addEventListener("click", saveAvatar);
try { const saved = JSON.parse(localStorage.getItem("avatar-forge-profile")); if (saved) { refs.name.value = saved.name; imageData = saved.image; refs.art.src = imageData; for (const key of Object.keys(ranges)) if (saved.rig[key] !== undefined) ranges[key].value = saved.rig[key]; syncRanges(); applyFeatureLayout(); } } catch {}

function overlayHtml() {
  const config = JSON.stringify({ image: imageData, rig: rig() }).replaceAll("<", "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent!important}.avatar{position:absolute;right:1.5vw;bottom:1.5vh;width:min(34vw,620px);height:min(72vh,760px);display:flex;align-items:center;justify-content:center;transform-origin:60% 85%;will-change:transform}.avatar img{position:relative;z-index:1;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 18px 28px rgba(0,0,0,.68))}.lid{position:absolute;z-index:3;background:#16051f;box-shadow:0 0 8px #9b00ff;transform-origin:center}.mouth{position:absolute;z-index:2;background:#080108;transform-origin:center}video{display:none}</style></head><body><video id="v" autoplay muted playsinline></video><div class="avatar" id="a"><img id="art"><span class="lid" id="l"></span><span class="lid" id="r"></span><span class="mouth" id="m"></span></div><script type="module">import{FaceLandmarker,FilesetResolver}from'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/+esm';const C=${config},v=document.querySelector('#v'),a=document.querySelector('#a'),l=document.querySelector('#l'),r=document.querySelector('#r'),m=document.querySelector('#m'),F=(e,p,d)=>{e.style.left=(C.rig[p+'X']??d[0])+'%';e.style.top=(C.rig[p+'Y']??d[1])+'%';e.style.width=(C.rig[p+'Width']??d[2])+'%';e.style.height=(C.rig[p+'Height']??d[3])+'%';e.style.borderRadius=((C.rig[p+'Shape']??100)/2)+'%'};document.querySelector('#art').src=C.image;F(l,'leftEye',[41,41,9,4]);F(r,'rightEye',[59,41,9,4]);F(m,'mouth',[50,62,8,7]);let c={x:0,y:0,t:0,s:1,j:0,l:0,r:0};try{const f=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'),mkr=await FaceLandmarker.createFromOptions(f,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'},runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:true});v.srcObject=await navigator.mediaDevices.getUserMedia({video:true,audio:false});await v.play();let last=-1;function loop(){if(v.currentTime!==last){last=v.currentTime;const z=mkr.detectForVideo(v,performance.now()),p=z.faceLandmarks?.[0];if(p){const L=p[33],R=p[263],N=p[1],q=new Map((z.faceBlendshapes?.[0]?.categories??[]).map(x=>[x.categoryName,x.score])),h=C.rig.head/100,T={x:(.5-N.x)*145*h,y:(N.y-.48)*110*h,t:Math.atan2(R.y-L.y,R.x-L.x)*.8*h,s:Math.max(.9,Math.min(1.1,Math.hypot(R.x-L.x,R.y-L.y)/.255)),j:(q.get('jawOpen')??0)*C.rig.mouth/100,l:(q.get('eyeBlinkLeft')??0)*C.rig.blink/100,r:(q.get('eyeBlinkRight')??0)*C.rig.blink/100},e=.08+(1-C.rig.smoothing/100)*.28;for(const k in c)c[k]+=(T[k]-c[k])*e;a.style.transform='translate('+c.x+'px,'+c.y+'px) rotate('+c.t+'rad) scale('+c.s+')';l.style.transform='translate(-50%,-50%) scaleY('+c.l+')';r.style.transform='translate(-50%,-50%) scaleY('+c.r+')';m.style.transform='translate(-50%,-50%) scaleY('+Math.max(.05,c.j)+')'}}requestAnimationFrame(loop)}loop()}catch(e){console.error(e)}</script></body></html>`;
}

function downloadOverlay() {
  const url = URL.createObjectURL(new Blob([overlayHtml()], { type: "text/html" })), anchor = document.createElement("a");
  anchor.href = url; anchor.download = `${(refs.name.value || "avatar").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()}-obs-overlay.html`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); showToast("OBS overlay downloaded");
}
$("#download").addEventListener("click", downloadOverlay); $("#downloadSide").addEventListener("click", downloadOverlay);
$("#copy").addEventListener("click", async () => { await navigator.clipboard.writeText("Add a Browser Source in OBS or Streamlabs. Enable Local file, choose the downloaded avatar overlay HTML, and set Width 1920 / Height 1080. Allow camera access and keep the background transparent."); showToast("OBS setup copied"); });
window.addEventListener("beforeunload", stopCamera);
