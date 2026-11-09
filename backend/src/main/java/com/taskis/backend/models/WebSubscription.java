package com.taskis.backend.models;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

/** A browser (on a computer or phone) that agreed to receive Web Push notifications for a user. */
@Data
@Document("web_subscriptions")
public class WebSubscription {
    @Id
    private String id;

    @Indexed(unique = true)
    private String endpoint;

    private String p256dh;

    private String auth;

    @Indexed
    private String username;

    private String userAgent;

    private Date createdAt = new Date();
}
