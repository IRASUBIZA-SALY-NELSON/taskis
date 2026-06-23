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

/**
 * Secure file serving — all uploads are AES-GCM encrypted at rest.
 *
 * GET /api/files/{id}/{displayName}?passphrase=onedayyouwilldie
 *   → inline preview  (passphrase required)
 *
 * GET /api/files/{id}/{displayName}?passphrase=onedayyouwilldie&download=true
 *   → force download  (passphrase required)
 *
 * Files in #confidential have UUID-only ids (no displayName encoded).
 * Without the correct passphrase → 401.
 */
@RestController
@RequestMapping("/api/files")
public class FileController {

    private static final String FILE_PASSPHRASE = "onedayyouwilldie";

    @Autowired
    private FileCrypto fileCrypto;

    /** Serve a file with its display name in the URL (non-confidential uploads). */
    @GetMapping("/{id}/{displayName:.+}")
    public ResponseEntity<?> serveFile(
            @PathVariable String id,
            @PathVariable String displayName,
            @RequestParam(required = false) String passphrase,
            @RequestParam(required = false, defaultValue = "false") boolean download) {
        return serve(id, displayName, passphrase, download);
    }

    /** Serve a file with no display name (confidential uploads — UUID only). */
    @GetMapping("/{id}")
    public ResponseEntity<?> serveFileNoName(
            @PathVariable String id,
            @RequestParam(required = false) String passphrase,
            @RequestParam(required = false, defaultValue = "false") boolean download) {
        return serve(id, id, passphrase, download);
    }

    private ResponseEntity<?> serve(String id, String displayName, String passphrase, boolean download) {
        if (!FILE_PASSPHRASE.equals(passphrase)) {
            return ResponseEntity.status(401)
                    .body("Passphrase required to access this file.");
        }

        try {
            Path base = Paths.get(System.getProperty("user.dir"), "uploads").toAbsolutePath().normalize();
            Path filePath = base.resolve(id).normalize();

            // Prevent path traversal
            if (!filePath.startsWith(base)) {
                return ResponseEntity.badRequest().body("Invalid path.");
            }
            if (!Files.exists(filePath)) {
                return ResponseEntity.notFound().build();
            }

            // Decrypt the file contents
 byte[] encrypted= Files.readAllBytes(filePath);
            byte[] decrypted = fileCrypto.decrypt(encrypted);

            // Detect content type from .meta file or extension
            String contentType = "application/octet-stream";
            Path metaPath = base.resolve(id + ".meta");
            if (Files.exists(metaPath)) {
                contentType = Files.readString(metaPath).trim();
            } else {
                String lower = displayName.toLowerCase();
                if (lower.endsWith(".pdf")) contentType = "application/pdf";
                else if (lower.endsWith(".png")) contentType = "image/png";
                else if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) contentType = "image/jpeg";
                else if (lower.endsWith(".gif")) contentType = "image/gif";
                else if (lower.endsWith(".mp4")) contentType = "video/mp4";
                else if (lower.endsWith(".webp")) contentType = "image/webp";
                else if (lower.endsWith(".zip")) contentType = "application/zip";
            }

            String disposition = download ? "attachment" : "inline";
            String safeDisplay = displayName.replaceAll("[^A-Za-z0-9._\\-]", "_");

            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(contentType))
                    .header(HttpHeaders.CONTENT_DISPOSITION, disposition + "; filename=\"" + safeDisplay + "\"")
                    .header(HttpHeaders.CACHE_CONTROL, "no-store, no-cache")
                    .body(decrypted);

        } catch (Exception e) {
            return ResponseEntity.status(500).body("Could not serve file: " +e.getMessage());
        }
    }
}
