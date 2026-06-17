package com.taskis.backend.repositories;

import com.taskis.backend.models.OtpCode;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
import java.util.List;

public interface OtpCodeRepository extends JpaRepository<OtpCode, Long> {
    Optional<OtpCode> findByEmailAndOtp(String email, String otp);

    List<OtpCode> findByEmail(String email);
}
