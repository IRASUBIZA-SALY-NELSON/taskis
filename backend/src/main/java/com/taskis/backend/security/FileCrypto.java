package com.taskis.backend.security;

import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

/** AES-GCM encryption for uploaded files at rest. Key derived from a secret. */
@Component
public class FileCrypto {

    // Set TASKIS_FILE_SECRET to the secret existing uploads were encrypted with; changing it
    // (or the JWT_SECRET it falls back to) makes already-stored files undecryptable.
    @Value("${taskis.file-secret:${jwt.secret:taskis-default-file-secret}}")
    private String secret;

    private SecretKeySpec key;
    private final SecureRandom rng = new SecureRandom();

    @PostConstruct
    public void init() throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(secret.getBytes(StandardCharsets.UTF_8));
        key = new SecretKeySpec(digest, "AES");
    }

    public byte[] encrypt(byte[] data) throws Exception {
        byte[] iv = new byte[12];
        rng.nextBytes(iv);
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(128, iv));
        byte[] ct = c.doFinal(data);
        byte[] out = new byte[iv.length + ct.length];
        System.arraycopy(iv, 0, out, 0, iv.length);
        System.arraycopy(ct, 0, out, iv.length, ct.length);
        return out;
    }

    public byte[] decrypt(byte[] blob) throws Exception {
        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, java.util.Arrays.copyOfRange(blob, 0, 12)));
        return c.doFinal(blob, 12, blob.length - 12);
    }
}
