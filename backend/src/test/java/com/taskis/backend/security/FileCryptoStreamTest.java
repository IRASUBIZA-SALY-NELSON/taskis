package com.taskis.backend.security;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.util.Arrays;
import java.util.Random;

import static org.junit.jupiter.api.Assertions.*;

class FileCryptoStreamTest {

    private static final int CHUNK = 1024;
    private FileCrypto crypto;

    @BeforeEach
    void setUp() throws Exception {
        crypto = new FileCrypto();
        ReflectionTestUtils.setField(crypto, "secret", "a-secret-used-only-in-tests");
        ReflectionTestUtils.setField(crypto, "chunkSize", CHUNK);
        crypto.init();
    }

    private static byte[] data(int n) {
        byte[] b = new byte[n];
        new Random(n).nextBytes(b);
        return b;
    }

    private byte[] encrypt(byte[] plain) throws IOException {
        return crypto.encryptingStream(new ByteArrayInputStream(plain)).readAllBytes();
    }

    private byte[] decrypt(byte[] stored) throws IOException {
        return crypto.open(new ByteArrayInputStream(stored), stored.length).stream().readAllBytes();
    }

    @Test
    void roundTripsEverySizeAroundTheChunkBoundaries() throws Exception {
        for (int n : new int[] {0, 1, CHUNK - 1, CHUNK, CHUNK + 1, 3 * CHUNK, 3 * CHUNK + 5, 10_000}) {
            byte[] plain = data(n);
            byte[] stored = encrypt(plain);
            assertEquals(crypto.encryptedLength(n), stored.length, "stored size for " + n);
            assertArrayEquals(plain, decrypt(stored), "content for " + n);
            assertEquals(n, crypto.open(new ByteArrayInputStream(stored), stored.length).length(), "reported length for " + n);
        }
    }

    @Test
    void noPlaintextAppearsInTheStoredBytes() throws Exception {
        byte[] plain = "the launch code is 4471, do not share".repeat(100).getBytes();
        String stored = new String(encrypt(plain), java.nio.charset.StandardCharsets.ISO_8859_1);
        assertFalse(stored.contains("launch code"));
    }

    @Test
    void changingAnyByteIsDetected() throws Exception {
        byte[] stored = encrypt(data(5000));
        stored[stored.length / 2] ^= 1;
        assertThrows(IOException.class, () -> decrypt(stored));
    }

    @Test
    void droppingTheLastChunkIsDetected() throws Exception {
        byte[] stored = encrypt(data(3 * CHUNK + 10));
        byte[] cut = Arrays.copyOf(stored, stored.length - (10 + 16)); // remove the short final chunk exactly
        assertThrows(IOException.class, () -> decrypt(cut));
    }

    @Test
    void swappingChunksIsDetected() throws Exception {
        byte[] stored = encrypt(data(3 * CHUNK + 10));
        int unit = CHUNK + 16, a = 16, b = 16 + unit;
        byte[] swapped = stored.clone();
        System.arraycopy(stored, b, swapped, a, unit);
        System.arraycopy(stored, a, swapped, b, unit);
        assertThrows(IOException.class, () -> decrypt(swapped));
    }

    @Test
    void filesStoredByTheOldWholeFileMethodStillOpen() throws Exception {
        byte[] plain = data(7777);
        byte[] legacy = crypto.encrypt(plain);
        FileCrypto.Decrypted d = crypto.open(new ByteArrayInputStream(legacy), legacy.length);
        assertArrayEquals(plain, d.stream().readAllBytes());
        assertEquals(plain.length, d.length());
    }

    @Test
    void twoEncryptionsOfTheSameFileDiffer() throws Exception {
        byte[] plain = data(2000);
        assertFalse(Arrays.equals(encrypt(plain), encrypt(plain)));
    }
}
