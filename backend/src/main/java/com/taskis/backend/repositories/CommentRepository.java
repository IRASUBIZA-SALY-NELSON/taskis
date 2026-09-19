package com.taskis.backend.repositories;

import com.taskis.backend.models.Comment;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface CommentRepository extends MongoRepository<Comment, Long> {
    List<Comment> findByPostIdOrderByCreatedAtAsc(Long postId);
    long countByPostId(Long postId);
    void deleteByPostId(Long postId);
}
