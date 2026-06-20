package com.taskis.backend.controllers;

import com.taskis.backend.models.CustomEmoji;
import com.taskis.backend.models.User;
import com.taskis.backend.repositories.CustomEmojiRepository;
import com.taskis.backend.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/emojis")
public class EmojiController {

    @Autowired
    private CustomEmojiRepository repo;

    @Autowired
    private UserRepository userRepository;

    private Map<String, Object> dto(CustomEmoji e) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", e.getId());
        m.put("name", e.getName());
        m.put("url", e.getUrl());
        m.put("createdBy", e.getCreatedBy());
        return m;
    }

    @GetMapping
    public ResponseEntity<?> list(Principal principal) {
        if (principal == null) return ResponseEntity.status(401).body("Unauthorized");
        List<Map<String, Object>> out = new ArrayList<>();
        for (CustomEmoji e : repo.findAllByOrderByNameAsc()) out.add(dto(e));
        return ResponseEntity.ok(out);
    }

    @PostMapping
    public ResponseEntity<?> add(@RequestBody Map<String, String> body, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).body("Unauthorized");
        String name = (body.get("name") == null ? "" : body.get("name")).toLowerCase().replaceAll(":", "").trim();
        String url = body.get("url");
        if (!name.matches("[a-z0-9_]{2,32}")) {
            return ResponseEntity.badRequest().body("Name must be 2–32 chars: a–z, 0–9, underscore.");
        }
        if (url == null || url.isBlank()) return ResponseEntity.badRequest().body("Image is required.");
        if (repo.findByName(name).isPresent()) return ResponseEntity.status(409).body("That emoji name is taken.");

        CustomEmoji e = new CustomEmoji();
        e.setName(name);
        e.setUrl(url);
        e.setCreatedBy(principal.getName());
        e.setCreatedAt(new Date());
        return ResponseEntity.ok(dto(repo.save(e)));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> remove(@PathVariable Long id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).body("Unauthorized");
        CustomEmoji e = repo.findById(id).orElse(null);
        if (e == null) return ResponseEntity.notFound().build();
        User user = userRepository.findByUsername(principal.getName()).orElse(null);
        boolean isAdmin = user != null && "ADMIN".equals(user.getRole());
        if (!principal.getName().equals(e.getCreatedBy()) && !isAdmin) {
            return ResponseEntity.status(403).body("Forbidden");
        }
        repo.delete(e);
        return ResponseEntity.ok(Map.of("removed", true));
    }
}
