package com.taskis.backend.controllers;

import com.taskis.backend.models.RegistrationKey;
import com.taskis.backend.models.User;
import com.taskis.backend.repositories.RegistrationKeyRepository;
import com.taskis.backend.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
public class AdminController {

    @Autowired
    private RegistrationKeyRepository keyRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private org.springframework.security.crypto.password.PasswordEncoder passwordEncoder;

    @Autowired private com.taskis.backend.repositories.MessageRepository messageRepository;
    @Autowired private com.taskis.backend.repositories.PostRepository postRepository;
    @Autowired private com.taskis.backend.repositories.CommentRepository commentRepository;
    @Autowired private com.taskis.backend.repositories.ReportRepository reportRepository;
    @Autowired private com.taskis.backend.repositories.CustomEmojiRepository customEmojiRepository;
    @Autowired private com.taskis.backend.repositories.OtpCodeRepository otpCodeRepository;

    private User currentUser() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetails) {
            return userRepository.findByUsername(((UserDetails) principal).getUsername()).orElse(null);
        }
        return null;
    }

    private boolean isAdmin() {
        User u = currentUser();
        return u != null && "ADMIN".equals(u.getRole());
    }

    @GetMapping("/stats")
    public ResponseEntity<?> stats() {
        if (!isAdmin()) return ResponseEntity.status(403).body("Access denied");
        long now = System.currentTimeMillis();
        long activeNow = userRepository.findAll().stream()
                .filter(u -> u.getLastHeartbeat() != null && now - u.getLastHeartbeat().getTime() < 30000)
                .count();
        java.util.Map<String, Object> m = new java.util.HashMap<>();
        m.put("users", userRepository.count());
        m.put("activeNow", activeNow);
        m.put("messages", messageRepository.count());
        m.put("posts", postRepository.count());
        m.put("comments", commentRepository.count());
        m.put("reports", reportRepository.count());
        m.put("keys", keyRepository.count());
        return ResponseEntity.ok(m);
    }

    @PostMapping("/users/{id}/role")
    public ResponseEntity<?> setRole(@PathVariable Long id, @RequestBody java.util.Map<String, String> body) {
        if (!isAdmin()) return ResponseEntity.status(403).body("Access denied");
        User user = userRepository.findById(id).orElse(null);
        if (user == null) return ResponseEntity.notFound().build();
        String role = body.get("role");
        if (!"ADMIN".equals(role) && !"USER".equals(role)) return ResponseEntity.badRequest().body("role must be ADMIN or USER");
        user.setRole(role);
        userRepository.save(user);
        return ResponseEntity.ok(user);
    }

    /** Erase every uploaded file (keeps the folder). */
    private int wipeUploads() {
        int n = 0;
        try {
            java.nio.file.Path base = java.nio.file.Paths.get(System.getProperty("user.dir"), "uploads").toAbsolutePath().normalize();
            if (java.nio.file.Files.exists(base)) {
                try (java.util.stream.Stream<java.nio.file.Path> s = java.nio.file.Files.list(base)) {
                    for (java.nio.file.Path p : s.collect(java.util.stream.Collectors.toList())) {
                        if (java.nio.file.Files.isRegularFile(p)) { java.nio.file.Files.deleteIfExists(p); n++; }
                    }
                }
            }
        } catch (Exception ignored) { /* best-effort */ }
        return n;
    }

    /**
     * SELF-DESTRUCT — wipes all conversation/feed data and every non-admin
     * account, plus uploaded files. Guarded by admin + an explicit confirm
     * phrase. Admins are kept so the app stays usable; OS-level teardown
     * (services/codebase) is intentionally NOT done here — see teardown.sh.
     */
    @PostMapping("/self-destruct")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> selfDestruct(@RequestBody java.util.Map<String, String> body) {
        if (!isAdmin()) return ResponseEntity.status(403).body("Access denied");
        if (!"DESTRUCT".equals(body.get("confirm"))) return ResponseEntity.status(400).body("Confirmation phrase required");
        messageRepository.deleteAll();
        commentRepository.deleteAll();
        postRepository.deleteAll();
        reportRepository.deleteAll();
        customEmojiRepository.deleteAll();
        otpCodeRepository.deleteAll();
        keyRepository.deleteAll();
        // remove every account except admins
        for (User u : userRepository.findAll()) {
            if (!"ADMIN".equals(u.getRole())) userRepository.delete(u);
        }
        int files = wipeUploads();
        return ResponseEntity.ok(java.util.Map.of("wiped", true, "filesRemoved", files));
    }

    /** Erase one specific person and everything they created. */
    @PostMapping("/destruct-user/{id}")
    @org.springframework.transaction.annotation.Transactional
    public ResponseEntity<?> destructUser(@PathVariable Long id, @RequestBody java.util.Map<String, String> body) {
        if (!isAdmin()) return ResponseEntity.status(403).body("Access denied");
        if (!"DESTRUCT".equals(body.get("confirm"))) return ResponseEntity.status(400).body("Confirmation phrase required");
        User target = userRepository.findById(id).orElse(null);
        if (target == null) return ResponseEntity.notFound().build();
        if ("ADMIN".equals(target.getRole())) return ResponseEntity.status(403).body("Cannot destruct an admin");
        String uname = target.getUsername();
        // their posts (+ comments on them)
        for (com.taskis.backend.models.Post p : postRepository.findAll()) {
            if (p.getAuthor() != null && uname.equals(p.getAuthor().getUsername())) {
                commentRepository.deleteByPostId(p.getId());
                postRepository.delete(p);
            }
        }
        // their messages + any DM channel they were part of
        String idTag = "_" + id + "_", endTag = "_" + id;
        for (com.taskis.backend.models.Message msg : messageRepository.findAll()) {
            boolean theirs = msg.getSender() != null && uname.equals(msg.getSender().getUsername());
            String ch = msg.getChannel() == null ? "" : msg.getChannel();
            boolean theirDm = ch.startsWith("dm_") && (ch.contains(idTag) || ch.endsWith(endTag));
            if (theirs || theirDm) messageRepository.delete(msg);
        }
        // their comments elsewhere
        for (com.taskis.backend.models.Comment c : commentRepository.findAll()) {
            if (c.getAuthor() != null && uname.equals(c.getAuthor().getUsername())) commentRepository.delete(c);
        }
        if (target.getRegistrationKey() != null) {
            keyRepository.findByKeyString(target.getRegistrationKey()).ifPresent((k) -> { k.setRevoked(true); keyRepository.save(k); });
        }
        userRepository.delete(target);
        return ResponseEntity.ok(java.util.Map.of("destructed", uname));
    }

    @PostMapping("/keys")
    public ResponseEntity<?> generateKey(@RequestBody java.util.Map<String, String> body) {
        if (!isAdmin())
            return ResponseEntity.status(403).body("Access denied");

        String username = body.get("username");
        if (username == null || username.trim().isEmpty()) {
            return ResponseEntity.badRequest().body("Username is required");
        }

        StringBuilder sb = new StringBuilder(128);
        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
        java.security.SecureRandom rnd = new java.security.SecureRandom();
        for (int i = 0; i < 128; i++)
            sb.append(chars.charAt(rnd.nextInt(chars.length())));
        String keyStr = sb.toString();

        RegistrationKey key = new RegistrationKey();
        key.setKeyString(keyStr);
        keyRepository.save(key);

        User user = userRepository.findByUsername(username).orElse(new User());
        user.setUsername(username);
        user.setRegistrationKey(keyStr);
        if (user.getId() == null) {
            user.setRole("USER");
            user.setStatus("ACTIVE");
            user.setAvatarUrl("https://api.dicebear.com/7.x/bottts/svg?seed=" + username);
            user.setPassword(passwordEncoder.encode(UUID.randomUUID().toString()));
        }
        userRepository.save(user);

        return ResponseEntity.ok(key);
    }

    @GetMapping("/keys")
    public ResponseEntity<?> getKeys() {
        if (!isAdmin())
            return ResponseEntity.status(403).body("Access denied");
        return ResponseEntity.ok(keyRepository.findAll());
    }

    @GetMapping("/users")
    public ResponseEntity<?> getUsers() {
        if (!isAdmin())
            return ResponseEntity.status(403).body("Access denied");
        // Admin-only DTO: includes the registration key (which the entity now hides
        // via @JsonIgnore) but never the password hash.
        java.util.List<java.util.Map<String, Object>> out = new java.util.ArrayList<>();
        for (User u : userRepository.findAll()) {
            java.util.Map<String, Object> m = new java.util.HashMap<>();
            m.put("id", u.getId());
            m.put("username", u.getUsername());
            m.put("displayName", u.getDisplayName());
            m.put("avatarUrl", u.getAvatarUrl());
            m.put("role", u.getRole());
            m.put("status", u.getStatus());
            m.put("active", u.getActive());
            m.put("registrationKey", u.getRegistrationKey());
            m.put("ringColor", u.getRingColor());
            m.put("createdAt", u.getCreatedAt());
            m.put("lastHeartbeat", u.getLastHeartbeat());
            out.add(m);
        }
        return ResponseEntity.ok(out);
    }

    @PostMapping("/users/{id}/active")
    public ResponseEntity<?> setActive(@PathVariable Long id, @RequestBody java.util.Map<String, Object> body) {
        if (!isAdmin())
            return ResponseEntity.status(403).body("Access denied");
        User user = userRepository.findById(id).orElse(null);
        if (user == null)
            return ResponseEntity.notFound().build();
        if ("ADMIN".equals(user.getRole()))
            return ResponseEntity.status(403).body("Cannot deactivate an admin");
        Object v = body.get("active");
        user.setActive(Boolean.TRUE.equals(v) || "true".equals(String.valueOf(v)));
        userRepository.save(user);
        return ResponseEntity.ok(user);
    }

    @DeleteMapping("/users/{id}")
    public ResponseEntity<?> removeUser(@PathVariable Long id) {
        if (!isAdmin())
            return ResponseEntity.status(403).body("Access denied");
        User user = userRepository.findById(id).orElse(null);
        if (user == null)
            return ResponseEntity.notFound().build();
        if ("ADMIN".equals(user.getRole()))
            return ResponseEntity.status(403).body("Cannot remove an admin");
        // Revoke their key too, if any.
        if (user.getRegistrationKey() != null) {
            keyRepository.findByKeyString(user.getRegistrationKey()).ifPresent((k) -> {
                k.setRevoked(true);
                keyRepository.save(k);
            });
        }
        userRepository.delete(user);
        return ResponseEntity.ok(java.util.Map.of("removed", true));
    }

    @PostMapping("/keys/{id}/revoke")
    public ResponseEntity<?> revokeKey(@PathVariable Long id) {
        if (!isAdmin())
            return ResponseEntity.status(403).body("Access denied");
        RegistrationKey key = keyRepository.findById(id).orElse(null);
        if (key == null)
            return ResponseEntity.notFound().build();
        key.setRevoked(true);
        keyRepository.save(key);
        return ResponseEntity.ok(key);
    }
}
