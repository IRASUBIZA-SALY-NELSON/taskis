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

    // Only these may be served inline; everything else is forced to download so an
    // uploaded .html/.svg/etc. can never execute script on the app origin.
    private static final java.util.Set<String> INLINE_OK = java.util.Set.of(
            "image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp", "image/avif", "image/bmp",
            "audio/webm", "audio/ogg", "audio/mpeg", "audio/mp3", "audio/mp4", "audio/wav", "audio/x-m4a", "audio/aac",
            "video/mp4", "video/webm", "video/ogg");

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
            @RequestParam(name = "dl", required = false) String dl) {
        return serve(id, name, dl != null);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> byId(@PathVariable String id, @RequestParam(name = "dl", required = false) String dl) {
        return serve(id, null, dl != null);
    }
}
