package com.taskis.backend.controllers;
import com.taskis.backend.models.Message;
import com.taskis.backend.models.User;
import com.taskis.backend.repositories.MessageRepository;
import com.taskis.backend.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.http.ResponseEntity;

import java.security.Principal;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

@Controller
@RestController
@RequestMapping("/api/chat")
public class ChatController {

    @Autowired
    private SimpMessagingTemplate messagingTemplate;

    @Autowired
    private MessageRepository messageRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private com.taskis.backend.security.BruteForceGuard bruteForce;

    /**
     * Authorization for a channel. Named channels and the bot channel are visible
     * to every authenticated operative; a DM channel ("dm_<id1>_<id2>") is only
     * accessible to the two participants. A null channel defaults to "general".
     */
    private boolean canAccessChannel(User user, String channel) {
        if (user == null)
            return false;
        if (channel == null)
            return true; // defaults to the shared "general" channel
        if (channel.startsWith("dm_")) {
            String[] parts = channel.split("_");
            if (parts.length != 3 || user.getId() == null)
                return false;
            try {
                return user.getId().equals(Long.parseLong(parts[1]))
                        || user.getId().equals(Long.parseLong(parts[2]));
            } catch (NumberFormatException e) {
                return false;
            }
        }
        // #confidential is gated: only users who entered the passkey are admitted.
        if ("confidential".equals(channel)) {
            return Boolean.TRUE.equals(user.getConfidentialUnlocked());
        }
        return true;
    }

    @org.springframework.beans.factory.annotation.Value("${confidential.passkey:20300}")
    private String confidentialPasskey;

    @PostMapping("/unlock-confidential")
    public ResponseEntity<?> unlockConfidential(
            @org.springframework.web.bind.annotation.RequestBody Map<String, String> payload, Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).body("Unauthorized");
        User user = userRepository.findByUsername(principal.getName()).orElse(null);
        if (user == null)
            return ResponseEntity.status(401).body("User not found");
        String key = "confid:" + user.getUsername();
        long wait = bruteForce.retryAfterMs(key);
        if (wait > 0) {
            long secs = (wait + 999) / 1000;
            return ResponseEntity.status(429).header("Retry-After", String.valueOf(secs))
                    .body("Too many attempts. Try again in " + secs + "s.");
        }
        String passphrase = payload.get("passphrase");
        if (confidentialPasskey.equals(passphrase)) {
            bruteForce.onSuccess(key);
            user.setConfidentialUnlocked(true);
            userRepository.save(user);
            return ResponseEntity.ok(Map.of("success", true));
        }
        bruteForce.onFailure(key);
        return ResponseEntity.status(403).body("Incorrect passkey");
    }

    @Autowired
    private com.taskis.backend.services.AuditService auditService;

    @Autowired
    private com.taskis.backend.services.PushService pushService;

    @Autowired
    private com.taskis.backend.services.PresenceService presence;

    @Autowired
    private org.springframework.data.mongodb.core.MongoTemplate mongo;

    // WebSocket Message Handling
    @MessageMapping("/chat.send")
    public void sendMessage(@Payload MessageDto messageDto, Principal principal) {
        User sender = userRepository.findByUsername(principal.getName()).orElse(null);
        if (sender == null)
            return;

        if (!canAccessChannel(sender, messageDto.getChannel()))
            return;

        if ("taskis-bot".equals(messageDto.getChannel()) && !"Taskis Bot".equals(sender.getUsername())) {
            return; // Ignore message
        }

        Message message = new Message();
        message.setSender(sender);
        message.setContent(messageDto.getContent());
        message.setChannel(messageDto.getChannel() != null ? messageDto.getChannel() : "general");
        message.setAttachmentUrl(messageDto.getAttachmentUrl());
        message.setAttachmentType(messageDto.getAttachmentType());
        message.setTimestamp(new Date());

        Message savedMessage = messageRepository.save(message);

        messagingTemplate.convertAndSend("/topic/" + message.getChannel(), savedMessage);
        pushService.notifyNewMessage(savedMessage);
    }

    // Typing indicator relay (transient — not persisted)
    @MessageMapping("/chat.typing")
    public void typing(@Payload Map<String, String> payload, Principal principal) {
        if (principal == null)
            return;
        String channel = payload.get("channel");
        User sender = userRepository.findByUsername(principal.getName()).orElse(null);
        if (sender == null || !canAccessChannel(sender, channel))
            return;
        messagingTemplate.convertAndSend("/topic/" + channel + ".typing",
                (Object) Map.of("username", sender.getUsername(), "channel", channel));
    }

    // REST APIs
    @GetMapping("/messages/{channel}")
    public ResponseEntity<?> getMessages(@PathVariable String channel, Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).body("Unauthorized");
        User user = userRepository.findByUsername(principal.getName()).orElse(null);
        if (user == null)
            return ResponseEntity.status(401).body("User not found");

        if (!canAccessChannel(user, channel))
            return ResponseEntity.status(403).body("Forbidden");

        List<Message> allMessages = messageRepository.findByChannelOrderByTimestampAsc(channel);

        if (user.getArchiveUnlocked() != null && user.getArchiveUnlocked()) {
            return ResponseEntity.ok(allMessages);
        } else {
            java.util.Calendar cal = java.util.Calendar.getInstance();
            cal.add(java.util.Calendar.DAY_OF_MONTH, -1);
            cal.set(java.util.Calendar.HOUR_OF_DAY, 0);
            cal.set(java.util.Calendar.MINUTE, 0);
            cal.set(java.util.Calendar.SECOND, 0);
            Date yesterdayStart = cal.getTime();

            List<Message> filtered = allMessages.stream()
                    .filter(m -> m.getTimestamp().after(yesterdayStart))
                    .collect(java.util.stream.Collectors.toList());
            return ResponseEntity.ok(filtered);
        }
    }

    @GetMapping("/search")
    public ResponseEntity<?> search(@RequestParam(name = "q", required = false) String q, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).body("Unauthorized");
        User user = userRepository.findByUsername(principal.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(401).body("User not found");

        String needle = q == null ? "" : q.trim().toLowerCase();
        if (needle.isEmpty()) return ResponseEntity.ok(java.util.Collections.emptyList());

        // content is encrypted at rest, so filter in-app on the decrypted value
        java.util.List<Map<String, Object>> out = new java.util.ArrayList<>();
        messageRepository.findAll().stream()
                .filter(m -> !Boolean.TRUE.equals(m.getDeleted()))
                .filter(m -> m.getContent() != null && m.getContent().toLowerCase().contains(needle))
                .filter(m -> canAccessChannel(user, m.getChannel()))
                .sorted((a, b) -> b.getTimestamp().compareTo(a.getTimestamp()))
                .limit(50)
                .forEach(m -> {
                    Map<String, Object> dto = new java.util.HashMap<>();
                    dto.put("id", m.getId());
                    dto.put("channel", m.getChannel());
                    dto.put("content", m.getContent());
                    dto.put("timestamp", m.getTimestamp());
                    User sd = m.getSender();
                    Map<String, Object> s = new java.util.HashMap<>();
                    if (sd != null) {
                        s.put("id", sd.getId());
                        s.put("username", sd.getUsername());
                        s.put("displayName", sd.getDisplayName());
                        s.put("avatarUrl", sd.getAvatarUrl());
                    }
                    dto.put("sender", s);
                    out.add(dto);
                });
        return ResponseEntity.ok(out);
    }

    @PostMapping("/unlock-archive")
    public ResponseEntity<?> unlockArchive(
            @org.springframework.web.bind.annotation.RequestBody Map<String, String> payload, Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).body("Unauthorized");
        User user = userRepository.findByUsername(principal.getName()).orElse(null);
        if (user == null)
            return ResponseEntity.status(401).body("User not found");

        if (user.getFailedArchiveAttempts() != null && user.getFailedArchiveAttempts() >= 2) {
            return ResponseEntity.status(403).body("ACCOUNT LOCKED: Maximum archive access attempts exceeded.");
        }

        String passphrase = payload.get("passphrase");
        if ("korokodine".equals(passphrase)) {
            user.setArchiveUnlocked(true);
            userRepository.save(user);
            return ResponseEntity.ok(Map.of("success", true, "message", "Archive unlocked successfully."));
        } else {
            int attempts = (user.getFailedArchiveAttempts() == null ? 0 : user.getFailedArchiveAttempts()) + 1;
            user.setFailedArchiveAttempts(attempts);
            userRepository.save(user);
            return ResponseEntity.status(403).body("ACCESS DENIED. Attempts: " + attempts + "/2");
        }
    }

    @PostMapping("/avatar")
    public ResponseEntity<?> updateAvatar(
            @org.springframework.web.bind.annotation.RequestBody Map<String, String> payload, Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).body("Unauthorized");
        User user = userRepository.findByUsername(principal.getName()).orElse(null);
        if (user == null)
            return ResponseEntity.status(401).body("User not found");

        String avatarUrl = payload.get("avatarUrl");
        if (avatarUrl != null) {
            user.setAvatarUrl(avatarUrl);
            user.setPictureChanged(true);
            userRepository.save(user);
            presence.directoryChanged();
            return ResponseEntity.ok(user);
        }
        return ResponseEntity.badRequest().body("avatarUrl required");
    }

    @PutMapping("/profile")
    public ResponseEntity<?> updateProfile(
            @org.springframework.web.bind.annotation.RequestBody Map<String, String> body, Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).body("Unauthorized");
        User user = userRepository.findByUsername(principal.getName()).orElse(null);
        if (user == null)
            return ResponseEntity.status(401).body("User not found");

        if (body.containsKey("displayName")) {
            String dn = body.get("displayName");
            user.setDisplayName(dn != null && !dn.trim().isEmpty() ? dn.trim() : null);
        }
        if (body.containsKey("bio")) {
            String b = body.get("bio");
            user.setBio(b != null ? b.trim() : null);
        }
        if (body.containsKey("customStatus")) {
            String s = body.get("customStatus");
            user.setCustomStatus(s != null && !s.trim().isEmpty() ? s.trim() : null);
        }
        if (body.containsKey("ringColor")) {
            String c = body.get("ringColor");
            // accept #rgb/#rrggbb (or clear); ignore anything else to stay safe in inline styles
            user.setRingColor(c != null && c.matches("#[0-9a-fA-F]{3,8}") ? c : null);
        }
        userRepository.save(user);
        presence.directoryChanged();
        return ResponseEntity.ok(user);
    }

    /** Newest message time per channel, for unread dots. Only channels the caller may see, and computed in the database. */
    @GetMapping("/channels/latest")
    public ResponseEntity<Map<String, Date>> getLatestTimestamps(Principal principal) {
        User me = principal == null ? null : userRepository.findByUsername(principal.getName()).orElse(null);
        if (me == null) return ResponseEntity.status(401).build();
        org.springframework.data.mongodb.core.aggregation.Aggregation agg = org.springframework.data.mongodb.core.aggregation.Aggregation.newAggregation(
                org.springframework.data.mongodb.core.aggregation.Aggregation.group("channel").max("timestamp").as("latest"));
        Map<String, Date> map = new java.util.HashMap<>();
        for (org.bson.Document d : mongo.aggregate(agg, "messages", org.bson.Document.class).getMappedResults()) {
            String channel = d.getString("_id");
            Date latest = d.getDate("latest");
            if (channel != null && latest != null && canAccessChannel(me, channel)) map.put(channel, latest);
        }
        return ResponseEntity.ok(map);
    }

    @PostMapping("/send")
    public ResponseEntity<?> sendRestMessage(@org.springframework.web.bind.annotation.RequestBody MessageDto messageDto,
            Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).body("Unauthorized");
        User sender = userRepository.findByUsername(principal.getName()).orElse(null);
        if (sender == null)
            return ResponseEntity.status(401).body("User not found");

        if (!canAccessChannel(sender, messageDto.getChannel()))
            return ResponseEntity.status(403).body("Forbidden");

        if ("taskis-bot".equals(messageDto.getChannel()) && !"Taskis Bot".equals(sender.getUsername())) {
            return ResponseEntity.status(403).body("Read-only channel");
        }

        Message message = new Message();
        message.setSender(sender);
        message.setContent(messageDto.getContent());
        message.setChannel(messageDto.getChannel() != null ? messageDto.getChannel() : "general");
        message.setAttachmentUrl(messageDto.getAttachmentUrl());
        message.setAttachmentType(messageDto.getAttachmentType());
        message.setTimestamp(new Date());
        if (messageDto.getReplyToId() != null) {
            messageRepository.findById(messageDto.getReplyToId()).ifPresent(message::setReplyTo);
        }

        Message savedMessage = messageRepository.save(message);
        messagingTemplate.convertAndSend("/topic/" + message.getChannel(), savedMessage);
        pushService.notifyNewMessage(savedMessage);
        // Audit the action + identifiers only — never the payload. Logging message content
        // (even truncated) would copy #confidential/DM text into the flat audit table, which
        // isn't gated by confidentialUnlocked / DM-participant checks.
        auditService.log(sender.getUsername(), "MESSAGE", "SEND_MESSAGE",
                "Sent message in #" + message.getChannel() + " (len="
                        + (message.getContent() == null ? 0 : message.getContent().length()) + ")",
                savedMessage.getId(), "#" + message.getChannel(), null, "SUCCESS");
        return ResponseEntity.ok(savedMessage);
    }

    @GetMapping("/users")
    public ResponseEntity<List<User>> getUsers() {
        List<User> users = userRepository.findAll();
        presence.overlay(users); // live status; changes after this are announced on /topic/presence
        return ResponseEntity.ok(users);
    }

    @PostMapping("/heartbeat")
    public ResponseEntity<?> heartbeat(@org.springframework.web.bind.annotation.RequestBody Map<String, String> payload,
            Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).body("Unauthorized");
        User sender = userRepository.findByUsername(principal.getName()).orElse(null);
        if (sender == null)
            return ResponseEntity.status(401).body("User not found");

        presence.beat(sender.getUsername(), payload.get("status"));
        return ResponseEntity.ok().build();
    }

    @PostMapping("/messages/{id}/react")
    public ResponseEntity<?> reactToMessage(@PathVariable Long id, @org.springframework.web.bind.annotation.RequestBody Map<String, String> body, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).body("Unauthorized");
        Message msg = messageRepository.findById(id).orElse(null);
        if (msg == null) return ResponseEntity.notFound().build();

        User user = userRepository.findByUsername(principal.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");
        if (!canAccessChannel(user, msg.getChannel())) return ResponseEntity.status(403).body("Forbidden");

        String emoji = body.get("emoji");
        String username = principal.getName();
        if (emoji == null || emoji.isBlank()) return ResponseEntity.badRequest().body("emoji required");

        try {
            // reactions stored as "emoji1:user1,user2;emoji2:user3"
            String raw = msg.getReactions() == null || msg.getReactions().isBlank() ? "" : msg.getReactions();
            java.util.Map<String, java.util.List<String>> reactions = new java.util.LinkedHashMap<>();
            if (!raw.isBlank()) {
                for (String part : raw.split(";")) {
                    if (part.contains(":")) {
                        String[] kv = part.split(":", 2);
                        java.util.List<String> users = new java.util.ArrayList<>(java.util.Arrays.asList(kv[1].split(",")));
                        users.removeIf(String::isBlank);
                        reactions.put(kv[0], users);
                    }
                }
            }
            reactions.computeIfAbsent(emoji, k -> new java.util.ArrayList<>());
            if (reactions.get(emoji).contains(username)) {
                reactions.get(emoji).remove(username);
                if (reactions.get(emoji).isEmpty()) reactions.remove(emoji);
            } else {
                reactions.get(emoji).add(username);
            }
            StringBuilder sb = new StringBuilder();
            for (java.util.Map.Entry<String, java.util.List<String>> e : reactions.entrySet()) {
                if (sb.length() > 0) sb.append(";");
                sb.append(e.getKey()).append(":").append(String.join(",", e.getValue()));
            }
            msg.setReactions(sb.toString());
            messageRepository.save(msg);
            messagingTemplate.convertAndSend("/topic/" + msg.getChannel(), msg);
            return ResponseEntity.ok(msg);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Error: " + e.getMessage());
        }
    }

    @DeleteMapping("/messages/{id}")
    public ResponseEntity<?> deleteMessage(@PathVariable Long id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).body("Unauthorized");
        Message msg = messageRepository.findById(id).orElse(null);
        if (msg == null) return ResponseEntity.notFound().build();
        User user = userRepository.findByUsername(principal.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");

        boolean isAdmin = "ADMIN".equals(user.getRole());
        if (!msg.getSender().getUsername().equals(principal.getName()) && !isAdmin)
            return ResponseEntity.status(403).body("Forbidden");

        msg.setDeleted(true);
        msg.setContent("[deleted]");
        messageRepository.save(msg);
        messagingTemplate.convertAndSend("/topic/" + msg.getChannel(), msg);
        auditService.log(principal.getName(), "MESSAGE", "DELETE_MESSAGE", "Deleted message " + id + " in #" + msg.getChannel(), id, "#" + msg.getChannel(), null, "SUCCESS");
        return ResponseEntity.ok().build();
    }

    @PutMapping("/messages/{id}")
    public ResponseEntity<?> editMessage(@PathVariable Long id, @org.springframework.web.bind.annotation.RequestBody Map<String, String> body, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).body("Unauthorized");
        Message msg = messageRepository.findById(id).orElse(null);
        if (msg == null) return ResponseEntity.notFound().build();
   if (!msg.getSender().getUsername().equals(principal.getName()))
            return ResponseEntity.status(403).body("Forbidden");

        // Only allow edit if no one else has read it
        String readBy = msg.getReadBy() == null ? "" : msg.getReadBy();
        boolean readByOthers = java.util.Arrays.stream(readBy.split(","))
            .map(String::trim).filter(s -> !s.isEmpty())
            .anyMatch(u -> !u.equals(principal.getName()));
        if (readByOthers)
            return ResponseEntity.status(403).body("Cannot edit: message already read");

    String newContent = body.get("content");
        if (newContent == null || newContent.isBlank()) return ResponseEntity.badRequest().body("content required");
        msg.setContent(newContent);
        msg.setEdited(true);
        messageRepository.save(msg);
        messagingTemplate.convertAndSend("/topic/" + msg.getChannel(), msg);
        auditService.log(principal.getName(), "MESSAGE", "EDIT_MESSAGE", "Edited message " + id + " in #" + msg.getChannel(), id, "#" + msg.getChannel(), null, "SUCCESS");
        return ResponseEntity.ok(msg);
    }

    @PostMapping("/messages/{id}/read")
    public ResponseEntity<?> markRead(@PathVariable Long id, Principal principal) {
    if (principal == null) return ResponseEntity.status(401).body("Unauthorized");
        Message msg = messageRepository.findById(id).orElse(null);
        if (msg == null) return ResponseEntity.notFound().build();
        User reader = userRepository.findByUsername(principal.getName()).orElse(null);
        if (reader == null) return ResponseEntity.status(401).body("Unauthorized");
        if (!canAccessChannel(reader, msg.getChannel())) return ResponseEntity.status(403).body("Forbidden");
        String username = principal.getName();
        String readBy = msg.getReadBy() == null ? "" : msg.getReadBy();
        if (!java.util.Arrays.asList(readBy.split(",")).contains(username)) {
            msg.setReadBy(readBy.isBlank() ? username : readBy + "," + username);
            Message saved = messageRepository.save(msg);
            // Broadcast so senders see read receipts update live.
            messagingTemplate.convertAndSend("/topic/" + saved.getChannel(), saved);
        }
        return ResponseEntity.ok().build();
    }

    @PostMapping("/messages/{id}/pin")
    public ResponseEntity<?> togglePin(@PathVariable Long id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).body("Unauthorized");
        Message msg = messageRepository.findById(id).orElse(null);
        if (msg == null) return ResponseEntity.notFound().build();
        User user = userRepository.findByUsername(principal.getName()).orElse(null);
        if (user == null) return ResponseEntity.status(401).body("Unauthorized");
        if (!canAccessChannel(user, msg.getChannel())) return ResponseEntity.status(403).body("Forbidden");

        msg.setPinned(!(msg.getPinned() != null && msg.getPinned()));
        Message saved = messageRepository.save(msg);
        messagingTemplate.convertAndSend("/topic/" + saved.getChannel(), saved);
        return ResponseEntity.ok(saved);
    }

    @Autowired
    private com.taskis.backend.security.FileCrypto fileCrypto;

    @Autowired
    private com.taskis.backend.storage.FileStore fileStore;

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(@RequestParam("file") MultipartFile file,
                                        @RequestParam(required = false, defaultValue = "general") String channel) {
        try {
            String original = file.getOriginalFilename() == null ? "file" : file.getOriginalFilename();
            String safeName = Paths.get(original).getFileName().toString().replaceAll("[^A-Za-z0-9._-]", "_");
            String type = file.getContentType() == null ? "application/octet-stream" : file.getContentType();

            String id = UUID.randomUUID().toString().replace("-", "");
            // Encrypted as it streams (never the whole file in memory) and stored under the file's id.
            try (java.io.InputStream plain = file.getInputStream(); java.io.InputStream encrypted = fileCrypto.encryptingStream(plain)) {
                fileStore.put(id, encrypted, fileCrypto.encryptedLength(file.getSize()));
            }
            byte[] meta = type.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            fileStore.put(id + ".meta", new java.io.ByteArrayInputStream(meta), meta.length);

            // Confidential channel: UUID-only URL — no filename exposed anywhere
            String url;
            if ("confidential".equals(channel)) {
                url = "/api/files/" + id;
            } else {
                url = "/api/files/" + id + "/" + java.net.URLEncoder.encode(safeName, "UTF-8").replace("+", "%20");
            }

            return ResponseEntity.ok(Map.of("url", url, "type", type));
        } catch (Exception e) {
            return ResponseEntity.badRequest().body("Could not upload file: " + e.getMessage());
        }
    }
}

class MessageDto {
    private String content;
    private String channel;
    private String attachmentUrl;
    private String attachmentType;
    private Long replyToId;

    public String getContent() { return content; }
    public void setContent(String content) { this.content = content; }
    public String getChannel() { return channel; }
    public void setChannel(String channel) { this.channel = channel; }
    public String getAttachmentUrl() { return attachmentUrl; }
    public void setAttachmentUrl(String attachmentUrl) { this.attachmentUrl = attachmentUrl; }
    public String getAttachmentType() { return attachmentType; }
    public void setAttachmentType(String attachmentType) { this.attachmentType = attachmentType; }
    public Long getReplyToId() { return replyToId; }
    public void setReplyToId(Long replyToId) { this.replyToId = replyToId; }
}
