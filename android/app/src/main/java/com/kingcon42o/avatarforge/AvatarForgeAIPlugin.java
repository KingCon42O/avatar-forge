package com.kingcon42o.avatarforge;

import android.content.Context;
import android.content.SharedPreferences;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

@CapacitorPlugin(name = "AvatarForgeAI")
public class AvatarForgeAIPlugin extends Plugin {
    private static final String KEY_ALIAS = "avatar-forge-openai-key";
    private static final String PREFS = "avatar-forge-secure";
    private static final String MODEL = "gpt-image-2.5-flare";
    private static final Set<String> STYLES = new HashSet<>(Arrays.asList("streaming mascot", "anime", "cartoon", "fantasy", "cyberpunk", "clean vector"));
    private static final Set<String> QUALITIES = new HashSet<>(Arrays.asList("low", "medium", "high"));
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private SharedPreferences preferences() {
        return getContext().getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    private SecretKey encryptionKey() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (!store.containsAlias(KEY_ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(KEY_ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .build());
            generator.generateKey();
        }
        return (SecretKey) store.getKey(KEY_ALIAS, null);
    }

    private void storeKey(String key) throws Exception {
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.ENCRYPT_MODE, encryptionKey());
        preferences().edit()
            .putString("key", Base64.encodeToString(cipher.doFinal(key.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP))
            .putString("iv", Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP))
            .apply();
    }

    private String loadKey() throws Exception {
        String encrypted = preferences().getString("key", "");
        String iv = preferences().getString("iv", "");
        if (encrypted.isEmpty() || iv.isEmpty()) return "";
        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
        cipher.init(Cipher.DECRYPT_MODE, encryptionKey(), new GCMParameterSpec(128, Base64.decode(iv, Base64.NO_WRAP)));
        return new String(cipher.doFinal(Base64.decode(encrypted, Base64.NO_WRAP)), StandardCharsets.UTF_8);
    }

    @PluginMethod
    public void getKeyState(PluginCall call) {
        JSObject result = new JSObject();
        try { result.put("configured", !loadKey().isEmpty()); }
        catch (Exception ignored) { result.put("configured", false); }
        result.put("persistent", true);
        call.resolve(result);
    }

    @PluginMethod
    public void saveKey(PluginCall call) {
        String key = call.getString("key", "").trim();
        if (!key.startsWith("sk-") || key.length() < 20 || key.length() > 300) { call.reject("Enter a valid OpenAI API key."); return; }
        try {
            storeKey(key);
            JSObject result = new JSObject(); result.put("configured", true); result.put("persistent", true); call.resolve(result);
        } catch (Exception error) { call.reject("Android could not encrypt the API key."); }
    }

    @PluginMethod
    public void clearKey(PluginCall call) {
        preferences().edit().clear().apply();
        try {
            KeyStore store = KeyStore.getInstance("AndroidKeyStore"); store.load(null);
            if (store.containsAlias(KEY_ALIAS)) store.deleteEntry(KEY_ALIAS);
        } catch (Exception ignored) {}
        JSObject result = new JSObject(); result.put("configured", false); result.put("persistent", true); call.resolve(result);
    }

    private String clean(String value, int maximum) {
        if (value == null) return "";
        String cleaned = value.replaceAll("[\\x00-\\x1F\\x7F]", " ").replaceAll("\\s+", " ").trim();
        return cleaned.substring(0, Math.min(cleaned.length(), maximum));
    }

    private String prompt(String description, String style) throws Exception {
        description = clean(description, 1800);
        if (description.length() < 8) throw new Exception("Describe the avatar you want in a little more detail.");
        if (!STYLES.contains(style)) style = "streaming mascot";
        return "Draw one original " + style + " avatar character based on this description: " + description + "\n" +
            "Create a polished, front-facing head-and-shoulders streaming avatar, centered and symmetrical.\n" +
            "Keep both eyes clearly visible near 39% of the canvas height and the mouth clearly visible near 58% so face tracking can animate them.\n" +
            "Do not place hair, masks, props, text, logos, watermarks, borders, scenery, shadows, glow fields, or checkerboard patterns over or behind the character.\n" +
            "The character must be the only visible subject, with generous transparent padding and clean alpha edges.\n" +
            "Output a true RGBA PNG on a fully transparent background.";
    }

    private String read(InputStream stream) throws Exception {
        StringBuilder result = new StringBuilder();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))) {
            String line; while ((line = reader.readLine()) != null) result.append(line);
        }
        return result.toString();
    }

    private void verifyPng(String base64) throws Exception {
        byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
        byte[] signature = {(byte)0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a};
        if (bytes.length < 33) throw new Exception("The image service did not return a valid PNG.");
        for (int index = 0; index < signature.length; index++) if (bytes[index] != signature[index]) throw new Exception("The image service did not return a valid PNG.");
        int colorType = bytes[25] & 0xff;
        if (colorType != 4 && colorType != 6) throw new Exception("The generated PNG did not contain an alpha channel. Please generate again.");
    }

    @PluginMethod
    public void generate(PluginCall call) {
        executor.execute(() -> {
            HttpURLConnection connection = null;
            try {
                String key = loadKey();
                if (key.isEmpty()) throw new Exception("Add your OpenAI API key before generating an avatar.");
                String quality = call.getString("quality", "medium");
                if (!QUALITIES.contains(quality)) quality = "medium";
                JSONObject request = new JSONObject();
                request.put("model", MODEL);
                request.put("prompt", prompt(call.getString("description", ""), call.getString("style", "streaming mascot")));
                request.put("size", "1024x1024"); request.put("quality", quality); request.put("background", "transparent"); request.put("output_format", "png"); request.put("n", 1);

                connection = (HttpURLConnection) new URL("https://api.openai.com/v1/images/generations").openConnection();
                connection.setRequestMethod("POST"); connection.setConnectTimeout(30000); connection.setReadTimeout(180000); connection.setDoOutput(true);
                connection.setRequestProperty("Authorization", "Bearer " + key); connection.setRequestProperty("Content-Type", "application/json");
                try (OutputStream output = connection.getOutputStream()) { output.write(request.toString().getBytes(StandardCharsets.UTF_8)); }
                int status = connection.getResponseCode();
                String body = read(status >= 200 && status < 300 ? connection.getInputStream() : connection.getErrorStream());
                JSONObject response = new JSONObject(body);
                if (status < 200 || status >= 300) {
                    String message = response.optJSONObject("error") != null ? response.optJSONObject("error").optString("message", "") : "";
                    throw new Exception(clean(message, 300).isEmpty() ? "Image generation failed (" + status + ")." : clean(message, 300));
                }
                JSONArray data = response.optJSONArray("data");
                String base64 = data != null && data.length() > 0 ? data.getJSONObject(0).optString("b64_json", "") : "";
                if (base64.isEmpty()) throw new Exception("The image service returned no image.");
                verifyPng(base64);
                JSObject result = new JSObject(); result.put("ok", true); result.put("imageData", "data:image/png;base64," + base64); result.put("requestId", connection.getHeaderField("x-request-id")); call.resolve(result);
            } catch (Exception error) {
                JSObject result = new JSObject(); result.put("ok", false); result.put("error", error.getMessage() == null ? "Avatar generation failed." : error.getMessage()); call.resolve(result);
            } finally { if (connection != null) connection.disconnect(); }
        });
    }
}
