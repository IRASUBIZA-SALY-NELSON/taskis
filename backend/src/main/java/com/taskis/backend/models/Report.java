package com.taskis.backend.models;

import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;

@Data
@Entity
@Table(name = "reports")
public class Report {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String type; // "message" | "post"

    private Long targetId;

    private String reportedBy;

    @Column(length = 512)
    private String reason;

    // snapshot of the reported content + author, so admins still see context if it's deleted
    @Column(length = 4096)
    private String snapshot;

    private String authorName;

    private Boolean resolved = false;

    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt = new Date();
}
