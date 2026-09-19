package com.taskis.backend.models;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

@Data
@Document("audit_logs")
public class AuditLog {
    @Id
    private Long id;

    private String actor;

    private String category;

    private String action;

    private String detail;

    private Long targetId;

    private String targetName;

    private String ipAddress;

    private String result = "SUCCESS";

    private Date timestamp = new Date();
}
