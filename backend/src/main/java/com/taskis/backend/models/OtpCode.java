package com.taskis.backend.models;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.util.Date;

@Data
@Document("otp_codes")
public class OtpCode {
    @Id
    private Long id;

    private String email;

    private String otp;

    private Date expiresAt;
}
