package com.kingcon42o.avatarforge;

import android.graphics.Bitmap;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AvatarForgeAI")
public class AvatarForgeAIPlugin extends Plugin {
    private static final String MODEL_NAME = "stable-diffusion-v1-5-pruned-emaonly-Q4_0.gguf";
    private static final String MODEL_URL = "https://huggingface.co/second-state/stable-diffusion-v1-5-GGUF/resolve/main/" + MODEL_NAME;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    static { System.loadLibrary("avatar_forge_ai"); }
    private static native byte[] generateNative(String model, String prompt, String negative, int steps);
    private File model() { return new File(getContext().getFilesDir(), MODEL_NAME); }

    @PluginMethod public void getState(PluginCall call) {
        JSObject value = new JSObject(); value.put("installed", model().exists() && model().length() > 1_000_000_000L);
        value.put("modelName", MODEL_NAME); value.put("modelSize", "1.6 GB"); value.put("backend", "On-device ARM CPU"); call.resolve(value);
    }

    @PluginMethod public void install(PluginCall call) {
        executor.execute(() -> {
            File partial = new File(getContext().getFilesDir(), MODEL_NAME + ".part"); long existing = partial.exists() ? partial.length() : 0;
            HttpURLConnection connection = null;
            try {
                connection = (HttpURLConnection)new URL(MODEL_URL).openConnection(); connection.setConnectTimeout(30000); connection.setReadTimeout(30000);
                if (existing > 0) connection.setRequestProperty("Range", "bytes=" + existing + "-"); connection.connect();
                if (connection.getResponseCode() != 200 && connection.getResponseCode() != 206) throw new Exception("Model download failed (" + connection.getResponseCode() + ").");
                long total = existing + connection.getContentLengthLong(), received = existing; byte[] buffer = new byte[1024 * 256]; int read;
                try (InputStream input = connection.getInputStream(); FileOutputStream output = new FileOutputStream(partial, existing > 0)) {
                    while ((read = input.read(buffer)) >= 0) { output.write(buffer, 0, read); received += read;
                        JSObject progress = new JSObject(); progress.put("received", received); progress.put("total", total); progress.put("percent", total > 0 ? Math.round(received * 100f / total) : 0); notifyListeners("progress", progress); }
                }
                if (partial.length() < 1_000_000_000L) throw new Exception("Download incomplete. Press Download again to resume.");
                if (!partial.renameTo(model())) throw new Exception("Could not finish installing the model.");
                JSObject result = new JSObject(); result.put("installed", true); result.put("backend", "On-device ARM CPU"); call.resolve(result);
            } catch (Exception error) { call.reject(error.getMessage(), error); } finally { if (connection != null) connection.disconnect(); }
        });
    }

    private String prompt(String description, String style) throws Exception {
        description = description == null ? "" : description.replaceAll("[\\x00-\\x1F\\x7F]", " ").trim();
        if (description.length() < 8) throw new Exception("Describe the avatar you want in a little more detail.");
        return style + ", one original front-facing head and shoulders avatar, " + description + ", centered symmetrical character, both eyes clearly visible, mouth clearly visible, bold clean silhouette, professional game-stream mascot, isolated on a perfectly solid pure white background, no scenery, no text, no logo, no watermark";
    }

    @PluginMethod public void generate(PluginCall call) {
        executor.execute(() -> { try {
            if (!model().exists()) throw new Exception("Download the free local AI model first.");
            int steps = "high".equals(call.getString("quality")) ? 28 : "low".equals(call.getString("quality")) ? 12 : 20;
            byte[] rgb = generateNative(model().getAbsolutePath(), prompt(call.getString("description", ""), call.getString("style", "streaming mascot")), "background scene, multiple characters, cropped face, hidden eyes, hidden mouth, text, logo, watermark, frame", steps);
            if (rgb == null || rgb.length != 512 * 512 * 3) throw new Exception("The local generator could not create an image. Close other apps and try again.");
            int[] pixels = new int[512 * 512]; for (int i = 0, j = 0; i < pixels.length; i++, j += 3) pixels[i] = 0xff000000 | ((rgb[j] & 255) << 16) | ((rgb[j + 1] & 255) << 8) | (rgb[j + 2] & 255);
            Bitmap bitmap = Bitmap.createBitmap(pixels, 512, 512, Bitmap.Config.ARGB_8888); ByteArrayOutputStream output = new ByteArrayOutputStream(); bitmap.compress(Bitmap.CompressFormat.PNG, 100, output); bitmap.recycle();
            JSObject result = new JSObject(); result.put("ok", true); result.put("imageData", "data:image/png;base64," + Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)); result.put("backend", "local"); call.resolve(result);
        } catch (Exception error) { JSObject result = new JSObject(); result.put("ok", false); result.put("error", error.getMessage()); call.resolve(result); } });
    }
}
