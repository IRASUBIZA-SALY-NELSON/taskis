package com.taskis.backend.services;

import com.sun.net.httpserver.HttpServer;
import com.taskis.backend.models.WebSubscription;
import com.taskis.backend.repositories.WebSubscriptionRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import javax.crypto.Cipher;
import javax.crypto.KeyAgreement;
import javax.crypto.Mac;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.io.ByteArrayOutputStream;
import java.lang.reflect.Proxy;
import java.math.BigInteger;
import java.net.InetSocketAddress;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.*;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;

/** Sends through the real library to a local fake push service and decrypts the body the way a browser would. */
class WebPushSenderTest {

    private static final Base64.Encoder B64 = Base64.getUrlEncoder().withoutPadding();

    private HttpServer server;
    private final AtomicReference<byte[]> body = new AtomicReference<>();
    private final AtomicReference<Map<String, String>> headers = new AtomicReference<>();
    private final List<WebSubscription> deleted = new ArrayList<>();
    private WebPushSender sender;
    private KeyPair receiver;
    private byte[] authSecret;
    private int port;

    @BeforeEach
    void setUp() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/ok", ex -> {
            body.set(ex.getRequestBody().readAllBytes());
            Map<String, String> h = new HashMap<>();
            ex.getRequestHeaders().forEach((k, v) -> h.put(k.toLowerCase(), v.get(0)));
            headers.set(h);
            ex.sendResponseHeaders(201, -1);
            ex.close();
        });
        server.createContext("/gone", ex -> { ex.getRequestBody().readAllBytes(); ex.sendResponseHeaders(410, -1); ex.close(); });
        server.start();
        port = server.getAddress().getPort();

        KeyPair vapid = ec();
        receiver = ec();
        authSecret = new byte[16];
        new SecureRandom().nextBytes(authSecret);

        WebSubscriptionRepository repo = (WebSubscriptionRepository) Proxy.newProxyInstance(getClass().getClassLoader(),
                new Class<?>[] {WebSubscriptionRepository.class}, (p, m, a) -> {
                    if (m.getName().equals("delete")) deleted.add((WebSubscription) a[0]);
                    return null;
                });
        sender = new WebPushSender();
        ReflectionTestUtils.setField(sender, "publicKey", B64.encodeToString(point((ECPublicKey) vapid.getPublic())));
        ReflectionTestUtils.setField(sender, "privateKey", B64.encodeToString(scalar((ECPrivateKey) vapid.getPrivate())));
        ReflectionTestUtils.setField(sender, "subject", "https://example.test");
        ReflectionTestUtils.setField(sender, "subscriptions", repo);
        sender.init();
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    private WebSubscription subscription(String path) {
        WebSubscription s = new WebSubscription();
        s.setEndpoint("http://127.0.0.1:" + port + path);
        s.setP256dh(B64.encodeToString(point((ECPublicKey) receiver.getPublic())));
        s.setAuth(B64.encodeToString(authSecret));
        s.setUsername("nelson");
        return s;
    }

    @Test
    void deliversAnEncryptedPayloadTheBrowserCanRead() throws Exception {
        assertTrue(sender.enabled());
        sender.send(subscription("/ok"), "Nelson", "sent you 2 messages \"hi\"", "dm_1_2", "dm_1_2", 2, "message");

        assertNotNull(body.get(), "nothing reached the push service");
        Map<String, String> h = headers.get();
        assertEquals("aes128gcm", h.get("content-encoding"));
        assertEquals("3600", h.get("ttl"));
        assertTrue(h.get("authorization").startsWith("vapid t="), h.get("authorization"));

        String json = decrypt(body.get());
        assertTrue(json.contains("\"title\":\"Nelson\""), json);
        assertTrue(json.contains("sent you 2 messages \\\"hi\\\""), json);
        assertTrue(json.contains("\"channel\":\"dm_1_2\"") && json.contains("\"count\":2") && json.contains("\"kind\":\"message\""), json);
    }

    @Test
    void forgetsBrowsersThatUnsubscribed() {
        WebSubscription gone = subscription("/gone");
        sender.send(gone, "t", "b", "c", "c", 1, "message");
        assertEquals(List.of(gone), deleted);
    }

    @Test
    void escapesAwkwardText() {
        assertEquals("\"a\\\"b\\\\c\\nd\"", WebPushSender.quote("a\"b\\c\nd"));
        assertEquals("\"\"", WebPushSender.quote(null));
    }

    // ---- the browser's side: RFC 8291 / RFC 8188 ----

    private String decrypt(byte[] msg) throws Exception {
        ByteBuffer in = ByteBuffer.wrap(msg);
        byte[] salt = new byte[16];
        in.get(salt);
        in.getInt(); // record size
        byte[] asPublic = new byte[in.get() & 0xFF];
        in.get(asPublic);
        byte[] cipherText = new byte[in.remaining()];
        in.get(cipherText);

        byte[] uaPublic = point((ECPublicKey) receiver.getPublic());
        KeyAgreement ka = KeyAgreement.getInstance("ECDH");
        ka.init(receiver.getPrivate());
        ka.doPhase(publicFrom(asPublic), true);
        byte[] ecdh = ka.generateSecret();

        byte[] keyInfo = concat("WebPush: info\0".getBytes(StandardCharsets.US_ASCII), uaPublic, asPublic);
        byte[] ikm = hkdf(authSecret, ecdh, keyInfo, 32);
        byte[] cek = hkdf(salt, ikm, "Content-Encoding: aes128gcm\0".getBytes(StandardCharsets.US_ASCII), 16);
        byte[] nonce = hkdf(salt, ikm, "Content-Encoding: nonce\0".getBytes(StandardCharsets.US_ASCII), 12);

        Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
        c.init(Cipher.DECRYPT_MODE, new SecretKeySpec(cek, "AES"), new GCMParameterSpec(128, nonce));
        byte[] plain = c.doFinal(cipherText);
        int end = plain.length;
        while (end > 0 && plain[end - 1] == 0) end--;      // padding
        assertEquals(2, plain[end - 1], "missing last-record delimiter");
        return new String(plain, 0, end - 1, StandardCharsets.UTF_8);
    }

    private static byte[] hkdf(byte[] salt, byte[] ikm, byte[] info, int len) throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(salt, "HmacSHA256"));
        byte[] prk = mac.doFinal(ikm);
        mac.init(new SecretKeySpec(prk, "HmacSHA256"));
        mac.update(info);
        mac.update((byte) 1);
        return Arrays.copyOf(mac.doFinal(), len);
    }

    private static byte[] concat(byte[]... parts) {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        for (byte[] p : parts) o.writeBytes(p);
        return o.toByteArray();
    }

    private static KeyPair ec() throws Exception {
        KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
        g.initialize(new ECGenParameterSpec("secp256r1"));
        return g.generateKeyPair();
    }

    private static byte[] point(ECPublicKey k) {
        byte[] out = new byte[65];
        out[0] = 4;
        System.arraycopy(fixed(k.getW().getAffineX()), 0, out, 1, 32);
        System.arraycopy(fixed(k.getW().getAffineY()), 0, out, 33, 32);
        return out;
    }

    private static byte[] scalar(ECPrivateKey k) {
        return fixed(k.getS());
    }

    private static byte[] fixed(BigInteger v) {
        byte[] b = v.toByteArray(), out = new byte[32];
        System.arraycopy(b, Math.max(0, b.length - 32), out, Math.max(0, 32 - b.length), Math.min(32, b.length));
        return out;
    }

    private static PublicKey publicFrom(byte[] p) throws Exception {
        AlgorithmParameters params = AlgorithmParameters.getInstance("EC");
        params.init(new ECGenParameterSpec("secp256r1"));
        ECParameterSpec spec = params.getParameterSpec(ECParameterSpec.class);
        ECPoint w = new ECPoint(new BigInteger(1, Arrays.copyOfRange(p, 1, 33)), new BigInteger(1, Arrays.copyOfRange(p, 33, 65)));
        return KeyFactory.getInstance("EC").generatePublic(new ECPublicKeySpec(w, spec));
    }
}
