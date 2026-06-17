package com.taskis.backend.config;

import com.taskis.backend.repositories.MessageRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

@Configuration
@EnableScheduling
public class ScheduledTasks {

    @Autowired
    private MessageRepository messageRepository;

    // Auto-deletion removed as per request
}
