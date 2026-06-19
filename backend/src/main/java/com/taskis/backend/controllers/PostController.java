package com.taskis.backend.controllers;

import com.taskis.backend.models.Comment;
import com.taskis.backend.models.Post;
import com.taskis.backend.models.User;
import com.taskis.backend.repositories.CommentRepository;
import com.taskis.backend.repositories.PostRepository;
import com.taskis.backend.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
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

    private Map<String, Object> authorDto(User u) {
        Map<String, Object> m = new HashMap<>();
        if (u == null) return m;
        m.put("id", u.getId());
        m.put("username", u.getUsername());
        m.put("displayName", u.getDisplayName());
        m.put("avatarUrl", u.getAvatarUrl());
        return m;
    }

    private List<String> likers(Post p) {
        if (p.getLikedBy() == null || p.getLikedBy().isBlank()) return new ArrayList<>();
        List<String> l = new ArrayList<>(Arrays.asList(p.getLikedBy().split(",")));
        l.removeIf(String::isBlank);
        return l;
    }

    private Map<String, Object> postDto(Post p, String me) {
        List<String> likes = likers(p);
        Map<String, Object> m = new HashMap<>();
        m.put("id", p.getId());
        m.put("author", authorDto(p.getAuthor()));
        m.put("imageUrl", p.getImageUrl());
        m.put("caption", p.getCaption());
        m.put("createdAt", p.getCreatedAt());
        m.put("likeCount", likes.size());
        m.put("likedByMe", me != null && likes.contains(me));
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
    public ResponseEntity<?> list(Principal principal) {
        if (principal == null) return ResponseEntity.status(401).body("Unauthorized");
        String me = principal.getName();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Post p : postRepository.findAllByOrderByCreatedAtDesc()) out.add(postDto(p, me));
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
        return ResponseEntity.ok(postDto(saved, principal.getName()));
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
        postRepository.delete(p);
        return ResponseEntity.ok(Map.of("removed", true));
    }

    @PostMapping("/{id}/like")
    public ResponseEntity<?> like(@PathVariable Long id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).body("Unauthorized");
        Post p = postRepository.findById(id).orElse(null);
        if (p == null) return ResponseEntity.notFound().build();
        String me = principal.getName();
        List<String> likes = likers(p);
        if (likes.contains(me)) likes.remove(me); else likes.add(me);
        p.setLikedBy(String.join(",", likes));
        postRepository.save(p);
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
        return ResponseEntity.ok(commentDto(saved));
    }
}
