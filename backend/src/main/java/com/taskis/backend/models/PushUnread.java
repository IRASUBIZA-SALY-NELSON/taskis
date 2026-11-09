package com.taskis.backend.models;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

/** Messages a user has been pushed about but has not opened yet, per channel. Drives the notification count. */
@Data
@Document("push_unread")
public class PushUnread {
    @Id
    private String id;

    @Indexed
    private String username;

    private String channel;

    private int count;
}
