package com.taskis.backend.repositories;

import com.taskis.backend.models.PushUnread;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface PushUnreadRepository extends MongoRepository<PushUnread, String> {
    List<PushUnread> findByUsername(String username);
    Optional<PushUnread> findByUsernameAndChannel(String username, String channel);
    void deleteByUsernameAndChannel(String username, String channel);
}
