package com.taskis.backend.services;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.util.Date;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class LiveKitTokensTest {

    private static final String SECRET = "0123456789abcdef0123456789abcdef0123";

    private LiveKitTokens configured() {
        LiveKitTokens t = new LiveKitTokens();
        ReflectionTestUtils.setField(t, "url", "wss://demo.livekit.cloud");
        ReflectionTestUtils.setField(t, "apiKey", "APIkey123");
        ReflectionTestUtils.setField(t, "apiSecret", SECRET);
        return t;
    }

    @Test
    void tokenCarriesWhatLiveKitChecks() {
        String jwt = configured().tokenFor("call_abc", "nelson", "Nelson");
        Claims c = Jwts.parserBuilder().setSigningKey(Keys.hmacShaKeyFor(SECRET.getBytes(StandardCharsets.UTF_8)))
                .build().parseClaimsJws(jwt).getBody();
        assertEquals("APIkey123", c.getIssuer());
        assertEquals("nelson", c.getSubject());
        assertEquals("Nelson", c.get("name"));
        assertTrue(c.getExpiration().after(new Date()));
        @SuppressWarnings("unchecked") Map<String, Object> grant = (Map<String, Object>) c.get("video");
        assertEquals("call_abc", grant.get("room"));
        assertEquals(true, grant.get("roomJoin"));
        assertEquals(true, grant.get("canPublish"));
    }

    @Test
    void disabledUntilFullyConfigured() {
        assertFalse(new LiveKitTokens().enabled());
        assertTrue(configured().enabled());
        LiveKitTokens weak = configured();
        ReflectionTestUtils.setField(weak, "apiSecret", "short");
        assertFalse(weak.enabled());
    }
}
