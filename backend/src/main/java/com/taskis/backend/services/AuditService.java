package com.taskis.backend.services;

import com.taskis.backend.models.AuditLog;
import com.taskis.backend.repositories.AuditLogRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
public class AuditService {

    @Autowired
    private AuditLogRepository repo;

    public void log(String actor, String category, String action, String detail) {
        log(actor, category, action, detail, null, null, null, "SUCCESS");
    }

    public void log(String actor, String category, String action, String detail,
                    Long targetId, String targetName, String ip, String result) {
        AuditLog entry = new AuditLog();
        entry.setActor(actor != null ? actor : "system");
        entry.setCategory(category);
        entry.setAction(action);
        entry.setDetail(detail);
        entry.setTargetId(targetId);
        entry.setTargetName(targetName);
        entry.setIpAddress(ip);
        entry.setResult(result);
        repo.save(entry);
    }
}
