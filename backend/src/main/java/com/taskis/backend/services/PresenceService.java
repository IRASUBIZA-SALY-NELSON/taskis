package com.taskis.backend.services;

import com.taskis.backend.models.User;
import com.taskis.backend.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;

import java.security.Principal;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Who is online, tracked in memory and announced the moment it changes (/topic/presence), so clients never have to ask.
 * A person is ACTIVE when connected with the app in front of them, AWAY when connected but not in front, OFFLINE otherwise.
 * State lives in this process, so it assumes a single backend instance.
 */
@Service
public class PresenceService {

    /** After the last connection drops, wait this long before showing someone offline (covers a quick reconnect). */
    private static final long GRACE_MS = 15_000L;
    /** A connected client that has stopped reporting for this long counts as away. */
    private static final long STALE_MS = 120_000L;
    /** Without a live connection, a recent report still counts as online for this long. */
    private static final long BEAT_TTL_MS = 60_000L;

    private static final class P {
        final Set<String> sessions = ConcurrentHashMap.newKeySet();
        volatile String reported = "ACTIVE";
        volatile long lastBeat;
        volatile long lastDisconnect;
        volatile String announced = "OFFLINE";
    }

    private final Map<String, P> people = new ConcurrentHashMap<>();

    @Autowired private SimpMessagingTemplate messaging;
    @Autowired private UserRepository userRepository;

    @EventListener
    public void onConnected(SessionConnectedEvent e) {
        Principal user = e.getUser();
        String sid = StompHeaderAccessor.wrap(e.getMessage()).getSessionId();
        if (user == null || sid == null) return;
        P p = people.computeIfAbsent(user.getName(), k -> new P());
        p.sessions.add(sid);
        p.lastBeat = System.currentTimeMillis();
        refresh(user.getName());
    }

    @EventListener
    public void onDisconnect(SessionDisconnectEvent e) {
        Principal user = e.getUser();
        if (user == null) return;
        P p = people.get(user.getName());
        if (p == null) return;
        p.sessions.remove(e.getSessionId());
        p.lastDisconnect = System.currentTimeMillis();
        // the sweeper flips them offline after the grace period
    }

    /** The app reports whether it is in front of the person (ACTIVE) or not (AWAY). */
    public void beat(String username, String reported) {
        P p = people.computeIfAbsent(username, k -> new P());
        p.reported = "AWAY".equals(reported) ? "AWAY" : "ACTIVE";
        p.lastBeat = System.currentTimeMillis();
        refresh(username);
    }

    public String statusOf(String username) {
        P p = people.get(username);
        if (p == null) return "OFFLINE";
        long now = System.currentTimeMillis();
        if (!p.sessions.isEmpty()) return now - p.lastBeat > STALE_MS ? "AWAY" : p.reported;
        boolean justLeft = now - p.lastDisconnect < GRACE_MS;
        boolean reporting = p.lastBeat > p.lastDisconnect && now - p.lastBeat < BEAT_TTL_MS;
        return justLeft || reporting ? p.reported : "OFFLINE";
    }

    public boolean isActive(String username) {
        return "ACTIVE".equals(statusOf(username));
    }

    public long onlineCount() {
        return people.keySet().stream().filter(u -> !"OFFLINE".equals(statusOf(u))).count();
    }

    /** Fills in the live status on a list of users before it is sent to a client. */
    public void overlay(List<User> users) {
        for (User u : users) u.setStatus(statusOf(u.getUsername()));
    }

    /** Tells every client that names, avatars or the member list changed, so they reload it once. */
    public void directoryChanged() {
        messaging.convertAndSend("/topic/directory", (Object) Map.of("changed", System.currentTimeMillis()));
    }

    @Scheduled(fixedRate = 5_000)
    public void sweep() {
        for (String username : people.keySet()) refresh(username);
    }

    private void refresh(String username) {
        P p = people.get(username);
        if (p == null) return;
        String now = statusOf(username);
        synchronized (p) {
            if (now.equals(p.announced)) return;
            p.announced = now;
        }
        messaging.convertAndSend("/topic/presence", (Object) Map.of("username", username, "status", now));
        userRepository.findByUsername(username).ifPresent(u -> {
            u.setStatus(now);
            u.setLastHeartbeat(new Date());
            userRepository.save(u);
        });
    }
}
