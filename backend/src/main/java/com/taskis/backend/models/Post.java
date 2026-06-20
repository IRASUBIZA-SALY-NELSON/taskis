package com.taskis.backend.models;

import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;

@Data
@Entity
@Table(name = "posts")
public class Post {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne
    @JoinColumn(name = "author_id")
    private User author;

    @Column(length = 1024)
    private String imageUrl;

    @Column(length = 2048)
    private String caption;

    // Comma-separated usernames who liked the post.
    @Column(length = 8192)
    private String likedBy = "";

    // Emoji reactions, stored as "emoji:user1,user2;emoji2:user3".
    @Column(length = 8192)
    private String reactions = "";

    @Temporal(TemporalType.TIMESTAMP)
    private Date createdAt = new Date();
}
