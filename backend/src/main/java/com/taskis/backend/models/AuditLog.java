package com.taskis.backend.models;

import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;

@Data
@Entity
@Table(name = "audit_logs")
public class AuditLog {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Who performed the action (username). */
    private String actor;

    /** Category: AUTH, MESSAGE, USER_MGMT, KEY, ROLE, FILE, REACTION, REPORT, SYSTEM */
    private String category;

    /** Short action name e.g. LOGIN, SEND_MESSAGE, DELETE_USER */
    private String action;

    /** Human-readable detail. */
    @Column(length = 1024)
    private String detail;

    /** Optional target entity id (userId, messageId, etc.) */
    private Long targetId;

    /** Optional target name for display. */
    private String targetName;

    /** Request IP address if available. */
    private String ipAddress;

    /** SUCCESS or FAILURE */
    private String result = "SUCCESS";

    @Temporal(TemporalType.TIMESTAMP)
    private Date timestamp = new Date();
}
