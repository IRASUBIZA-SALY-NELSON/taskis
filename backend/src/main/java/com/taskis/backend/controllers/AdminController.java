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

    private boolean isAdmin() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetails) {
            String username = ((UserDetails) principal).getUsername();
            User user = userRepository.findByUsername(username).orElse(null);
            return user != null && "ADMIN".equals(user.getRole());
        }
        return false;
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
        return ResponseEntity.ok(userRepository.findAll());
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
