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

    private Boolean archiveUnlocked = false;

    // Server-side gate for #confidential — set only after the correct passkey.
    private Boolean confidentialUnlocked = false;

    private Integer failedArchiveAttempts = 0;

    private Boolean pictureChanged = false;

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

    @Temporal(TemporalType.TIMESTAMP)
    private Date lastHeartbeat;

    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt = new Date();
}
