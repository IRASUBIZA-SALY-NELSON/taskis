package com.taskis.backend.models;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.DBRef;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

@Data
@Document("comments")
public class Comment {
    @Id
    private Long id;

    private Long postId;

    @DBRef
    private User author;

    private String content;

    private Date createdAt = new Date();

    public void setPost(Post post) {
        this.postId = post == null ? null : post.getId();
    }
}
