package rw.salynelson.taskis;

import android.content.ClipData;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.provider.OpenableColumns;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URI;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Receives what other apps share to Taskis (Android share sheet). Shared files are copied into the app's own cache
 * so the web page never needs access to other apps' storage, and are uploaded straight from there, which keeps
 * large videos out of JavaScript memory.
 */
@CapacitorPlugin(name = "TaskisShare")
public class TaskisSharePlugin extends Plugin {

    private static final String DIR = "shared";
    private static final int MAX_FILES = 20;
    private static final long MAX_BYTES = 500L * 1024 * 1024; // the server's upload limit

    private JSObject pending;

    /** Called by MainActivity for every incoming intent; ignores anything that is not a share. */
    public void handleIntent(Intent intent) {
        if (intent == null) return;
        String action = intent.getAction();
        if (!Intent.ACTION_SEND.equals(action) && !Intent.ACTION_SEND_MULTIPLE.equals(action)) return;
        intent.setAction(Intent.ACTION_MAIN); // handled; don't process it again if the activity is recreated

        final String text = firstNonNull(intent.getStringExtra(Intent.EXTRA_TEXT), "");
        final String subject = firstNonNull(intent.getStringExtra(Intent.EXTRA_SUBJECT), "");
        final String type = intent.getType();
        final List<Uri> uris = streams(intent);

        new Thread(() -> {
            JSObject share = new JSObject();
            share.put("text", text);
            share.put("subject", subject);
            JSArray files = new JSArray();
            boolean skipped = false;
            clearFiles();
            for (Uri uri : uris) {
                if (files.length() >= MAX_FILES) { skipped = true; break; }
                JSObject f = copyToCache(uri, type);
                if (f == null) skipped = true; else files.put(f);
            }
            share.put("files", files);
            share.put("skipped", skipped);
            pending = share;
            notifyListeners("share", share, true);
        }, "taskis-share-copy").start();
    }

    /**
     * Whether this build has Firebase set up (the google-services plugin only generates google_app_id when
     * google-services.json was present). Calling the push plugin without it crashes the whole app, so the page
     * asks first.
     */
    @PluginMethod
    public void pushConfigured(PluginCall call) {
        int id = getContext().getResources().getIdentifier("google_app_id", "string", getContext().getPackageName());
        JSObject r = new JSObject();
        r.put("value", id != 0);
        call.resolve(r);
    }

    @PluginMethod
    public void getPending(PluginCall call) {
        call.resolve(pending != null ? pending : new JSObject());
    }

    @PluginMethod
    public void clear(PluginCall call) {
        clearFiles();
        pending = null;
        call.resolve();
    }

    /** Uploads one previously copied file to the Taskis server and returns its JSON reply ({url, type}). */
    @PluginMethod
    public void upload(PluginCall call) {
        final String path = call.getString("path");
        final String url = call.getString("url");
        final String token = call.getString("token");
        final String channel = call.getString("channel", "general");
        if (path == null || url == null || token == null) { call.reject("path, url and token are required"); return; }

        new Thread(() -> {
            try {
                File file = new File(path).getCanonicalFile();
                File root = new File(getContext().getCacheDir(), DIR).getCanonicalFile();
                if (!file.getPath().startsWith(root.getPath() + File.separator) || !file.isFile()) { call.reject("Not a shared file"); return; }

                // Only talk to the server this app is showing; never send the login token anywhere else.
                String serverHost = new URI(getBridge().getServerUrl() != null ? getBridge().getServerUrl() : getBridge().getAppUrl()).getHost();
                URL target = new URL(url);
                if (serverHost == null || !serverHost.equalsIgnoreCase(target.getHost()) || !target.getProtocol().startsWith("http")) {
                    call.reject("Refusing to upload to " + target.getHost());
                    return;
                }

                String boundary = "----taskis" + UUID.randomUUID().toString().replace("-", "");
                HttpURLConnection c = (HttpURLConnection) target.openConnection();
                c.setRequestMethod("POST");
                c.setDoOutput(true);
                c.setConnectTimeout(15_000);
                c.setReadTimeout(300_000);
                c.setChunkedStreamingMode(64 * 1024);
                c.setRequestProperty("Authorization", "Bearer " + token);
                c.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);

                String name = file.getName().replaceFirst("^[0-9a-f]{8}_", "").replace("\"", "_");
                String mime = firstNonNull(call.getString("type"), "application/octet-stream");
                try (OutputStream out = c.getOutputStream()) {
                    out.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"channel\"\r\n\r\n" + channel + "\r\n").getBytes(StandardCharsets.UTF_8));
                    out.write(("--" + boundary + "\r\nContent-Disposition: form-data; name=\"file\"; filename=\"" + name + "\"\r\nContent-Type: " + mime + "\r\n\r\n").getBytes(StandardCharsets.UTF_8));
                    try (InputStream in = new FileInputStream(file)) {
                        byte[] buf = new byte[64 * 1024];
                        int n;
                        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
                    }
                    out.write(("\r\n--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));
                }

                int code = c.getResponseCode();
                InputStream body = code >= 400 ? c.getErrorStream() : c.getInputStream();
                String reply = body == null ? "" : new String(body.readAllBytes(), StandardCharsets.UTF_8);
                if (code >= 200 && code < 300) call.resolve(new JSObject(reply));
                else call.reject("Upload failed (" + code + ") " + reply);
            } catch (Exception e) {
                call.reject("Upload failed: " + e.getMessage());
            }
        }, "taskis-share-upload").start();
    }

    // ---- helpers ----

    @SuppressWarnings("deprecation")
    private List<Uri> streams(Intent intent) {
        List<Uri> out = new ArrayList<>();
        try {
            if (Intent.ACTION_SEND_MULTIPLE.equals(intent.getAction())) {
                List<Uri> list = Build.VERSION.SDK_INT >= 33
                        ? intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM, Uri.class)
                        : intent.getParcelableArrayListExtra(Intent.EXTRA_STREAM);
                if (list != null) out.addAll(list);
            } else {
                Uri one = Build.VERSION.SDK_INT >= 33
                        ? intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class)
                        : intent.getParcelableExtra(Intent.EXTRA_STREAM);
                if (one != null) out.add(one);
            }
            if (out.isEmpty() && intent.getData() != null) out.add(intent.getData());
            ClipData clip = intent.getClipData();
            if (out.isEmpty() && clip != null) {
                for (int i = 0; i < clip.getItemCount(); i++) if (clip.getItemAt(i).getUri() != null) out.add(clip.getItemAt(i).getUri());
            }
        } catch (RuntimeException ignored) { /* malformed extras: share nothing rather than crash */ }
        return out;
    }

    private JSObject copyToCache(Uri uri, String fallbackType) {
        try {
            String name = "file";
            long size = -1;
            try (Cursor cur = getContext().getContentResolver().query(uri, null, null, null, null)) {
                if (cur != null && cur.moveToFirst()) {
                    int n = cur.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                    int s = cur.getColumnIndex(OpenableColumns.SIZE);
                    if (n >= 0 && !cur.isNull(n)) name = cur.getString(n);
                    if (s >= 0 && !cur.isNull(s)) size = cur.getLong(s);
                }
            } catch (RuntimeException ignored) { /* some providers don't support query */ }
            if (size > MAX_BYTES) return null;

            String type = getContext().getContentResolver().getType(uri);
            if (type == null) type = fallbackType != null ? fallbackType : "application/octet-stream";
            String safe = name.replaceAll("[^A-Za-z0-9._ -]", "_");
            if (safe.length() > 120) safe = safe.substring(safe.length() - 120);

            File dir = new File(getContext().getCacheDir(), DIR);
            if (!dir.exists() && !dir.mkdirs()) return null;
            File dest = new File(dir, UUID.randomUUID().toString().substring(0, 8) + "_" + safe);

            long total = 0;
            try (InputStream in = getContext().getContentResolver().openInputStream(uri); java.io.FileOutputStream out = new java.io.FileOutputStream(dest)) {
                if (in == null) return null;
                byte[] buf = new byte[64 * 1024];
                int n;
                while ((n = in.read(buf)) > 0) {
                    total += n;
                    if (total > MAX_BYTES) { out.close(); dest.delete(); return null; }
                    out.write(buf, 0, n);
                }
            }
            JSObject f = new JSObject();
            f.put("name", name);
            f.put("type", type);
            f.put("size", total);
            f.put("path", dest.getAbsolutePath());
            return f;
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }

    private void clearFiles() {
        File[] old = new File(getContext().getCacheDir(), DIR).listFiles();
        if (old != null) for (File f : old) f.delete();
    }

    private static String firstNonNull(String a, String b) {
        return a != null ? a : b;
    }
}
