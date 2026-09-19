package com.taskis.backend.repositories;

import com.taskis.backend.models.Report;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;

public interface ReportRepository extends MongoRepository<Report, Long> {
    List<Report> findAllByOrderByResolvedAscCreatedAtDesc();
}
