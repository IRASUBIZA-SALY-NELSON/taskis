package com.taskis.backend.controllers;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.InputStream;
import java.net.InetAddress;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Fetches a page's title, description and image so chat can show a link card. Browsers
 * can't do this themselves (CORS), so the server does, with protections against being
 * used to reach internal addresses: only http(s) on ports 80/443, every redirect hop and
 * every resolved address is checked, and size and time are capped.
 */
@RestController
@RequestMapping("/api/links")
public class LinkPreviewController {

    private static final int MAX_BYTES = 512 * 1024;
    private static final int MAX_REDIRECTS = 3;
    private static final long OK_TTL_MS = 6 * 3600_000L;
    private static final long FAIL_TTL_MS = 10 * 60_000L;
    private static final int CACHE_MAX = 500;

    private record Entry(Map<String, String> data, long expires) {}

    private final Map<String, Entry> cache = new ConcurrentHashMap<>();
    private final HttpClient http = HttpClient.newBuilder()
            .followRedirects(HttpClient.Redirect.NEVER)
            .connectTimeout(Duration.ofSeconds(4))
            .build();

    @GetMapping("/preview")
    public ResponseEntity<?> preview(@RequestParam("url") String url) {
        long now = System.currentTimeMillis();
        Entry hit = cache.get(url);
        if (hit != null && hit.expires > now) return ResponseEntity.ok(hit.data);

        Map<String, String> data = fetch(url);
        if (cache.size() >= CACHE_MAX) cache.clear();
        cache.put(url, new Entry(data, now + (data.containsKey("title") || data.containsKey("image") ? OK_TTL_MS : FAIL_TTL_MS)));
        return ResponseEntity.ok(data);
    }

    private Map<String, String> fetch(String start) {
        Map<String, String> out = new HashMap<>();
        try {
            URI uri = URI.create(start);
            for (int hop = 0; hop <= MAX_REDIRECTS; hop++) {
                if (!isPublicWeb(uri)) return out;
                HttpRequest req = HttpRequest.newBuilder(uri)
                        .timeout(Duration.ofSeconds(5))
                        .header("User-Agent", "Mozilla/5.0 (compatible; TaskisLinkPreview/1.0)")
                        .header("Accept", "text/html,application/xhtml+xml")
                        .GET().build();
                HttpResponse<InputStream> res = http.send(req, HttpResponse.BodyHandlers.ofInputStream());
                int code = res.statusCode();
                if (code >= 300 && code < 400) {
                    String loc = res.headers().firstValue("Location").orElse(null);
                    res.body().close();
                    if (loc == null) return out;
                    uri = uri.resolve(loc);
                    continue;
                }
                String type = res.headers().firstValue("Content-Type").orElse("").toLowerCase();
                if (code != 200 || !type.contains("text/html")) { res.body().close(); return out; }
                byte[] bytes;
                try (InputStream in = res.body()) {
                    bytes = in.readNBytes(MAX_BYTES);
                }
                parse(new String(bytes, StandardCharsets.UTF_8), uri, out);
                return out;
            }
        } catch (Exception ignored) {
            // unreachable, slow, or malformed: no preview
        }
        return new HashMap<>();
    }

    /** http(s) on a standard port, and every address the host resolves to is a public one. */
    private static boolean isPublicWeb(URI uri) {
        try {
            String scheme = uri.getScheme();
            if (scheme == null || !(scheme.equals("http") || scheme.equals("https"))) return false;
            if (uri.getUserInfo() != null || uri.getHost() == null) return false;
            int port = uri.getPort();
            if (port != -1 && port != 80 && port != 443) return false;
            for (InetAddress a : InetAddress.getAllByName(uri.getHost())) {
                if (a.isAnyLocalAddress() || a.isLoopbackAddress() || a.isLinkLocalAddress() || a.isSiteLocalAddress()
                        || a.isMulticastAddress() || isUniqueLocalV6(a) || isCarrierGradeNat(a)) return false;
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static boolean isUniqueLocalV6(InetAddress a) {
        byte[] b = a.getAddress();
        return b.length == 16 && (b[0] & 0xFE) == 0xFC; // fc00::/7
    }

    private static boolean isCarrierGradeNat(InetAddress a) {
        byte[] b = a.getAddress();
        return b.length == 4 && (b[0] & 0xFF) == 100 && (b[1] & 0xC0) == 64; // 100.64.0.0/10
    }

    private static final Pattern META = Pattern.compile("<meta\\s+[^>]*>", Pattern.CASE_INSENSITIVE);
    private static final Pattern ATTR = Pattern.compile("([a-zA-Z:-]+)\\s*=\\s*(\"([^\"]*)\"|'([^']*)')");
    private static final Pattern TITLE = Pattern.compile("<title[^>]*>(.*?)</title>", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private static void parse(String html, URI base, Map<String, String> out) {
        int head = html.toLowerCase().indexOf("</head>");
        String scope = head > 0 ? html.substring(0, head) : html;
        Map<String, String> metas = new HashMap<>();
        Matcher m = META.matcher(scope);
        while (m.find()) {
            Map<String, String> attrs = new HashMap<>();
            Matcher a = ATTR.matcher(m.group());
            while (a.find()) attrs.put(a.group(1).toLowerCase(), a.group(3) != null ? a.group(3) : a.group(4));
            String key = attrs.getOrDefault("property", attrs.get("name"));
            if (key != null && attrs.containsKey("content")) metas.putIfAbsent(key.toLowerCase(), attrs.get("content"));
        }
        String title = first(metas.get("og:title"), metas.get("twitter:title"));
        if (title == null) {
            Matcher t = TITLE.matcher(scope);
            if (t.find()) title = t.group(1);
        }
        String desc = first(metas.get("og:description"), metas.get("twitter:description"), metas.get("description"));
        String image = first(metas.get("og:image"), metas.get("twitter:image"));
        String site = metas.get("og:site_name");

        put(out, "title", clip(unescape(title), 140));
        put(out, "description", clip(unescape(desc), 220));
        put(out, "siteName", clip(unescape(site), 60));
        if (image != null) {
            try {
                URI img = base.resolve(unescape(image).trim());
                if ("http".equals(img.getScheme()) || "https".equals(img.getScheme())) put(out, "image", img.toString());
            } catch (Exception ignored) { }
        }
    }

    private static String first(String... values) {
        for (String v : values) if (v != null && !v.isBlank()) return v;
        return null;
    }

    private static void put(Map<String, String> out, String key, String value) {
        if (value != null && !value.isBlank()) out.put(key, value);
    }

    private static String clip(String s, int max) {
        if (s == null) return null;
        s = s.replaceAll("\\s+", " ").trim();
        return s.length() <= max ? s : s.substring(0, max - 1) + "\u2026";
    }

    private static String unescape(String s) {
        if (s == null) return null;
        return s.replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">")
                .replace("&quot;", "\"").replace("&#39;", "'").replace("&#x27;", "'").replace("&apos;", "'");
    }
}
