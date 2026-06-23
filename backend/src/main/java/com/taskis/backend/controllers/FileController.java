package com.taskis.backend.controllers;

import com.taskis.backend.security.FileCrypto;
import com.taskis.backend.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Secure file serving. Accepts either:
 *   ?passphrase=onedayyouwilldie  — explicit passphrase
 *   ?t=<jwt>                      — valid JWT token (backward compat)
 */
@RestController
@RequestMapping("/api/files")
public class FileController {

    private static final String FILE_PASSPHRASE = "onedayyouwilldie";

    @Autowired private FileCrypto fileCrypto;
    @Autowired private JwtUtil jwtUtil;

    private boolean isAuthorized(String passphrase, String t) {
        if (FILE_PASSPHRASE.equals(passphrase)) return true;
        if (t != null && !t.isBlank()) {
            try { return jwtUtil.isTokenValid(t); } catch (Exception ignored) {}
        }
        return false;
    }

    @GetMapping("/{id}/{displayName:.+}")
    public ResponseEntity<?> serveFile(
            @PathVariable String id, @PathVariable String displayName,
            @RequestParam(required = false) String passphrase,
            @RequestParam(required = false) String t,
            @RequestParam(required = false, defaultValue = "false") boolean download) {
        return serve(id, displayName, passphrase, t, download);
    }

    @GetMapping("/{id}")
    public ResponseEntity<?> serveFileNoName(
            @PathVariable String id,
            @RequestParam(required = false) String passphrase,
            @RequestParam(required = false) String t,
            @RequestParam(required = false, defaultValue = "false") boolean download) {
        return serve(id, id, passphrase, t, download);
    }

    private ResponseEntity<?> serve(String id, String displayName, String passphrase, String t, boolean download) {
if (!isAuthorized(passphrase, t)) {
            return ResponseEntity.status(401).body("Passphrase required to access this file.");
        }
        try {
            Path base = Paths.get(System.getProperty("user.dir"), "uploads").toAbsolutePath().normalize();
            Path filePath = base.resolve(id).normalize();
            if (!filePath.startsWith(base)) return ResponseEntity.badRequest().body("Invalid path.");
            if (!Files.exists(filePath)) return ResponseEntity.notFound().build();

     byte[] decrypted = fileCrypto.decrypt(Files.readAllBytes(filePath));

            String contentType = "application/octet-stream";
            Path metaPath = base.resolve(id + ".meta");
            if (Files.exists(metaPath)) {
                contentType = Files.readString(metaPath).trim();
            } else {
                String lower = displayName.toLowerCase();
                if (lower.endsWith(".pdf")) contentType = "application/pdf";
                else if (lower.endsWith(".png")) contentType = "image/png";
                else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) contentType = "image/jpeg";
                else if (lower.endsWith(".gif")) contentType= "image/gif";
                else if (lower.endsWith(".mp4")) contentType = "video/mp4";
                else if (lower.endsWith(".webp")) contentType = "image/webp";
                else if (lower.endsWith(".zip")) contentType = "application/zip";
            }

            String safeDisplay = displayName.replaceAll("[^A-Za-z0-9._\\-]", "_");
            String disposition = download ? "attachment" : "inline";

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"" + safeDisplay + "\"")
                    .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache")
                    .body(decrypted);
        } catch (Exception e) {
            return ResponseEntity.status(500).body("Could not serve file: " + e.getMessage());
        }
    }
}
