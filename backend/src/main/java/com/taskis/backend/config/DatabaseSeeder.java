package com.taskis.backend.config;

import com.taskis.backend.models.User;
import com.taskis.backend.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;
import java.util.Base64;
import java.util.Optional;

@Component
public class DatabaseSeeder implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    /** Optional. When set, it is applied to the admin account on boot (use it to rotate the password). */
    @Value("${taskis.admin.password:}")
    private String adminPassword;

    /**
     * Ensures the admin "nelson" exists. No password lives in source: a new admin gets
     * ADMIN_PASSWORD if set, otherwise a random one printed once to the log. An existing
     * admin keeps the password it has unless ADMIN_PASSWORD is set.
     */
    @Override
    public void run(String... args) throws Exception {
        boolean explicit = adminPassword != null && !adminPassword.isBlank();
        Optional<User> nelsonOpt = userRepository.findByUsername("nelson");
        if (nelsonOpt.isEmpty()) {
            String password = explicit ? adminPassword : randomPassword();
            User nelson = new User();
            nelson.setUsername("nelson");
            nelson.setEmail("irasubizasalynelson@gmail.com");
            nelson.setPassword(passwordEncoder.encode(password));
            nelson.setRole("ADMIN");
            nelson.setStatus("ACTIVE");
            nelson.setAvatarUrl("https://api.dicebear.com/7.x/bottts/svg?seed=nelson");
            userRepository.save(nelson);
            System.out.println("=========================================");
            System.out.println("Seeded admin user: nelson");
            if (!explicit) {
                System.out.println("Generated admin password (shown once, change it after login): " + password);
            }
            System.out.println("=========================================");
        } else {
            User nelson = nelsonOpt.get();
            nelson.setRole("ADMIN");
            if (explicit) nelson.setPassword(passwordEncoder.encode(adminPassword));
            userRepository.save(nelson);
            System.out.println("=========================================");
            System.out.println("Admin user nelson present" + (explicit ? " (password set from ADMIN_PASSWORD)" : ""));
            System.out.println("=========================================");
        }
    }

    private static String randomPassword() {
        byte[] bytes = new byte[18];
        new SecureRandom().nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
