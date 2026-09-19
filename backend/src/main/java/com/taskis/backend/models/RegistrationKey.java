package com.taskis.backend.models;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

@Data
@Document("registration_keys")
public class RegistrationKey {
    @Id
    private Long id;

    @Indexed(unique = true)
    private String keyString;

    private Boolean isUsed = false;

    private Boolean revoked = false;

    private Date createdAt = new Date();
}
