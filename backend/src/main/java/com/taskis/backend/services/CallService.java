package com.taskis.backend.services;

import com.taskis.backend.models.Message;
import com.taskis.backend.models.User;
import com.taskis.backend.repositories.MessageRepository;
import com.taskis.backend.repositories.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;

/**
 * Ringing and call state for 1-to-1 calls. The media itself flows through LiveKit; this only decides who
 * is calling whom, tells the other phone over the live connection, and leaves a line in the chat.
 * State is in memory, so it assumes a single backend instance.
 */
@Service
public class CallService {

    public static final long RING_MS = 45_000L;

    public static final class Call {
        public final String id = UUID.randomUUID().toString();
        public final String room = "call_" + id.replace("-", "");
        public String channel;
        public String caller;
        public String callee;
        public boolean video;
        public String state = "RINGING"; // RINGING | ANSWERED | ENDED
        public long startedAt = System.currentTimeMillis();
        public long answeredAt;
    }

    @Autowired private SimpMessagingTemplate messaging;
    @Autowired private UserRepository userRepository;
    @Autowired private MessageRepository messageRepository;
    @Autowired private PushService pushService;

    private final Map<String, Call> calls = new ConcurrentHashMap<>();
    private final ScheduledExecutorService timers = Executors.newSingleThreadScheduledExecutor();

    /** The only people who may call each other in a DM channel "dm_<id1>_<id2>" are its two members. */
    public Optional<User> otherParty(User me, String channel) {
        if (channel == null || !channel.startsWith("dm_") || me.getId() == null) return Optional.empty();
        String[] p = channel.split("_");
        if (p.length != 3) return Optional.empty();
        try {
            long a = Long.parseLong(p[1]), b = Long.parseLong(p[2]);
            if (a == b || (me.getId() != a && me.getId() != b)) return Optional.empty();
            return userRepository.findById(me.getId() == a ? b : a);
        } catch (NumberFormatException e) {
            return Optional.empty();
        }
    }

    public synchronized Call start(User caller, User callee, String channel, boolean video) {
        if (activeFor(caller.getUsername()) != null || activeFor(callee.getUsername()) != null) return null;
        Call c = new Call();
        c.channel = channel;
        c.caller = caller.getUsername();
        c.callee = callee.getUsername();
        c.video = video;
        calls.put(c.id, c);

        String name = display(caller);
        messaging.convertAndSendToUser(c.callee, "/queue/calls", Map.of(
                "type", "incoming", "callId", c.id, "channel", channel, "video", video, "from", c.caller, "fromName", name));
        pushService.notifyIncomingCall(c.callee, name, video, c.id, channel);
        timers.schedule(() -> timeout(c.id), RING_MS, TimeUnit.MILLISECONDS);
        return c;
    }

    public synchronized Call accept(String id, String user) {
        Call c = calls.get(id);
        if (c == null || !"RINGING".equals(c.state) || !c.callee.equals(user)) return null;
        c.state = "ANSWERED";
        c.answeredAt = System.currentTimeMillis();
        signal(c.caller, "accepted", c);
        return c;
    }

    public synchronized boolean decline(String id, String user) {
        Call c = calls.get(id);
        if (c == null || !"RINGING".equals(c.state) || !c.callee.equals(user)) return false;
        finish(c);
        signal(c.caller, "declined", c);
        return true;
    }

    /** Either side hangs up. Before an answer that is a cancelled (missed) call, after it a normal ending. */
    public synchronized boolean end(String id, String user) {
        Call c = calls.get(id);
        if (c == null || "ENDED".equals(c.state) || !(c.caller.equals(user) || c.callee.equals(user))) return false;
        String other = c.caller.equals(user) ? c.callee : c.caller;
        if ("RINGING".equals(c.state)) {
            finish(c);
            signal(other, "cancelled", c);
            log(c, "Missed " + (c.video ? "video" : "voice") + " call");
        } else {
            long secs = (System.currentTimeMillis() - c.answeredAt) / 1000;
            finish(c);
            signal(other, "ended", c);
            log(c, (c.video ? "Video" : "Voice") + " call · " + String.format("%d:%02d", secs / 60, secs % 60));
        }
        return true;
    }

    public Call pendingFor(String user) {
        for (Call c : calls.values()) {
            if ("RINGING".equals(c.state) && c.callee.equals(user)) return c;
        }
        return null;
    }

    public Call activeFor(String user) {
        for (Call c : calls.values()) {
            if (!"ENDED".equals(c.state) && (c.caller.equals(user) || c.callee.equals(user))) return c;
        }
        return null;
    }

    public Call get(String id) {
        return calls.get(id);
    }

    private synchronized void timeout(String id) {
        Call c = calls.get(id);
        if (c == null || !"RINGING".equals(c.state)) return;
        finish(c);
        signal(c.caller, "missed", c);
        signal(c.callee, "missed", c);
        log(c, "Missed " + (c.video ? "video" : "voice") + " call");
    }

    private void finish(Call c) {
        c.state = "ENDED";
        timers.schedule(() -> calls.remove(c.id), 60, TimeUnit.SECONDS);
    }

    private void signal(String user, String type, Call c) {
        messaging.convertAndSendToUser(user, "/queue/calls", Map.of("type", type, "callId", c.id));
    }

    private void log(Call c, String text) {
        userRepository.findByUsername(c.caller).ifPresent(sender -> {
            Message m = new Message();
            m.setSender(sender);
            m.setContent("📞 " + text);
            m.setChannel(c.channel);
            m.setTimestamp(new Date());
            Message saved = messageRepository.save(m);
            messaging.convertAndSend("/topic/" + c.channel, saved);
        });
    }

    private static String display(User u) {
        return u.getDisplayName() != null && !u.getDisplayName().isBlank() ? u.getDisplayName() : u.getUsername();
    }
}
