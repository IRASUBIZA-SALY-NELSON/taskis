package com.taskis.backend.repositories;

import com.taskis.backend.models.Message;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface MessageRepository extends MongoRepository<Message, Long> {
    List<Message> findByChannelOrderByTimestampAsc(String channel);
    List<Message> findByChannel(String channel);
    List<Message> findByChannelStartingWith(String prefix);
    void deleteByTimestampBefore(java.util.Date date);
}
