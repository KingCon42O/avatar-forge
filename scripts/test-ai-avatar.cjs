const assert = require("node:assert/strict");
const { buildAvatarPrompt, generateTransparentAvatar, validateTransparentPng } = require("../ai-avatar.cjs");

const pngWithAlpha = Buffer.alloc(33);
Buffer.from("89504e470d0a1a0a", "hex").copy(pngWithAlpha);
pngWithAlpha.writeUInt32BE(13, 8);
pngWithAlpha.write("IHDR", 12, "ascii");
pngWithAlpha[25] = 6;
const encoded = pngWithAlpha.toString("base64");

assert.match(buildAvatarPrompt("a crowned purple lion", "fantasy"), /fully transparent background/i);
assert.throws(() => validateTransparentPng(Buffer.from("not png").toString("base64")), /valid PNG/);

(async () => {
  let request;
  const result = await generateTransparentAvatar({
    apiKey: "sk-test-key-long-enough-for-validation",
    description: "a friendly crowned purple lion",
    style: "fantasy",
    quality: "medium",
    fetchImpl: async (_url, options) => {
      request = JSON.parse(options.body);
      return { ok: true, headers: { get: () => "test-request" }, json: async () => ({ data: [{ b64_json: encoded }] }) };
    }
  });
  assert.equal(request.background, "transparent");
  assert.equal(request.output_format, "png");
  assert.equal(request.n, 1);
  assert.match(result.imageData, /^data:image\/png;base64,/);
  console.log("AI avatar generation contract passed.");
})().catch((error) => { console.error(error); process.exitCode = 1; });
