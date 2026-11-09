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
    @Autowired private com.taskis.backend.services.WebPushSender webPush;
    @Autowired private com.taskis.backend.repositories.WebSubscriptionRepository webSubs;

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

    /** The public VAPID key a browser needs to subscribe. */
    @GetMapping("/web/key")
    public ResponseEntity<?> webKey(Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(webPush.keyInfo());
    }

    @SuppressWarnings("unchecked")
    @PostMapping("/web/subscribe")
    public ResponseEntity<?> webSubscribe(@RequestBody Map<String, Object> body, Principal principal,
            @RequestHeader(value = "User-Agent", required = false) String userAgent) {
        if (principal == null) return ResponseEntity.status(401).build();
        String endpoint = body.get("endpoint") instanceof String e ? e : null;
        Map<String, String> keys = body.get("keys") instanceof Map<?, ?> k ? (Map<String, String>) k : Map.of();
        String p256dh = keys.get("p256dh"), auth = keys.get("auth");
        if (endpoint == null || !endpoint.startsWith("https://") || endpoint.length() > 2048 || p256dh == null || auth == null)
            return ResponseEntity.badRequest().body("endpoint and keys required");
        var sub = webSubs.findByEndpoint(endpoint).orElseGet(com.taskis.backend.models.WebSubscription::new);
        sub.setEndpoint(endpoint);
        sub.setP256dh(p256dh);
        sub.setAuth(auth);
        sub.setUsername(principal.getName()); // a browser that switches accounts follows the new one
        sub.setUserAgent(userAgent == null ? null : userAgent.substring(0, Math.min(userAgent.length(), 200)));
        webSubs.save(sub);
        return ResponseEntity.ok(Map.of("status", "OK"));
    }

    @PostMapping("/web/unsubscribe")
    public ResponseEntity<?> webUnsubscribe(@RequestBody Map<String, String> body, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        String endpoint = body.get("endpoint");
        if (endpoint != null) webSubs.findByEndpoint(endpoint).filter(s -> principal.getName().equals(s.getUsername())).ifPresent(webSubs::delete);
        return ResponseEntity.ok(Map.of("status", "OK"));
    }
}
