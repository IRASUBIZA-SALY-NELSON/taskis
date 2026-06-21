package com.taskis.backend.repositories;

import com.taskis.backend.models.Report;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface ReportRepository extends JpaRepository<Report, Long> {
    List<Report> findAllByOrderByResolvedAscCreatedAtDesc();
}
