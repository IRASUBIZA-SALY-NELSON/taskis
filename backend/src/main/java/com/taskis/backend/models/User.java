package com.taskis.backend.models;

import jakarta.persistence.*;
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

    @Convert(converter = com.taskis.backend.security.StringCryptoConverter.class)
    @Column(unique = true)
    private String email;

    private String role = "USER";

    @Convert(converter = com.taskis.backend.security.StringCryptoConverter.class)
    private String registrationKey;

    @Column(nullable = false)
    private String password;

    @Convert(converter = com.taskis.backend.security.StringCryptoConverter.class)
    @Column(length = 1024)
    private String avatarUrl;

    @Convert(converter = com.taskis.backend.security.StringCryptoConverter.class)
    private String status = "OFFLINE";

    private Boolean archiveUnlocked = false;

    private Integer failedArchiveAttempts = 0;

    private Boolean pictureChanged = false;

    private Boolean active = true;

    private String displayName;

    @Column(length = 512)
    private String bio;

    // Free-form custom status, e.g. "🌴 On leave" — visible to teammates.
    @Column(length = 120)
    private String customStatus;

    @Temporal(TemporalType.TIMESTAMP)
    private Date lastHeartbeat;

    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt = new Date();
}
