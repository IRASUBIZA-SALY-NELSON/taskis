package com.taskis.backend.repositories;

import com.taskis.backend.models.RegistrationKey;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface RegistrationKeyRepository extends JpaRepository<RegistrationKey, Long> {
    Optional<RegistrationKey> findByKeyString(String keyString);
}
