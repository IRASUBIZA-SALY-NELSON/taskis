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

    @Autowired
    private com.taskis.backend.repositories.MessageRepository messageRepository;

    @Autowired
    private com.taskis.backend.repositories.UserRepository userRepository;

    /** Pull the bearer/`t` token; null if absent. */
    private String token(String authHeader, String tokenParam) {
        if (authHeader != null && authHeader.startsWith("Bearer ")) return authHeader.substring(7);
        if (tokenParam != null && !tokenParam.isBlank()) return tokenParam;
        return null;
    }

    /**
     * A file is servable when the token is a valid file-scoped token AND — if the file is
     * attached to a restricted channel (#confidential or a DM) — the token's owner is allowed
     * into that channel. Files not tied to a restricted message (avatars, feed images, named
     * channels) only need a valid file token. This closes the channel-blind file hole: a valid
     * file token alone no longer fetches confidential exam papers by id.
     */
    private boolean canServe(String id, String token) {
        if (!jwtUtil.isValidFileToken(token)) return false;

        com.taskis.backend.models.User user;
        try {
            user = userRepository.findByUsername(jwtUtil.extractUsername(token)).orElse(null);
        } catch (Exception e) {
            return false;
        }

        // #confidential: any attached file requires the unlocked flag.
        for (com.taskis.backend.models.Message m : messageRepository.findByChannel("confidential")) {
            String url = m.getAttachmentUrl();
            if (url != null && url.contains(id)) {
                return user != null && Boolean.TRUE.equals(user.getConfidentialUnlocked());
            }
        }

        // DMs: only the two participants may fetch attachments.
        for (com.taskis.backend.models.Message m : messageRepository.findByChannelStartingWith("dm_")) {
            String url = m.getAttachmentUrl();
            if (url != null && url.contains(id)) {
                return user != null && inDm(user, m.getChannel());
            }
        }

        return true; // not a restricted-channel file
    }

    private boolean inDm(com.taskis.backend.models.User user, String channel) {
        String[] parts = channel.split("_");
        if (parts.length != 3 || user.getId() == null) return false;
        try {
            return user.getId().equals(Long.parseLong(parts[1]))
                    || user.getId().equals(Long.parseLong(parts[2]));
        } catch (NumberFormatException e) {
            return false;
        }
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
            headers.add("Referrer-Policy", "no-referrer"); // don't leak the ?t= token via Referer
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
        if (!canServe(id, token(auth, t))) return ResponseEntity.status(401).build();
        return serve(id, name, dl != null);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> byId(@PathVariable String id,
            @RequestParam(name = "dl", required = false) String dl,
            @RequestParam(name = "t", required = false) String t,
            @org.springframework.web.bind.annotation.RequestHeader(name = "Authorization", required = false) String auth) {
        if (!canServe(id, token(auth, t))) return ResponseEntity.status(401).build();
        return serve(id, null, dl != null);
    }
}
