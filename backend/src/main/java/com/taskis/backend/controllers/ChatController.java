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

    // WebSocket Message Handling
    @MessageMapping("/chat.send")
    public void sendMessage(@Payload MessageDto messageDto, Principal principal) {
        User sender = userRepository.findByUsername(principal.getName()).orElse(null);
        if (sender == null)
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
    }

    // REST APIs
    @GetMapping("/messages/{channel}")
    public ResponseEntity<?> getMessages(@PathVariable String channel, Principal principal) {
        if (principal == null)
            return ResponseEntity.status(401).body("Unauthorized");
        User user = userRepository.findByUsername(principal.getName()).orElse(null);
        if (user == null)
            return ResponseEntity.status(401).body("User not found");

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
            return ResponseEntity.ok(user);
        }
        return ResponseEntity.badRequest().body("avatarUrl required");
    }

    @GetMapping("/channels/latest")
    public ResponseEntity<Map<String, Date>> getLatestTimestamps() {
        List<Object[]> results = messageRepository.findLatestTimestamps();
        Map<String, Date> map = new java.util.HashMap<>();
        for (Object[] r : results) {
            map.put((String) r[0], (Date) r[1]);
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

        Message savedMessage = messageRepository.save(message);

        // Notify via websocket just in case
        messagingTemplate.convertAndSend("/topic/" + message.getChannel(), savedMessage);

        return ResponseEntity.ok(savedMessage);
    }

    @GetMapping("/users")
    public ResponseEntity<List<User>> getUsers() {
        List<User> users = userRepository.findAll();
        // Calculate true active status
        long now = System.currentTimeMillis();
        for (User user : users) {
            if (user.getLastHeartbeat() != null && "ACTIVE".equals(user.getStatus())) {
                if (now - user.getLastHeartbeat().getTime() > 10000) {
                    user.setStatus("AWAY"); // Or offline
                }
            } else if (user.getLastHeartbeat() == null) {
                user.setStatus("OFFLINE");
            }
        }
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

        String status = payload.get("status");
        sender.setStatus(status != null ? status : "ACTIVE");
        sender.setLastHeartbeat(new Date());
        userRepository.save(sender);

        return ResponseEntity.ok().build();
    }

    @PostMapping("/upload")
    public ResponseEntity<?> uploadFile(@RequestParam("file") MultipartFile file) {
        try {
            String uploadDir = "/home/minister/Documents/taskis/backend/uploads/";
            Files.createDirectories(Paths.get(uploadDir));

            String fileName = UUID.randomUUID().toString() + "_" + file.getOriginalFilename();
            Path filePath = Paths.get(uploadDir + fileName);
            Files.copy(file.getInputStream(), filePath);

            return ResponseEntity.ok(Map.of("url", "/uploads/" + fileName, "type", file.getContentType()));
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

    // Getters and Setters
    public String getContent() {
        return content;
    }

    public void setContent(String content) {
        this.content = content;
    }

    public String getChannel() {
        return channel;
    }

    public void setChannel(String channel) {
        this.channel = channel;
    }

    public String getAttachmentUrl() {
        return attachmentUrl;
    }

    public void setAttachmentUrl(String attachmentUrl) {
        this.attachmentUrl = attachmentUrl;
    }

    public String getAttachmentType() {
        return attachmentType;
    }

    public void setAttachmentType(String attachmentType) {
        this.attachmentType = attachmentType;
    }
}
