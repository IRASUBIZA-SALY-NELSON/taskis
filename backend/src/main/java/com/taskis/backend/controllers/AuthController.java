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
    private com.taskis.backend.services.AuditService auditService;

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
    public ResponseEntity<?> register(@RequestBody Map<String, String> body) {
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
                auditService.log(user.getUsername(), "AUTH", "REGISTER", "User registered successfully", user.getId(), user.getUsername(), null, "SUCCESS");
                return ResponseEntity.ok(generateAuthResponse(user));
            }
        }
        return ResponseEntity.badRequest().body("Registration failed");
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String passphrase = body.get("passphrase");

        User user = userRepository.findByUsername(username).orElse(null);
        if (user != null && passwordEncoder.matches(passphrase, user.getPassword())) {
            if (Boolean.FALSE.equals(user.getActive())) {
                auditService.log(username, "AUTH", "LOGIN_BLOCKED", "Login blocked — account deactivated", user.getId(), username, null, "FAILURE");
                return ResponseEntity.status(403).body("This account has been deactivated.");
            }
            auditService.log(username,"AUTH", "LOGIN", "Successful login", user.getId(), username, null, "SUCCESS");
            return ResponseEntity.ok(generateAuthResponse(user));
        }
        auditService.log(username, "AUTH", "LOGIN_FAILED", "Failed login attempt for username: " + username, null, username, null, "FAILURE");
        return ResponseEntity.badRequest().body("Invalid credentials");
    }

    private Map<String, Object> generateAuthResponse(User user) {
        String jwt = jwtUtil.generateToken(user.getUsername());
        Map<String, Object> response = new HashMap<>();
        response.put("status", "AUTHENTICATED");
        response.put("token", jwt);
        response.put("user", user);
        return response;
    }
}
