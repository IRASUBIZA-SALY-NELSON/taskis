package com.taskis.backend.models;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

@Data
@Document("messages")
public class Message {
    @Id
    private Long id;

    @DBRef
    private User sender;

    private String content;

    private String attachmentUrl;

    private String attachmentType;

    private String channel;

    private Date timestamp = new Date();

    @DBRef
    private Message replyTo;

    private String reactions = "{}";

    private String readBy = "";

    private Boolean edited = false;

    private Boolean deleted = false;

    private Boolean pinned = false;
}
