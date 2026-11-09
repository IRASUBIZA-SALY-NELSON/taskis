package com.taskis.backend.controllers;

import com.taskis.backend.models.DeviceToken;
import com.taskis.backend.models.User;
import com.taskis.backend.repositories.DeviceTokenRepository;
import com.taskis.backend.repositories.PushUnreadRepository;
import com.taskis.backend.repositories.UserRepository;
import com.taskis.backend.services.PushService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Date;
import java.util.Map;

@RestController
@RequestMapping("/api/push")
public class PushController {

    @Autowired private DeviceTokenRepository deviceTokens;
    @Autowired private PushUnreadRepository unread;
    @Autowired private UserRepository userRepository;
    @Autowired private PushService pushService;

    /** Remember this phone for the signed-in user. A phone that switches accounts moves with its token. */
    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body, Principal principal) {
        String token = body.get("token");
        if (principal == null) return ResponseEntity.status(401).build();
        if (token == null || token.isBlank() || token.length() > 4096) return ResponseEntity.badRequest().body("token required");
        DeviceToken d = deviceTokens.findByToken(token).orElseGet(DeviceToken::new);
        d.setToken(token);
        d.setUsername(principal.getName());
        d.setPlatform(body.getOrDefault("platform", "android"));
        if (d.getCreatedAt() == null) d.setCreatedAt(new Date());
        deviceTokens.save(d);
        return ResponseEntity.ok(Map.of("status", "OK"));
    }

    /** Stop pushing to this phone (logout). Only removes a token the caller owns. */
    @PostMapping("/unregister")
    public ResponseEntity<?> unregister(@RequestBody Map<String, String> body, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        String token = body.get("token");
        if (token != null) {
            deviceTokens.findByToken(token).filter(d -> principal.getName().equals(d.getUsername())).ifPresent(deviceTokens::delete);
        }
        return ResponseEntity.ok(Map.of("status", "OK"));
    }

    /** The user opened this conversation: restart its unread count from zero. */
    @PostMapping("/seen")
    public ResponseEntity<?> seen(@RequestBody Map<String, String> body, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        String channel = body.get("channel");
        if (channel != null && !channel.isBlank()) unread.deleteByUsernameAndChannel(principal.getName(), channel);
        return ResponseEntity.ok(Map.of("status", "OK"));
    }

    @GetMapping("/prefs")
    public ResponseEntity<?> prefs(Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        User u = userRepository.findByUsername(principal.getName()).orElse(null);
        if (u == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(Map.of("hideContent", !Boolean.FALSE.equals(u.getHidePushContent()), "pushConfigured", pushService.enabled()));
    }

    @PutMapping("/prefs")
    public ResponseEntity<?> setPrefs(@RequestBody Map<String, Object> body, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        User u = userRepository.findByUsername(principal.getName()).orElse(null);
        if (u == null) return ResponseEntity.status(401).build();
        if (body.get("hideContent") instanceof Boolean hide) {
            u.setHidePushContent(hide);
            userRepository.save(u);
        }
        return ResponseEntity.ok(Map.of("hideContent", !Boolean.FALSE.equals(u.getHidePushContent())));
    }
}
