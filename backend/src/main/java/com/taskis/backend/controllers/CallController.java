package com.taskis.backend.controllers;

import com.taskis.backend.models.User;
import com.taskis.backend.repositories.UserRepository;
import com.taskis.backend.services.CallService;
import com.taskis.backend.services.CallService.Call;
import com.taskis.backend.services.LiveKitTokens;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/api/calls")
public class CallController {

    @Autowired private CallService calls;
    @Autowired private LiveKitTokens livekit;
    @Autowired private UserRepository userRepository;

    private User me(Principal p) {
        return p == null ? null : userRepository.findByUsername(p.getName()).orElse(null);
    }

    /** What the joiner needs to connect: the LiveKit address and a token for exactly this room. */
    private Map<String, Object> joinInfo(Call c, User user, User other) {
        Map<String, Object> m = new HashMap<>();
        m.put("callId", c.id);
        m.put("room", c.room);
        m.put("url", livekit.url());
        m.put("token", livekit.tokenFor(c.room, user.getUsername(),
                user.getDisplayName() != null && !user.getDisplayName().isBlank() ? user.getDisplayName() : user.getUsername()));
        m.put("video", c.video);
        m.put("peer", other.getUsername());
        m.put("peerName", other.getDisplayName() != null && !other.getDisplayName().isBlank() ? other.getDisplayName() : other.getUsername());
        return m;
    }

    @GetMapping("/config")
    public Map<String, Object> config() {
        return Map.of("enabled", livekit.enabled());
    }

    @PostMapping("/start")
    public ResponseEntity<?> start(@RequestBody Map<String, Object> body, Principal principal) {
        User caller = me(principal);
        if (caller == null) return ResponseEntity.status(401).build();
        if (!livekit.enabled()) return ResponseEntity.status(503).body("Calls are not set up yet.");
        String channel = String.valueOf(body.get("channel"));
        boolean video = Boolean.TRUE.equals(body.get("video"));
        Optional<User> callee = calls.otherParty(caller, channel);
        if (callee.isEmpty()) return ResponseEntity.status(403).body("You can only call someone in a direct message.");
        if (Boolean.FALSE.equals(callee.get().getActive())) return ResponseEntity.status(403).body("This account is deactivated.");
        Call c = calls.start(caller, callee.get(), channel, video);
        if (c == null) return ResponseEntity.status(409).body("Someone in this call is already on another call.");
        return ResponseEntity.ok(joinInfo(c, caller, callee.get()));
    }

    @PostMapping("/{id}/accept")
    public ResponseEntity<?> accept(@PathVariable String id, Principal principal) {
        User user = me(principal);
        if (user == null) return ResponseEntity.status(401).build();
        Call c = calls.accept(id, user.getUsername());
        if (c == null) return ResponseEntity.status(410).body("This call is no longer ringing.");
        return ResponseEntity.ok(joinInfo(c, user, userRepository.findByUsername(c.caller).orElse(user)));
    }

    @PostMapping("/{id}/decline")
    public ResponseEntity<?> decline(@PathVariable String id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(Map.of("ok", calls.decline(id, principal.getName())));
    }

    @PostMapping("/{id}/end")
    public ResponseEntity<?> end(@PathVariable String id, Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        return ResponseEntity.ok(Map.of("ok", calls.end(id, principal.getName())));
    }

    /** A call that is ringing for me right now (e.g. I just opened the app from the ring notification). */
    @GetMapping("/pending")
    public ResponseEntity<?> pending(Principal principal) {
        if (principal == null) return ResponseEntity.status(401).build();
        Call c = calls.pendingFor(principal.getName());
        if (c == null) return ResponseEntity.ok(Map.of());
        User caller = userRepository.findByUsername(c.caller).orElse(null);
        return ResponseEntity.ok(Map.of("callId", c.id, "channel", c.channel, "video", c.video, "from", c.caller,
                "fromName", caller != null && caller.getDisplayName() != null && !caller.getDisplayName().isBlank() ? caller.getDisplayName() : c.caller));
    }
}
