package com.taskis.backend.repositories;

import com.taskis.backend.models.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {
    List<Message> findByChannelOrderByTimestampAsc(String channel);

    List<Message> findByChannel(String channel);

    List<Message> findByChannelStartingWith(String prefix);

    void deleteByTimestampBefore(java.util.Date date);

    @org.springframework.data.jpa.repository.Query("SELECT m.channel, MAX(m.timestamp) FROM Message m GROUP BY m.channel")
    java.util.List<Object[]> findLatestTimestamps();
}
