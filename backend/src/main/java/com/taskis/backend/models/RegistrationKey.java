package com.taskis.backend.models;

import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;

@Data
@Entity
@Table(name = "registration_keys")
public class RegistrationKey {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String keyString;

    private Boolean isUsed = false;

    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt = new Date();
}
