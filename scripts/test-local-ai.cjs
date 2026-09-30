const assert = require("node:assert/strict");
const localAI = require("../local-ai.cjs");
assert.equal(localAI.MODEL_NAME.endsWith("Q4_0.gguf"), true);
assert.equal(localAI.MODEL_URL.startsWith("https://huggingface.co/"), true);
console.log("Local AI configuration contract passed.");
