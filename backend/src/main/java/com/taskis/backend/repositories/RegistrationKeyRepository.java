package com.taskis.backend.repositories;

import com.taskis.backend.models.RegistrationKey;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.Optional;

public interface RegistrationKeyRepository extends MongoRepository<RegistrationKey, Long> {
    Optional<RegistrationKey> findByKeyString(String keyString);
}
