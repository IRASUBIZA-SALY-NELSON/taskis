package com.taskis.backend.models;

import jakarta.persistence.*;
import lombok.Data;
import java.util.Date;

@Data
@Entity
@Table(name = "otp_codes")
public class OtpCode {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String email;

    @Column(nullable = false)
    private String otp;

    @Temporal(TemporalType.TIMESTAMP)
    private Date expiresAt;
}
