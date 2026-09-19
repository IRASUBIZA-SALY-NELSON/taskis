package com.taskis.backend.repositories;

import com.taskis.backend.models.CustomEmoji;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

public interface CustomEmojiRepository extends MongoRepository<CustomEmoji, Long> {
    Optional<CustomEmoji> findByName(String name);
    java.util.List<CustomEmoji> findAllByOrderByNameAsc();
}
