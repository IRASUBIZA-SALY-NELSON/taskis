package com.taskis.backend.models;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;
import java.util.Date;

@Data
@Entity
@Table(name = "users")
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Convert(converter = com.taskis.backend.security.StringCryptoConverter.class)
    @Column(unique = true, nullable = false)
    private String username;

    @JsonIgnore
    @Convert(converter = com.taskis.backend.security.StringCryptoConverter.class)
    @Column(unique = true)
    private String email;

    private String role = "USER";

    @JsonIgnore
    @Convert(converter = com.taskis.backend.security.StringCryptoConverter.class)
    private String registrationKey;

    @JsonIgnore
    @Column(nullable = false)
    private String password;

    @Convert(converter = com.taskis.backend.security.StringCryptoConverter.class)
    @Column(length = 1024)
    private String avatarUrl;

    @Convert(converter = com.taskis.backend.security.StringCryptoConverter.class)
    private String status = "OFFLINE";

    // Internal security flags — never serialize to clients (would reveal who holds
    // the secret archive / confidential access and lockout state to anyone reading a channel).
    @JsonIgnore
    private Boolean archiveUnlocked = false;

    // Server-side gate for #confidential — set only after the correct passkey.
    // Kept serialized: the client uses it to decide whether to re-prompt for the passkey.
    private Boolean confidentialUnlocked = false;

    @JsonIgnore
    private Integer failedArchiveAttempts = 0;

    @JsonIgnore
    private Boolean pictureChanged = false;

    @JsonIgnore
    private Boolean active = true;

    private String displayName;

    @Column(length = 512)
    private String bio;

    // Free-form custom status, e.g. "🌴 On leave" — visible to teammates.
    @Column(length = 120)
    private String customStatus;

    // Personal avatar ring color (hex), shown around the user's avatar everywhere.
    @Column(length = 32)
    private String ringColor;

    // Presence is derived server-side into `status`; the raw beat time isn't the client's business.
    @JsonIgnore
    @Temporal(TemporalType.TIMESTAMP)
    private Date lastHeartbeat;

    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt = new Date();
}
