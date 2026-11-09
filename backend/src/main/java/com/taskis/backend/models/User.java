package com.taskis.backend.models;

import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

@Data
@Document("users")
public class User {
    @Id
    private Long id;

    @Indexed(unique = true)
    private String username;

    @JsonIgnore
    @Indexed(unique = true, sparse = true)
    private String email;

    private String role = "USER";

    @JsonIgnore
    private String registrationKey;

    @JsonIgnore
    private String password;

    private String avatarUrl;

    private String status = "OFFLINE";

    @JsonIgnore
    private Boolean archiveUnlocked = false;

    private Boolean confidentialUnlocked = false;

    @JsonIgnore
    private Integer failedArchiveAttempts = 0;

    @JsonIgnore
    private Boolean pictureChanged = false;

    @JsonIgnore
    private Boolean active = true;

    private String displayName;

    private String bio;

    private String customStatus;

    private String ringColor;

    @JsonIgnore
    private Date lastHeartbeat;

    private Date createdAt = new Date();
}
