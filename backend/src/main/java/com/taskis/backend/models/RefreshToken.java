package com.taskis.backend.models;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

/** One signed-in device. Only the SHA-256 of the token is stored, never the token itself. */
@Data
@Document("refresh_tokens")
public class RefreshToken {
    @Id
    private String id;

    @Indexed(unique = true)
    private String tokenHash;

    @Indexed
    private String username;

    private String device;

    private Date createdAt = new Date();

    private Date lastUsedAt = new Date();

    private Date expiresAt;
}
