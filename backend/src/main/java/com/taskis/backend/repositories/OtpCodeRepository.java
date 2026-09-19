package com.taskis.backend.repositories;

import com.taskis.backend.models.OtpCode;
import org.springframework.data.mongodb.repository.MongoRepository;
import java.util.List;
import java.util.Optional;

public interface OtpCodeRepository extends MongoRepository<OtpCode, Long> {
    Optional<OtpCode> findByEmailAndOtp(String email, String otp);
    List<OtpCode> findByEmail(String email);
}
