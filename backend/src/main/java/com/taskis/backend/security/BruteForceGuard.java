package com.taskis.backend.security;

import org.springframework.stereotype.Component;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Simple in-memory brute-force throttle. After THRESHOLD failures for a key
 * (e.g. an IP for login, a username for the confidential passkey), each further
 * failure imposes an escalating lockout. A success clears the key. The counter
 * resets after a window of inactivity.
 */
@Component
public class BruteForceGuard {

    private static final int THRESHOLD = 6;
    private static final long BASE_LOCK_MS = 30_000L;
    private static final long MAX_LOCK_MS = 10 * 60_000L;
    private static final long WINDOW_MS = 15 * 60_000L;

    private static final class Rec {
        int fails;
        long last;
        long lockedUntil;
    }

    private final Map<String, Rec> recs = new ConcurrentHashMap<>();

    /** @return milliseconds the caller must wait before retrying, or 0 if allowed. */
    public synchronized long retryAfterMs(String key) {
        Rec r = recs.get(key);
        if (r == null) return 0;
        long now = System.currentTimeMillis();
        return r.lockedUntil > now ? r.lockedUntil - now : 0;
    }

    public synchronized void onFailure(String key) {
        long now = System.currentTimeMillis();
        Rec r = recs.computeIfAbsent(key, k -> new Rec());
        if (now - r.last > WINDOW_MS) r.fails = 0;
        r.last = now;
        r.fails++;
        if (r.fails > THRESHOLD) {
            long over = r.fails - THRESHOLD;
            r.lockedUntil = now + Math.min(BASE_LOCK_MS * (1L << Math.min(over - 1, 6)), MAX_LOCK_MS);
        }
    }

    public synchronized void onSuccess(String key) {
        recs.remove(key);
    }
}
