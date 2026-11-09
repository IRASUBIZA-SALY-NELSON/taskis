package com.taskis.backend.repositories;

import com.taskis.backend.models.WebSubscription;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;
import java.util.Optional;

public interface WebSubscriptionRepository extends MongoRepository<WebSubscription, String> {
    Optional<WebSubscription> findByEndpoint(String endpoint);
    List<WebSubscription> findByUsername(String username);
}
