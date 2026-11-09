package com.taskis.backend.services;

import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;

/**
 * Mints the short-lived tokens LiveKit Cloud expects (a plain HS256 JWT). The API secret stays on
 * the server; clients only ever get a token for the one room they were invited to.
 */
@Component
public class LiveKitTokens {

    private static final long TTL_MS = 2 * 3600_000L;

    @Value("${livekit.url:}")
    private String url = "";
    @Value("${livekit.api-key:}")
    private String apiKey = "";
    @Value("${livekit.api-secret:}")
    private String apiSecret = "";

    public boolean enabled() {
        return !url.isBlank() && !apiKey.isBlank() && apiSecret.length() >= 32;
    }

    public String url() {
        return url;
    }

    public String tokenFor(String room, String identity, String displayName) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .setIssuer(apiKey)
                .setSubject(identity)
                .setNotBefore(new Date(now - 10_000))
                .setExpiration(new Date(now + TTL_MS))
                .claim("name", displayName)
                .claim("video", Map.of("roomJoin", true, "room", room, "canPublish", true, "canSubscribe", true, "canPublishData", true))
                .signWith(Keys.hmacShaKeyFor(apiSecret.getBytes(StandardCharsets.UTF_8)), SignatureAlgorithm.HS256)
                .compact();
    }
}
