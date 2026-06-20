package com.taskis.backend.repositories;

import com.taskis.backend.models.CustomEmoji;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface CustomEmojiRepository extends JpaRepository<CustomEmoji, Long> {
    Optional<CustomEmoji> findByName(String name);
    List<CustomEmoji> findAllByOrderByNameAsc();
}
