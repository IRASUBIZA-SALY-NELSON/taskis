package com.taskis.backend.controllers;

import com.taskis.backend.models.Message;
import com.taskis.backend.models.Post;
import com.taskis.backend.models.Report;
import com.taskis.backend.models.User;
import com.taskis.backend.repositories.MessageRepository;
import com.taskis.backend.repositories.PostRepository;
import com.taskis.backend.repositories.ReportRepository;
import com.taskis.backend.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Date;
import java.util.Map;

@RestController
@RequestMapping("/api/reports")
public class ReportController {

    @Autowired private ReportRepository repo;
    @Autowired private UserRepository userRepository;
    @Autowired private MessageRepository messageRepository;
    @Autowired private PostRepository postRepository;

    private boolean isAdmin(Principal p) {
        if (p == null) return false;
        User u = userRepository.findByUsername(p.getName()).orElse(null);
        return u != null && "ADMIN".equals(u.getRole());
    }

    private boolean canAccessChannel(User user, String channel) {
        if (user == null) return false;
        if (channel == null) return true;
        if (channel.startsWith("dm_")) {
            String[] parts = channel.split("_");
            if (parts.length != 3 || user.getId() == null) return false;
            try {
                return user.getId().equals(Long.parseLong(parts[1])) || user.getId().equals(Long.parseLong(parts[2]));
            } catch (NumberFormatException e) {
                return false;
            }
        }
        return true; // named channels + bot are visible to all members
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, String> body, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).body("Unauthorized");
        String type = body.get("type");
        Long targetId;
        try { targetId = Long.parseLong(body.get("targetId")); } catch (Exception e) { return ResponseEntity.badRequest().body("Invalid target"); }

        User reporter = userRepository.findByUsername(principal.getName()).orElse(null);
        String snapshot = "";
        String author = "";
        if ("message".equals(type)) {
            Message m = messageRepository.findById(targetId).orElse(null);
            if (m != null) {
                if (!canAccessChannel(reporter, m.getChannel())) return ResponseEntity.status(403).body("Forbidden");
                snapshot = m.getContent() == null ? "" : m.getContent();
                author = m.getSender() != null ? m.getSender().getUsername() : "";
            }
        } else if ("post".equals(type)) {
            Post po = postRepository.findById(targetId).orElse(null);
            if (po != null) { snapshot = po.getCaption() == null ? "" : po.getCaption(); author = po.getAuthor() != null ? po.getAuthor().getUsername() : ""; }
        } else {
            return ResponseEntity.badRequest().body("Invalid type");
        }

        Report r = new Report();
        r.setType(type);
        r.setTargetId(targetId);
        r.setReportedBy(principal.getName());
        r.setReason(body.getOrDefault("reason", ""));
        r.setSnapshot(snapshot.length() > 600 ? snapshot.substring(0, 600) : snapshot);
        r.setAuthorName(author);
        r.setCreatedAt(new Date());
        repo.save(r);
        return ResponseEntity.ok(Map.of("ok", true));
    }

    @GetMapping
    public ResponseEntity<?> list(Principal principal) {
        if (!isAdmin(principal)) return ResponseEntity.status(403).body("Access denied");
        return ResponseEntity.ok(repo.findAllByOrderByResolvedAscCreatedAtDesc());
    }

    @PostMapping("/{id}/resolve")
    public ResponseEntity<?> resolve(@PathVariable Long id, Principal principal) {
        if (!isAdmin(principal)) return ResponseEntity.status(403).body("Access denied");
        Report r = repo.findById(id).orElse(null);
        if (r == null) return ResponseEntity.notFound().build();
        r.setResolved(true);
        repo.save(r);
        return ResponseEntity.ok(r);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<?> remove(@PathVariable Long id, Principal principal) {
        if (!isAdmin(principal)) return ResponseEntity.status(403).body("Access denied");
        repo.deleteById(id);
        return ResponseEntity.ok(Map.of("removed", true));
    }
}
