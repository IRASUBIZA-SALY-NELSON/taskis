package com.taskis.backend.repositories;

import com.taskis.backend.models.AuditLog;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Date;
import java.util.List;

public interface AuditLogRepository extends MongoRepository<AuditLog, Long> {
    void deleteByTimestampBefore(Date cutoff);
    List<AuditLog> findByActorOrderByTimestampDesc(String actor);
    List<AuditLog> findByCategoryOrderByTimestampDesc(String category);
    List<AuditLog> findAllByOrderByTimestampDesc();
}
