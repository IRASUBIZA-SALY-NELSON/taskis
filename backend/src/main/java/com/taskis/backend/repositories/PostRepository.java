package com.taskis.backend.repositories;

import com.taskis.backend.models.Post;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Date;
import java.util.List;

public interface PostRepository extends JpaRepository<Post, Long> {
    List<Post> findAllByOrderByCreatedAtDesc();
    List<Post> findByCreatedAtAfterOrderByCreatedAtDesc(Date cutoff);
    List<Post> findByCreatedAtBefore(Date cutoff);
}
