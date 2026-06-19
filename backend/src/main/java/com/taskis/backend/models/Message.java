package com.taskis.backend.models;

import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;
import java.util.List;
import java.util.ArrayList;

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

    private String channel;

    @Temporal(TemporalType.TIMESTAMP)
    private Date timestamp = new Date();

    // Reply support
    @ManyToOne
    @JoinColumn(name = "reply_to_id")
    private Message replyTo;

    // Reactions stored as JSON string: {"👍":["alice","bob"],"❤️":["carol"]}
    @Column(length = 2048)
    private String reactions = "{}";

    // Comma-separated usernames who have read this message
    @Column(length = 2048)
    private String readBy = "";

    private Boolean edited = false;

    private Boolean deleted = false;

    private Boolean pinned = false;
}
