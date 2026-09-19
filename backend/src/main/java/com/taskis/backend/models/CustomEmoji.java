package com.taskis.backend.models;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

@Data
@Document("custom_emojis")
public class CustomEmoji {
    @Id
    private Long id;

    @Indexed(unique = true)
    private String name;

    private String url;

    private String createdBy;

    private Date createdAt = new Date();
}
