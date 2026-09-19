package com.taskis.backend.repositories;

import com.taskis.backend.models.Post;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Date;
import java.util.List;

public interface PostRepository extends MongoRepository<Post, Long> {
    List<Post> findByCreatedAtAfterOrderByCreatedAtDesc(Date cutoff);
    List<Post> findByCreatedAtBefore(Date cutoff);
}
