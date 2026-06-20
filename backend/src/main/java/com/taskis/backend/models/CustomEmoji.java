package com.taskis.backend.models;

import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;

@Data
@Entity
@Table(name = "custom_emojis")
public class CustomEmoji {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String name;

    @Column(length = 1024)
    private String url;

    private String createdBy;

    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt = new Date();
}
