package com.taskis.backend.controllers;

import com.taskis.backend.models.Comment;
import com.taskis.backend.models.Post;
import com.taskis.backend.models.User;
import com.taskis.backend.repositories.CommentRepository;
import com.taskis.backend.config.ScheduledTasks;
import com.taskis.backend.repositories.PostRepository;
import com.taskis.backend.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/posts")
public class PostController {

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private CommentRepository commentRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    private void broadcast(String event, Object payload) {
        Map<String, Object> m = new HashMap<>();
        m.put("event", event);
        m.put("payload", payload);
        messagingTemplate.convertAndSend("/topic/feed", (Object) m);
    }

    private Map<String, Object> authorDto(User u) {
        Map<String, Object> m = new HashMap<>();
        if (u == null) return m;
        m.put("id", u.getId());
        m.put("username", u.getUsername());
        m.put("displayName", u.getDisplayName());
        m.put("avatarUrl", u.getAvatarUrl());
        return m;
    }

    private List<String> csv(String s) {
        if (s == null || s.isBlank()) return new ArrayList<>();
        List<String> l = new ArrayList<>(Arrays.asList(s.split(",")));
        l.removeIf(String::isBlank);
        return l;
    }

    private List<String> likers(Post p) { return csv(p.getLikedBy()); }
    private List<String> dislikers(Post p) { return csv(p.getDislikedBy()); }

    private Map<String, Object> postDto(Post p, String me) {
        List<String> likes = likers(p);
        Map<String, Object> m = new HashMap<>();
        m.put("id", p.getId());
        m.put("author", authorDto(p.getAuthor()));
        m.put("imageUrl", p.getImageUrl());
        m.put("caption", p.getCaption());
        m.put("createdAt", p.getCreatedAt());
        m.put("expiresAt", new Date(p.getCreatedAt().getTime() + ScheduledTasks.POST_TTL_MS));
        List<String> dislikes = dislikers(p);
        m.put("likeCount", likes.size());
        m.put("likedByMe", me != null && likes.contains(me));
        m.put("likers", likes);
        m.put("dislikeCount", dislikes.size());
        m.put("dislikedByMe", me != null && dislikes.contains(me));
        m.put("dislikers", dislikes);
        m.put("reactions", p.getReactions() == null ? "" : p.getReactions());
        m.put("commentCount", commentRepository.countByPostId(p.getId()));
        return m;
    }

    private Map<String, Object> commentDto(Comment c) {
        Map<String, Object> m = new HashMap<>();
        m.put("id", c.getId());
        m.put("author", authorDto(c.getAuthor()));
        m.put("content", c.getContent());
        m.put("createdAt", c.getCreatedAt());
        return m;
    }

    @GetMapping
    public ResponseEntity<?> list(
            @RequestParam(required = false) Long beforeId,
            @RequestParam(defaultValue = "10") int limit,
            Principal principal) {
        if (principal == null) return ResponseEntity.status(401).body("Unauthorized");
        String me = principal.getName();
        int cap = Math.min(Math.max(limit, 1), 30);
        Date cutoff = new Date(System.currentTimeMillis() - ScheduledTasks.POST_TTL_MS);
        List<Map<String, Object>> out = new ArrayList<>();
        for (Post p : postRepository.findByCreatedAtAfterOrderByCreatedAtDesc(cutoff)) {
            if (beforeId != null && p.getId() >= beforeId) continue; // older than the cursor only
            out.add(postDto(p, me));
            if (out.size() >= cap) break;
        }
        return ResponseEntity.ok(out);
    }

    @PostMapping
    public ResponseEntity<?> create(@RequestBody Map<String, String> body, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).body("Unauthorized");
        User author = userRepository.findByUsername(principal.getName()).orElse(null);
        if (author == null) return ResponseEntity.status(401).body("User not found");

        String imageUrl = body.get("imageUrl");
        String caption = body.get("caption");
        if ((imageUrl == null || imageUrl.isBlank()) && (caption == null || caption.isBlank())) {
            return ResponseEntity.badRequest().body("A post needs an image or a caption");
        }
        Post p = new Post();
        p.setAuthor(author);
        p.setImageUrl(imageUrl);
        p.setCaption(caption);
        p.setCreatedAt(new Date());
        Post saved = postRepository.save(p);
        Map<String, Object> dto = postDto(saved, principal.getName());
        broadcast("created", dto);
        return ResponseEntity.ok(dto);
    }

    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<?> delete(@PathVariable Long id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).body("Unauthorized");
        Post p = postRepository.findById(id).orElse(null);
        if (p == null) return ResponseEntity.notFound().build();
        User user = userRepository.findByUsername(principal.getName()).orElse(null);
        boolean isAdmin = user != null && "ADMIN".equals(user.getRole());
        if (!p.getAuthor().getUsername().equals(principal.getName()) && !isAdmin) {
            return ResponseEntity.status(403).body("Forbidden");
        }
        commentRepository.deleteByPostId(id);
        ScheduledTasks.deleteUploadedImage(p.getImageUrl());
        postRepository.delete(p);
        broadcast("deleted", Map.of("id", id));
        return ResponseEntity.ok(Map.of("removed", true));
    }

    @PostMapping("/{id}/like")
    public ResponseEntity<?> like(@PathVariable Long id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).body("Unauthorized");
        Post p = postRepository.findById(id).orElse(null);
        if (p == null) return ResponseEntity.notFound().build();
        String me = principal.getName();
        List<String> likes = likers(p);
        List<String> dislikes = dislikers(p);
        if (likes.contains(me)) { likes.remove(me); } else { likes.add(me); dislikes.remove(me); }
        p.setLikedBy(String.join(",", likes));
        p.setDislikedBy(String.join(",", dislikes));
        postRepository.save(p);
        broadcast("updated", postDto(p, null));
        return ResponseEntity.ok(postDto(p, me));
    }

    @PostMapping("/{id}/dislike")
    public ResponseEntity<?> dislike(@PathVariable Long id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).body("Unauthorized");
        Post p = postRepository.findById(id).orElse(null);
        if (p == null) return ResponseEntity.notFound().build();
        String me = principal.getName();
        List<String> likes = likers(p);
        List<String> dislikes = dislikers(p);
        if (dislikes.contains(me)) { dislikes.remove(me); } else { dislikes.add(me); likes.remove(me); }
        p.setLikedBy(String.join(",", likes));
        p.setDislikedBy(String.join(",", dislikes));
        postRepository.save(p);
        broadcast("updated", postDto(p, null));
        return ResponseEntity.ok(postDto(p, me));
    }

    @PostMapping("/{id}/react")
    public ResponseEntity<?> react(@PathVariable Long id, @RequestBody Map<String, String> body, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).body("Unauthorized");
        Post p = postRepository.findById(id).orElse(null);
        if (p == null) return ResponseEntity.notFound().build();
        String me = principal.getName();
        String emoji = body.get("emoji");
        if (emoji == null || emoji.isBlank()) return ResponseEntity.badRequest().body("emoji required");

        java.util.Map<String, java.util.List<String>> reactions = new java.util.LinkedHashMap<>();
        String raw = p.getReactions() == null ? "" : p.getReactions();
        if (!raw.isBlank()) {
            for (String part : raw.split(";")) {
                if (part.contains(":")) {
                    String[] kv = part.split(":", 2);
                    java.util.List<String> us = new java.util.ArrayList<>(java.util.Arrays.asList(kv[1].split(",")));
                    us.removeIf(String::isBlank);
                    reactions.put(kv[0], us);
                }
            }
        }
        reactions.computeIfAbsent(emoji, k -> new java.util.ArrayList<>());
        if (reactions.get(emoji).contains(me)) {
            reactions.get(emoji).remove(me);
            if (reactions.get(emoji).isEmpty()) reactions.remove(emoji);
        } else {
            reactions.get(emoji).add(me);
        }
        StringBuilder sb = new StringBuilder();
        for (java.util.Map.Entry<String, java.util.List<String>> e : reactions.entrySet()) {
            if (sb.length() > 0) sb.append(";");
            sb.append(e.getKey()).append(":").append(String.join(",", e.getValue()));
        }
        p.setReactions(sb.toString());
        postRepository.save(p);
        broadcast("updated", postDto(p, null));
        return ResponseEntity.ok(postDto(p, me));
    }

    @GetMapping("/{id}/comments")
    public ResponseEntity<?> comments(@PathVariable Long id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).body("Unauthorized");
        List<Map<String, Object>> out = new ArrayList<>();
        for (Comment c : commentRepository.findByPostIdOrderByCreatedAtAsc(id)) out.add(commentDto(c));
        return ResponseEntity.ok(out);
    }

    @PostMapping("/{id}/comments")
    public ResponseEntity<?> addComment(@PathVariable Long id, @RequestBody Map<String, String> body, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).body("Unauthorized");
        Post p = postRepository.findById(id).orElse(null);
        if (p == null) return ResponseEntity.notFound().build();
        User author = userRepository.findByUsername(principal.getName()).orElse(null);
        if (author == null) return ResponseEntity.status(401).body("User not found");
        String content = body.get("content");
        if (content == null || content.isBlank()) return ResponseEntity.badRequest().body("Empty comment");

        Comment c = new Comment();
        c.setPost(p);
        c.setAuthor(author);
        c.setContent(content.trim());
        c.setCreatedAt(new Date());
        Comment saved = commentRepository.save(c);
        broadcast("updated", postDto(p, null));
        return ResponseEntity.ok(commentDto(saved));
    }
}
