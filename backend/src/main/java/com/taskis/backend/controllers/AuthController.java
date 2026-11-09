package com.taskis.backend.controllers;

import com.taskis.backend.models.RegistrationKey;
import com.taskis.backend.models.OtpCode;
import com.taskis.backend.models.User;
import com.taskis.backend.repositories.RegistrationKeyRepository;
import com.taskis.backend.repositories.OtpCodeRepository;
import com.taskis.backend.repositories.UserRepository;
import com.taskis.backend.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Date;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Random;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    @Autowired
    private AuthenticationManager authenticationManager;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RegistrationKeyRepository keyRepository;

    @Autowired
    private OtpCodeRepository otpCodeRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private com.taskis.backend.repositories.MessageRepository messageRepository;

    @Autowired
    private org.springframework.messaging.simp.SimpMessagingTemplate messagingTemplate;

    @Autowired
    private com.taskis.backend.security.BruteForceGuard bruteForce;

    @Autowired
    private com.taskis.backend.services.AuditService auditService;

    @Autowired
    private com.taskis.backend.repositories.RefreshTokenRepository refreshTokens;

    @Autowired
    private com.taskis.backend.services.PresenceService presence;

    /** How long a device stays signed in without being used; every use pushes it out again. */
    @org.springframework.beans.factory.annotation.Value("${taskis.refresh-days:90}")
    private long refreshDays;

    @PostMapping("/access")
    public ResponseEntity<?> access(@RequestBody Map<String, String> body) {
        String token = body.get("token");
        Optional<RegistrationKey> regKeyOpt = keyRepository.findByKeyString(token);
        if (regKeyOpt.isPresent() && !regKeyOpt.get().getIsUsed() && !Boolean.TRUE.equals(regKeyOpt.get().getRevoked())) {
            User user = userRepository.findAll().stream().filter(u -> token.equals(u.getRegistrationKey())).findFirst().orElse(null);
            Map<String, String> res = new HashMap<>();
            res.put("status", "REQUIRES_PASSPHRASE");
            if (user != null) res.put("username", user.getUsername());
            return ResponseEntity.ok(res);
        }
        return ResponseEntity.badRequest().body("Invalid Key");
    }

    @PostMapping("/register")
    public ResponseEntity<?> register(@RequestBody Map<String, String> body,
            jakarta.servlet.http.HttpServletRequest request) {
        String token = body.get("token");
        String passphrase = body.get("passphrase");

        Optional<RegistrationKey> regKeyOpt = keyRepository.findByKeyString(token);
        if (regKeyOpt.isPresent() && !regKeyOpt.get().getIsUsed() && !Boolean.TRUE.equals(regKeyOpt.get().getRevoked())) {
            RegistrationKey rk = regKeyOpt.get();
            rk.setIsUsed(true);
            keyRepository.save(rk);

            User user = userRepository.findAll().stream()
                    .filter(u -> token.equals(u.getRegistrationKey()))
                    .findFirst()
                    .orElse(null);

            if (user != null) {
                user.setPassword(passwordEncoder.encode(passphrase));
                userRepository.save(user);
                presence.directoryChanged();
                auditService.log(user.getUsername(), "AUTH", "REGISTER", "User registered successfully", user.getId(), user.getUsername(), null, "SUCCESS");
                return ResponseEntity.ok(generateAuthResponse(user, request));
            }
        }
        return ResponseEntity.badRequest().body("Registration failed");
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body,
            jakarta.servlet.http.HttpServletRequest request) {
        String username = body.get("username");
        String passphrase = body.get("passphrase");

        String key = "login:" + request.getRemoteAddr();
        long wait = bruteForce.retryAfterMs(key);
        if (wait > 0) {
            long secs = (wait + 999) / 1000;
            return ResponseEntity.status(429).header("Retry-After", String.valueOf(secs))
                    .body("Too many attempts. Try again in " + secs + "s.");
        }

        String ident = username == null ? "" : username.trim();
        User user = userRepository.findByUsername(ident).orElse(null);
        if (user == null && ident.contains("@")) {
            user = userRepository.findByEmail(ident).orElseGet(() -> userRepository.findAll().stream()
                    .filter(u -> ident.equalsIgnoreCase(u.getEmail()))
                    .findFirst().orElse(null));
        }
        if (user != null && passwordEncoder.matches(passphrase, user.getPassword())) {
            if (Boolean.FALSE.equals(user.getActive())) {
                bruteForce.onFailure(key); // deactivated: not a successful auth — keep counting
                auditService.log(username, "AUTH", "LOGIN_BLOCKED", "Login blocked — account deactivated", user.getId(), username, null, "FAILURE");
                return ResponseEntity.status(403).body("This account has been deactivated.");
            }
            bruteForce.onSuccess(key); // fully authenticated — clear the counter
            auditService.log(username, "AUTH", "LOGIN", "Successful login", user.getId(), username, null, "SUCCESS");
            return ResponseEntity.ok(generateAuthResponse(user, request));
        }
        bruteForce.onFailure(key);
        auditService.log(username, "AUTH", "LOGIN_FAILED", "Failed login attempt for username: " + username, null, username, null, "FAILURE");
        return ResponseEntity.badRequest().body("Invalid credentials");
    }

    private Map<String, Object> generateAuthResponse(User user, jakarta.servlet.http.HttpServletRequest request) {
        String jwt = jwtUtil.generateToken(user.getUsername());
        Map<String, Object> response = new HashMap<>();
        response.put("status", "AUTHENTICATED");
        response.put("token", jwt);
        response.put("fileToken", jwtUtil.generateFileToken(user.getUsername()));
        response.put("refreshToken", issueRefreshToken(user.getUsername(), request.getHeader("User-Agent")));
        response.put("user", user);
        return response;
    }

    private static String sha256(String value) {
        try {
            byte[] d = java.security.MessageDigest.getInstance("SHA-256").digest(value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
            return java.util.HexFormat.of().formatHex(d);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private String issueRefreshToken(String username, String userAgent) {
        byte[] raw = new byte[32];
        new java.security.SecureRandom().nextBytes(raw);
        String token = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(raw);
        com.taskis.backend.models.RefreshToken rt = new com.taskis.backend.models.RefreshToken();
        rt.setTokenHash(sha256(token));
        rt.setUsername(username);
        rt.setDevice(userAgent == null ? null : userAgent.substring(0, Math.min(userAgent.length(), 200)));
        rt.setExpiresAt(new Date(System.currentTimeMillis() + refreshDays * 86_400_000L));
        refreshTokens.save(rt);
        return token;
    }

    /** Swap a valid refresh token for a fresh session token. The device stays signed in as long as it's used within the window. */
    @PostMapping("/refresh")
    public ResponseEntity<?> refresh(@RequestBody Map<String, String> body) {
        String token = body.get("refreshToken");
        if (token == null || token.isBlank()) return ResponseEntity.status(401).body("Invalid session");
        com.taskis.backend.models.RefreshToken rt = refreshTokens.findByTokenHash(sha256(token)).orElse(null);
        if (rt == null) return ResponseEntity.status(401).body("Invalid session");
        long now = System.currentTimeMillis();
        User user = rt.getExpiresAt().getTime() < now ? null : userRepository.findByUsername(rt.getUsername()).orElse(null);
        if (user == null || Boolean.FALSE.equals(user.getActive())) {
            refreshTokens.delete(rt);
            return ResponseEntity.status(401).body("Invalid session");
        }
        rt.setLastUsedAt(new Date(now));
        rt.setExpiresAt(new Date(now + refreshDays * 86_400_000L));
        refreshTokens.save(rt);
        Map<String, Object> res = new HashMap<>();
        res.put("token", jwtUtil.generateToken(user.getUsername()));
        res.put("fileToken", jwtUtil.generateFileToken(user.getUsername()));
        res.put("user", user);
        return ResponseEntity.ok(res);
    }

    /** Sign this device out for good. */
    @PostMapping("/logout")
    public ResponseEntity<?> logout(@RequestBody Map<String, String> body) {
        String token = body.get("refreshToken");
        if (token != null && !token.isBlank()) {
            refreshTokens.findByTokenHash(sha256(token)).ifPresent(refreshTokens::delete);
        }
        return ResponseEntity.ok(Map.of("status", "OK"));
    }

    /** Issue a fresh file-scoped token for an already-authenticated session
        (covers sessions created before file tokens existed). */
    @GetMapping("/file-token")
    public ResponseEntity<?> fileToken(java.security.Principal principal) {
        if (principal == null) return ResponseEntity.status(401).body("Unauthorized");
        return ResponseEntity.ok(Map.of("fileToken", jwtUtil.generateFileToken(principal.getName())));
    }
}
