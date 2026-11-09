package com.taskis.backend.models;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

/** A phone that can receive push notifications for a user. */
@Data
@Document("device_tokens")
public class DeviceToken {
    @Id
    private String id;

    @Indexed(unique = true)
    private String token;

    @Indexed
    private String username;

    private String platform;

    private Date createdAt = new Date();
}
