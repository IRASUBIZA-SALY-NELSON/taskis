package com.taskis.backend.config;

import com.taskis.backend.models.User;
import com.taskis.backend.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Optional;

@Component
public class DatabaseSeeder implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    /**
     * Ensures a local admin exists on every boot so the app is usable out of the box.
     * Username: nelson. Override this in production rather than keeping the seed password.
     */
    @Override
    public void run(String... args) throws Exception {
        Optional<User> nelsonOpt = userRepository.findByUsername("nelson");
        if (nelsonOpt.isEmpty()) {
            User nelson = new User();
            nelson.setUsername("nelson");
            nelson.setEmail("irasubizasalynelson@gmail.com");
            nelson.setPassword(passwordEncoder.encode("205400"));
            nelson.setRole("ADMIN");
            nelson.setStatus("ACTIVE");
            nelson.setAvatarUrl("https://api.dicebear.com/7.x/bottts/svg?seed=nelson");
            userRepository.save(nelson);
            System.out.println("=========================================");
            System.out.println("Seeded admin user: nelson");
            System.out.println("=========================================");
        } else {
            // Update password if it already exists, to ensure it matches the new request
            User nelson = nelsonOpt.get();
            nelson.setPassword(passwordEncoder.encode("205400"));
            nelson.setRole("ADMIN");
            userRepository.save(nelson);
            System.out.println("=========================================");
            System.out.println("Updated admin user: nelson");
            System.out.println("=========================================");
        }
    }
}
