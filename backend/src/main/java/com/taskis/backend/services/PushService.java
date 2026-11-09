package com.taskis.backend.services;

import com.google.auth.oauth2.GoogleCredentials;
import com.google.firebase.FirebaseApp;
import com.google.firebase.FirebaseOptions;
import com.google.firebase.messaging.AndroidConfig;
import com.google.firebase.messaging.AndroidNotification;
import com.google.firebase.messaging.FirebaseMessaging;
import com.google.firebase.messaging.FirebaseMessagingException;
import com.google.firebase.messaging.MessagingErrorCode;
import com.google.firebase.messaging.Notification;
import com.taskis.backend.models.DeviceToken;
import com.taskis.backend.models.Message;
import com.taskis.backend.models.PushUnread;
import com.taskis.backend.models.User;
import com.taskis.backend.repositories.DeviceTokenRepository;
import com.taskis.backend.repositories.PushUnreadRepository;
import com.taskis.backend.repositories.UserRepository;
import com.taskis.backend.repositories.WebSubscriptionRepository;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Sends a push to every other member's phones when a message arrives. Does nothing until
 * FIREBASE_SERVICE_ACCOUNT (the service-account JSON) is set.
 */
@Service
public class PushService {

    private static final Set<String> BROADCAST_CHANNELS = Set.of("general", "intel", "alerts");

    @Value("${taskis.firebase.service-account:}")
    private String serviceAccountJson;

    @Autowired private UserRepository userRepository;
    @Autowired private DeviceTokenRepository deviceTokens;
    @Autowired private PushUnreadRepository unread;
    @Autowired private WebSubscriptionRepository webSubs;
    @Autowired private WebPushSender webPush;
    @Autowired private PresenceService presence;

    private FirebaseMessaging fcm;
    private final ExecutorService pool = Executors.newFixedThreadPool(2);

    @PostConstruct
    void init() {
        if (serviceAccountJson == null || serviceAccountJson.isBlank()) {
            System.out.println("Push notifications disabled: FIREBASE_SERVICE_ACCOUNT is not set.");
            return;
        }
        try {
            FirebaseOptions options = FirebaseOptions.builder()
                    .setCredentials(GoogleCredentials.fromStream(
                            new ByteArrayInputStream(serviceAccountJson.getBytes(StandardCharsets.UTF_8))))
                    .build();
            FirebaseApp app = FirebaseApp.getApps().isEmpty() ? FirebaseApp.initializeApp(options) : FirebaseApp.getInstance();
            fcm = FirebaseMessaging.getInstance(app);
            System.out.println("Push notifications enabled.");
        } catch (Exception e) {
            System.out.println("Push notifications disabled: could not read FIREBASE_SERVICE_ACCOUNT (" + e.getMessage() + ")");
        }
    }

    public boolean enabled() {
        return fcm != null;
    }

    private boolean anyChannelEnabled() {
        return fcm != null || webPush.enabled();
    }

    /** Fire and forget: never slows down or breaks sending the message itself. */
    public void notifyNewMessage(Message m) {
        if (!anyChannelEnabled() || m == null || m.getSender() == null) return;
        pool.submit(() -> {
            try {
                send(m);
            } catch (Exception e) {
                System.out.println("Push failed: " + e.getMessage());
            }
        });
    }

    /** Ring the callee's phones. Nothing about the call beyond who and whether it is video. */
    public void notifyIncomingCall(String username, String callerName, boolean video, String callId, String channel) {
        if (!anyChannelEnabled()) return;
        pool.submit(() -> {
            for (var b : webPush.enabled() ? webSubs.findByUsername(username) : List.<com.taskis.backend.models.WebSubscription>of()) {
                webPush.send(b, callerName, video ? "Incoming video call" : "Incoming voice call", "call", channel, 0, "call");
            }
            for (DeviceToken t : fcm == null ? List.<DeviceToken>of() : deviceTokens.findByUsername(username)) {
                try {
                    fcm.send(com.google.firebase.messaging.Message.builder()
                            .setToken(t.getToken())
                            .setNotification(Notification.builder().setTitle(callerName)
                                    .setBody(video ? "Incoming video call" : "Incoming voice call").build())
                            .setAndroidConfig(AndroidConfig.builder()
                                    .setPriority(AndroidConfig.Priority.HIGH)
                                    .setTtl(45_000)
                                    .setNotification(AndroidNotification.builder()
                                            .setChannelId("calls")
                                            .setTag("call")
                                            .setDefaultVibrateTimings(true)
                                            .setDefaultSound(true)
                                            .build())
                                    .build())
                            .putAllData(Map.of("type", "call", "callId", callId, "channel", channel))
                            .build());
                } catch (FirebaseMessagingException e) {
                    MessagingErrorCode code = e.getMessagingErrorCode();
                    if (code == MessagingErrorCode.UNREGISTERED || code == MessagingErrorCode.INVALID_ARGUMENT
                            || code == MessagingErrorCode.SENDER_ID_MISMATCH) deviceTokens.delete(t);
                }
            }
        });
    }

    private List<User> recipients(Message m) {
        User sender = m.getSender();
        String channel = m.getChannel();
        List<User> out = new ArrayList<>();
        if (channel == null) return out;
        if (channel.startsWith("dm_")) {
            String[] parts = channel.split("_");
            if (parts.length != 3) return out;
            for (int i = 1; i <= 2; i++) {
                try {
                    long id = Long.parseLong(parts[i]);
                    if (!sender.getId().equals(id)) userRepository.findById(id).ifPresent(out::add);
                } catch (NumberFormatException ignored) { }
            }
        } else if (BROADCAST_CHANNELS.contains(channel)) {
            for (User u : userRepository.findAll()) if (!u.getUsername().equals(sender.getUsername())) out.add(u);
        } else if ("confidential".equals(channel)) {
            for (User u : userRepository.findAll()) {
                if (!u.getUsername().equals(sender.getUsername()) && Boolean.TRUE.equals(u.getConfidentialUnlocked())) out.add(u);
            }
        }
        return out;
    }

    private void send(Message m) {
        String channel = m.getChannel();
        String senderName = m.getSender().getDisplayName() != null && !m.getSender().getDisplayName().isBlank()
                ? m.getSender().getDisplayName() : m.getSender().getUsername();
        boolean hasAttachment = m.getAttachmentUrl() != null && !m.getAttachmentUrl().isBlank();

        for (User r : recipients(m)) {
            if (Boolean.FALSE.equals(r.getActive())) continue;
            if (presence.isActive(r.getUsername())) continue; // looking at the app right now

            List<DeviceToken> tokens = fcm == null ? List.of() : deviceTokens.findByUsername(r.getUsername());
            List<com.taskis.backend.models.WebSubscription> browsers = webPush.enabled() ? webSubs.findByUsername(r.getUsername()) : List.of();
            if (tokens.isEmpty() && browsers.isEmpty()) continue;

            PushUnread u = unread.findByUsernameAndChannel(r.getUsername(), channel).orElseGet(() -> {
                PushUnread n = new PushUnread();
                n.setUsername(r.getUsername());
                n.setChannel(channel);
                return n;
            });
            u.setCount(u.getCount() + 1);
            unread.save(u);
            int total = unread.findByUsername(r.getUsername()).stream().mapToInt(PushUnread::getCount).sum();

            boolean hide = !Boolean.FALSE.equals(r.getHidePushContent());
            PushText.Text text = PushText.build(channel, senderName, u.getCount(), hide, m.getContent(), hasAttachment);

            for (var b : browsers) webPush.send(b, text.title(), text.body(), channel, channel, total, "message");

            for (DeviceToken t : tokens) {
                try {
                    fcm.send(com.google.firebase.messaging.Message.builder()
                            .setToken(t.getToken())
                            .setNotification(Notification.builder().setTitle(text.title()).setBody(text.body()).build())
                            .setAndroidConfig(AndroidConfig.builder()
                                    .setPriority(AndroidConfig.Priority.HIGH)
                                    .setNotification(AndroidNotification.builder()
                                            .setChannelId("messages")
                                            .setTag(channel)
                                            .setNotificationCount(total)
                                            .setDefaultVibrateTimings(true)
                                            .setDefaultSound(true)
                                            .build())
                                    .build())
                            .putAllData(Map.of("channel", channel, "count", String.valueOf(total)))
                            .build());
                } catch (FirebaseMessagingException e) {
                    MessagingErrorCode code = e.getMessagingErrorCode();
                    if (code == MessagingErrorCode.UNREGISTERED || code == MessagingErrorCode.INVALID_ARGUMENT
                            || code == MessagingErrorCode.SENDER_ID_MISMATCH) {
                        deviceTokens.delete(t); // the phone uninstalled the app or the token expired
                    } else {
                        System.out.println("Push send error: " + code);
                    }
                }
            }
        }
    }
}
