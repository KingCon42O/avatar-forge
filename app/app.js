import { FaceLandmarker, FilesetResolver } from "./vendor/vision_bundle.mjs";

const $ = (selector) => document.querySelector(selector);
const refs = {
  file: $("#file"), upload: $("#upload"), art: $("#art"), avatar: $("#avatar"), camera: $("#camera"), toggle: $("#toggle"),
  status: $("#status"), statusDot: $("#statusDot"), left: $("#leftLid"), right: $("#rightLid"), mouth: $("#mouth"), name: $("#name"), toast: $("#toast")
};
const ranges = { head: $("#head"), blink: $("#blink"), mouth: $("#mouthRange"), smoothing: $("#smoothing") };
let imageData = refs.art.src, frame = 0, stream, tracker, lastVideoTime = -1;
let current = { x: 0, y: 0, rotation: 0, scale: 1, jaw: 0, blinkL: 0, blinkR: 0 };

function rig() { return Object.fromEntries(Object.entries(ranges).map(([key, input]) => [key, Number(input.value)])); }
function showToast(message) { refs.toast.textContent = message; refs.toast.classList.add("show"); setTimeout(() => refs.toast.classList.remove("show"), 2200); }
function syncRanges() { for (const [key, input] of Object.entries(ranges)) { $(`#${key}Out`).textContent = `${input.value}%`; input.addEventListener("input", () => $(`#${key}Out`).textContent = `${input.value}%`); } }
syncRanges();

refs.upload.addEventListener("click", () => refs.file.click());
refs.file.addEventListener("change", () => {
  const file = refs.file.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => { imageData = String(reader.result); refs.art.src = imageData; refs.name.value = file.name.replace(/\.[^.]+$/, ""); showToast("Avatar loaded"); };
  reader.readAsDataURL(file);
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
  refs.left.style.transform = `scaleY(${value.blinkL})`; refs.right.style.transform = `scaleY(${value.blinkR})`; refs.mouth.style.transform = `translateX(-50%) scaleY(${Math.max(.05, value.jaw)})`;
}

async function startCamera() {
  if (stream) { stopCamera(); return; }
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
try { const saved = JSON.parse(localStorage.getItem("avatar-forge-profile")); if (saved) { refs.name.value = saved.name; imageData = saved.image; refs.art.src = imageData; for (const key of Object.keys(ranges)) ranges[key].value = saved.rig[key]; syncRanges(); } } catch {}

function overlayHtml() {
  const config = JSON.stringify({ image: imageData, rig: rig() }).replaceAll("<", "\\u003c");
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent!important}.avatar{position:absolute;right:1.5vw;bottom:1.5vh;width:min(34vw,620px);height:min(72vh,760px);display:flex;align-items:center;justify-content:center;transform-origin:60% 85%;will-change:transform}.avatar img{position:relative;z-index:1;width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 18px 28px rgba(0,0,0,.68))}.lid{position:absolute;z-index:3;width:9%;height:3.5%;top:39%;border-radius:50%;background:#16051f;box-shadow:0 0 8px #9b00ff;transform-origin:center}.left{left:36.6%}.right{right:36.6%}.mouth{position:absolute;z-index:2;left:50%;top:58%;width:8%;height:7%;border-radius:50%;background:#080108;transform-origin:center top}video{display:none}</style></head><body><video id="v" autoplay muted playsinline></video><div class="avatar" id="a"><img id="art"><span class="lid left" id="l"></span><span class="lid right" id="r"></span><span class="mouth" id="m"></span></div><script type="module">import{FaceLandmarker,FilesetResolver}from'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/+esm';const C=${config},v=document.querySelector('#v'),a=document.querySelector('#a'),l=document.querySelector('#l'),r=document.querySelector('#r'),m=document.querySelector('#m');document.querySelector('#art').src=C.image;let c={x:0,y:0,t:0,s:1,j:0,l:0,r:0};try{const f=await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm'),mkr=await FaceLandmarker.createFromOptions(f,{baseOptions:{modelAssetPath:'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'},runningMode:'VIDEO',numFaces:1,outputFaceBlendshapes:true});v.srcObject=await navigator.mediaDevices.getUserMedia({video:true,audio:false});await v.play();let last=-1;function loop(){if(v.currentTime!==last){last=v.currentTime;const z=mkr.detectForVideo(v,performance.now()),p=z.faceLandmarks?.[0];if(p){const L=p[33],R=p[263],N=p[1],q=new Map((z.faceBlendshapes?.[0]?.categories??[]).map(x=>[x.categoryName,x.score])),h=C.rig.head/100,T={x:(.5-N.x)*145*h,y:(N.y-.48)*110*h,t:Math.atan2(R.y-L.y,R.x-L.x)*.8*h,s:Math.max(.9,Math.min(1.1,Math.hypot(R.x-L.x,R.y-L.y)/.255)),j:(q.get('jawOpen')??0)*C.rig.mouth/100,l:(q.get('eyeBlinkLeft')??0)*C.rig.blink/100,r:(q.get('eyeBlinkRight')??0)*C.rig.blink/100},e=.08+(1-C.rig.smoothing/100)*.28;for(const k in c)c[k]+=(T[k]-c[k])*e;a.style.transform='translate('+c.x+'px,'+c.y+'px) rotate('+c.t+'rad) scale('+c.s+')';l.style.transform='scaleY('+c.l+')';r.style.transform='scaleY('+c.r+')';m.style.transform='translateX(-50%) scaleY('+Math.max(.05,c.j)+')'}}requestAnimationFrame(loop)}loop()}catch(e){console.error(e)}</script></body></html>`;
}

function downloadOverlay() {
  const url = URL.createObjectURL(new Blob([overlayHtml()], { type: "text/html" })), anchor = document.createElement("a");
  anchor.href = url; anchor.download = `${(refs.name.value || "avatar").replace(/[^a-z0-9-_]+/gi, "-").toLowerCase()}-obs-overlay.html`; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); showToast("OBS overlay downloaded");
}
$("#download").addEventListener("click", downloadOverlay); $("#downloadSide").addEventListener("click", downloadOverlay);
$("#copy").addEventListener("click", async () => { await navigator.clipboard.writeText("Add a Browser Source in OBS or Streamlabs. Enable Local file, choose the downloaded avatar overlay HTML, and set Width 1920 / Height 1080. Allow camera access and keep the background transparent."); showToast("OBS setup copied"); });
window.addEventListener("beforeunload", stopCamera);
