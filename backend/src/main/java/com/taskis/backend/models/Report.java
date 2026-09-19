package com.taskis.backend.models;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

@Data
@Document("reports")
public class Report {
    @Id
    private Long id;

    private String type;

    private Long targetId;

    private String reportedBy;

    private String reason;

    private String snapshot;

    private String authorName;

    private Boolean resolved = false;

    private Date createdAt = new Date();
}
