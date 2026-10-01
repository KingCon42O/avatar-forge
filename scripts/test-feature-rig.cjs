const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const html = fs.readFileSync(path.join(root, "app", "index.html"), "utf8");
const script = fs.readFileSync(path.join(root, "app", "app.js"), "utf8");
const features = ["leftEye", "rightEye", "mouth"];

for (const feature of features) {
  for (const property of ["X", "Y", "Width", "Height", "Shape"]) {
    const key = `${feature}${property}`;
    assert.match(html, new RegExp(`id=["']${key}["']`), `Missing ${key} control`);
    assert.match(script, new RegExp(`\\b${key}\\b`), `Missing ${key} rig binding`);
  }
}
assert.match(script, /JSON\.stringify\(\{ image: imageData, rig: rig\(\) \}\)/, "Overlay must serialize the rig");
assert.match(script, /F\(l,'leftEye'/, "Overlay must position the left eye");
assert.match(script, /F\(r,'rightEye'/, "Overlay must position the right eye");
assert.match(script, /F\(m,'mouth'/, "Overlay must position the mouth");
assert.match(script, /bindFeatureDrag\(refs\.left, "leftEye"\)/, "Left eye must support direct dragging");
assert.match(script, /bindFeatureDrag\(refs\.right, "rightEye"\)/, "Right eye must support direct dragging");
assert.match(script, /bindFeatureDrag\(refs\.mouth, "mouth"\)/, "Mouth must support direct dragging");
assert.match(html, /id="matchEyes"/, "Missing match-eye-size control");
assert.match(script, /rightEye\$\{property\}/, "Eye matching must synchronize dimensions");
console.log("Independent feature rig contract passed.");
