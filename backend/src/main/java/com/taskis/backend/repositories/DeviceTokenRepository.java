package com.taskis.backend.repositories;

import com.taskis.backend.models.DeviceToken;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface DeviceTokenRepository extends MongoRepository<DeviceToken, String> {
    Optional<DeviceToken> findByToken(String token);
    List<DeviceToken> findByUsername(String username);
}
