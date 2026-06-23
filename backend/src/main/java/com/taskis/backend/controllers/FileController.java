package com.taskis.backend.controllers;

import com.taskis.backend.security.FileCrypto;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@RestController
@RequestMapping("/api/files")
public class FileController {

    @Autowired
    private FileCrypto fileCrypto;

    @Autowired
    private com.taskis.backend.security.JwtUtil jwtUtil;

    /** Files require a valid token — via Authorization header or a `t` query param
        (the latter so <img>/<iframe>/<video>, which can't set headers, still work). */
    private boolean authorized(String authHeader, String tokenParam) {
        String token = null;
        if (authHeader != null && authHeader.startsWith("Bearer ")) token = authHeader.substring(7);
        else if (tokenParam != null && !tokenParam.isBlank()) token = tokenParam;
        return jwtUtil.isTokenValid(token);
    }

    // Only these may be served inline; everything else is forced to download so an
    // uploaded .html/.svg/etc. can never execute script on the app origin.
    private static final java.util.Set<String> INLINE_OK = java.util.Set.of(
            "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/avif", "image/bmp",
            "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp3", "audio/mp4", "audio/wav", "audio/x-m4a", "audio/aac",
            "video/mp4", "video/webm", "video/ogg");
    // Note: PDFs/HTML/etc. are intentionally NOT inline — they're served as
    // attachments. The in-app preview fetches their bytes and renders a local
    // blob, so previewing works without ever serving active content inline.

    private ResponseEntity<?> serve(String id, String name, boolean download) {
        try {
            if (!id.matches("[a-f0-9]{16,40}")) return ResponseEntity.badRequest().build();
            Path base = Paths.get(System.getProperty("user.dir"), "uploads").toAbsolutePath().normalize();
            Path file = base.resolve(id).normalize();
            if (!file.startsWith(base) || !Files.exists(file)) return ResponseEntity.notFound().build();

            byte[] decrypted = fileCrypto.decrypt(Files.readAllBytes(file));

            String type = "application/octet-stream";
            Path meta = base.resolve(id + ".meta");
            if (Files.exists(meta)) type = Files.readString(meta).trim();

            boolean safeInline = INLINE_OK.contains(type.toLowerCase());
            // anything not on the allowlist must download, never render inline
            boolean asAttachment = download || !safeInline;

            HttpHeaders headers = new HttpHeaders();
            headers.setCacheControl("private, max-age=86400");
            headers.add("X-Content-Type-Options", "nosniff");
            headers.add("Content-Security-Policy", "default-src 'none'; sandbox; style-src 'unsafe-inline'");
            String fname = name == null || name.isBlank() ? "file" : name;
            headers.add(HttpHeaders.CONTENT_DISPOSITION,
                    (asAttachment ? "attachment" : "inline") + "; filename=\"" + fname.replaceAll("[\"\\r\\n]", "") + "\"");
            return ResponseEntity.ok().headers(headers).contentType(MediaType.parseMediaType(type)).body(decrypted);
        } catch (Exception e) {
            return ResponseEntity.status(500).build();
        }
    }

    @GetMapping("/{id}/{name}")
    public ResponseEntity<?> withName(@PathVariable String id, @PathVariable String name,
            @RequestParam(name = "dl", required = false) String dl,
            @RequestParam(name = "t", required = false) String t,
            @org.springframework.web.bind.annotation.RequestHeader(name = "Authorization", required = false) String auth) {
        if (!authorized(auth, t)) return ResponseEntity.status(401).build();
        return serve(id, name, dl != null);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> byId(@PathVariable String id,
            @RequestParam(name = "dl", required = false) String dl,
            @RequestParam(name = "t", required = false) String t,
            @org.springframework.web.bind.annotation.RequestHeader(name = "Authorization", required = false) String auth) {
        if (!authorized(auth, t)) return ResponseEntity.status(401).build();
        return serve(id, null, dl != null);
    }
}
