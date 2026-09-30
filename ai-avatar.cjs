const OPENAI_IMAGES_URL = "https://api.openai.com/v1/images/generations";
const MODEL = "gpt-image-2.5-flare";
const STYLES = new Set(["streaming mascot", "anime", "cartoon", "fantasy", "cyberpunk", "clean vector"]);
const QUALITIES = new Set(["low", "medium", "high"]);

function cleanText(value, maximum) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function buildAvatarPrompt(description, style) {
  const safeDescription = cleanText(description, 1800);
  if (safeDescription.length < 8) throw new Error("Describe the avatar you want in a little more detail.");
  const safeStyle = STYLES.has(style) ? style : "streaming mascot";
  return [
    `Draw one original ${safeStyle} avatar character based on this description: ${safeDescription}`,
    "Create a polished, front-facing head-and-shoulders streaming avatar, centered and symmetrical.",
    "Keep both eyes clearly visible near 39% of the canvas height and the mouth clearly visible near 58% so face tracking can animate them.",
    "Do not place hair, masks, props, text, logos, watermarks, borders, scenery, shadows, glow fields, or checkerboard patterns over or behind the character.",
    "The character must be the only visible subject, with generous transparent padding and clean alpha edges.",
    "Output a true RGBA PNG on a fully transparent background."
  ].join("\n");
}

function validateTransparentPng(base64) {
  const bytes = Buffer.from(base64, "base64");
  const signature = bytes.subarray(0, 8).toString("hex");
  if (signature !== "89504e470d0a1a0a" || bytes.length < 33) throw new Error("The image service did not return a valid PNG.");
  const colorType = bytes[25];
  if (colorType !== 4 && colorType !== 6) throw new Error("The generated PNG did not contain an alpha channel. Please generate again.");
  return bytes;
}

async function generateTransparentAvatar({ apiKey, description, style, quality, fetchImpl = fetch }) {
  if (!apiKey) throw new Error("Add your OpenAI API key before generating an avatar.");
  const safeQuality = QUALITIES.has(quality) ? quality : "medium";
  const response = await fetchImpl(OPENAI_IMAGES_URL, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      prompt: buildAvatarPrompt(description, style),
      size: "1024x1024",
      quality: safeQuality,
      background: "transparent",
      output_format: "png",
      n: 1
    }),
    signal: AbortSignal.timeout(180000)
  });
  const requestId = response.headers?.get?.("x-request-id") || "";
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = cleanText(payload?.error?.message, 300) || `Image generation failed (${response.status}).`;
    const error = new Error(message);
    error.requestId = requestId;
    throw error;
  }
  const base64 = payload?.data?.[0]?.b64_json;
  if (!base64) throw new Error("The image service returned no image.");
  validateTransparentPng(base64);
  return { imageData: `data:image/png;base64,${base64}`, revisedPrompt: cleanText(payload.data[0].revised_prompt, 1000), requestId };
}

module.exports = { MODEL, buildAvatarPrompt, generateTransparentAvatar, validateTransparentPng };
