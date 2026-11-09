package com.taskis.backend.services;

import com.taskis.backend.models.WebSubscription;
import com.taskis.backend.repositories.WebSubscriptionRepository;
import jakarta.annotation.PostConstruct;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.Urgency;
import nl.martijndwars.webpush.Utils;
import org.apache.http.HttpResponse;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.Security;
import java.util.Map;

/**
 * Delivers notifications to browsers using the standard Web Push protocol (VAPID), so desktop Chrome, Edge,
 * Firefox and installed web apps are notified even with the tab closed. Off until both VAPID keys are set.
 */
@Service
public class WebPushSender {

    @Value("${taskis.vapid.public-key:}")
    private String publicKey;
    @Value("${taskis.vapid.private-key:}")
    private String privateKey;
    @Value("${taskis.vapid.subject:https://tasikisi.salynelson.rw}")
    private String subject;

    @Autowired private WebSubscriptionRepository subscriptions;

    private nl.martijndwars.webpush.PushService client;

    @PostConstruct
    void init() {
        if (publicKey.isBlank() || privateKey.isBlank()) {
            System.out.println("Desktop push disabled: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set.");
            return;
        }
        try {
            if (Security.getProvider("BC") == null) Security.addProvider(new BouncyCastleProvider());
            client = new nl.martijndwars.webpush.PushService(publicKey, privateKey, subject);
            System.out.println("Desktop push enabled.");
        } catch (Exception e) {
            System.out.println("Desktop push disabled: bad VAPID keys (" + e.getMessage() + ")");
        }
    }

    public boolean enabled() {
        return client != null;
    }

    public String publicKey() {
        return publicKey;
    }

    /** Sends one notification; forgets browsers that have unsubscribed. */
    public void send(WebSubscription sub, String title, String body, String tag, String channel, int count, String kind) {
        if (client == null) return;
        try {
            String payload = payload(title, body, tag, channel, count, kind);
            boolean call = "call".equals(kind);
            Notification n = Notification.builder()
                    .endpoint(sub.getEndpoint())
                    .userPublicKey(Utils.loadPublicKey(sub.getP256dh()))
                    .userAuth(java.util.Base64.getUrlDecoder().decode(sub.getAuth()))
                    .payload(payload.getBytes(StandardCharsets.UTF_8))
                    .ttl(call ? 45 : 3600)
                    .urgency(call ? Urgency.HIGH : Urgency.NORMAL)
                    .build();
            HttpResponse res = client.send(n, nl.martijndwars.webpush.Encoding.AES128GCM);
            int status = res.getStatusLine().getStatusCode();
            if (status == 404 || status == 410) subscriptions.delete(sub); // the browser unsubscribed or expired
            else if (status >= 400) System.out.println("Web push rejected: HTTP " + status);
        } catch (Exception e) {
            System.out.println("Web push failed: " + e.getMessage());
        }
    }

    static String payload(String title, String body, String tag, String channel, int count, String kind) {
        return "{\"title\":" + quote(title) + ",\"body\":" + quote(body) + ",\"tag\":" + quote(tag)
                + ",\"channel\":" + quote(channel) + ",\"count\":" + count + ",\"kind\":" + quote(kind) + "}";
    }

    static String quote(String s) {
        if (s == null) return "\"\"";
        StringBuilder sb = new StringBuilder("\"");
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> { if (c < 0x20) sb.append(String.format("\\u%04x", (int) c)); else sb.append(c); }
            }
        }
        return sb.append('"').toString();
    }

    public Map<String, Object> keyInfo() {
        return Map.of("enabled", enabled(), "publicKey", enabled() ? publicKey : "");
    }
}
