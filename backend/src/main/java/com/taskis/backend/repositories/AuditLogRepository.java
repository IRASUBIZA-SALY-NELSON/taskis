package com.taskis.backend.repositories;

import com.taskis.backend.models.AuditLog;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Date;
import java.util.List;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {
    List<AuditLog> findAllByOrderByTimestampDesc();
    void deleteByTimestampBefore(Date cutoff);
    List<AuditLog> findByActorOrderByTimestampDesc(String actor);
    List<AuditLog> findByCategoryOrderByTimestampDesc(String category);
}
