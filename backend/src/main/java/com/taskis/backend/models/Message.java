package com.taskis.backend.models;

import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;

@Data
@Entity
@Table(name = "messages")
public class Message {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "sender_id")
    private User sender;

    @Convert(converter = com.taskis.backend.security.StringCryptoConverter.class)
    @Column(length = 2048)
    private String content;

    @Convert(converter = com.taskis.backend.security.StringCryptoConverter.class)
    @Column(length = 1024)
    private String attachmentUrl;

    private String attachmentType;

    private String channel; // "general", "alerts", etc.

    @Temporal(TemporalType.TIMESTAMP)
    private Date timestamp = new Date();
}
