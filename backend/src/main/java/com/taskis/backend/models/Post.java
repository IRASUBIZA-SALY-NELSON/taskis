package com.taskis.backend.models;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

@Data
@Document("posts")
public class Post {
    @Id
    private Long id;

    @DBRef
    private User author;

    private String imageUrl;

    private String caption;

    private String likedBy = "";

    private String dislikedBy = "";

    private String reactions = "";

    private Date createdAt = new Date();
}
