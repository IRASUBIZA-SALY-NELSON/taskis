package com.taskis.backend.security;

import jakarta.annotation.PostConstruct;
import java.security.GeneralSecurityException;
import java.nio.ByteBuffer;
import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.PushbackInputStream;
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

    // ---- streaming format (v2) -------------------------------------------------------------------------
    // Large files are encrypted in chunks so they never have to fit in memory:
    //   "TSK2" | chunk size (4 bytes) | random nonce prefix (8 bytes) | chunk 0 | chunk 1 | ...
    // Every chunk is AES-GCM with nonce = prefix + chunk number, and the "is this the last chunk" flag is authenticated,
    // so reordering, dropping or truncating chunks makes decryption fail. Files written before this (no "TSK2")
    // are still read with the old whole-file method.

    private static final byte[] MAGIC = {'T', 'S', 'K', '2'};
    private static final int TAG = 16;
    private static final int HEADER = 16;

    @Value("${taskis.crypto.chunk-size:1048576}")
    private int chunkSize = 1 << 20;

    /** How many bytes a plain file of this size becomes once encrypted (so it can be uploaded with a known length). */
    public long encryptedLength(long plain) {
        long chunks = Math.max(1, (plain + chunkSize - 1) / chunkSize);
        return HEADER + plain + (long) TAG * chunks;
    }

    static long plainLength(long encrypted, int chunk) {
        long chunks = Math.max(1, (encrypted - HEADER + (chunk + TAG) - 1) / (chunk + TAG));
        return encrypted - HEADER - (long) TAG * chunks;
    }

    /** Encrypts as it is read; nothing is buffered beyond one chunk. */
    public InputStream encryptingStream(InputStream plain) {
        byte[] prefix = new byte[8];
        rng.nextBytes(prefix);
        byte[] header = ByteBuffer.allocate(HEADER).put(MAGIC).putInt(chunkSize).put(prefix).array();
        return new ChunkStream(plain, header, prefix, chunkSize, true);
    }

    /** A decrypted stream and, when the stored size was known, how long the plain content is (otherwise -1). */
    public record Decrypted(InputStream stream, long length) {}

    /** Opens stored bytes for reading, whichever format they were written in. */
    public Decrypted open(InputStream stored, long storedLength) throws IOException {
        PushbackInputStream in = new PushbackInputStream(stored, 4);
        byte[] first = in.readNBytes(4);
        if (first.length == 4 && java.util.Arrays.equals(first, MAGIC)) {
            byte[] rest = in.readNBytes(HEADER - 4);
            if (rest.length != HEADER - 4) throw new IOException("Corrupt file");
            ByteBuffer b = ByteBuffer.wrap(rest);
            int chunk = b.getInt();
            if (chunk < 1024 || chunk > 64 * 1024 * 1024) throw new IOException("Corrupt file");
            byte[] prefix = new byte[8];
            b.get(prefix);
            return new Decrypted(new ChunkStream(in, new byte[0], prefix, chunk, false), storedLength >= 0 ? plainLength(storedLength, chunk) : -1);
        }
        // older file: iv + ciphertext of the whole content
        in.unread(first);
        try {
            byte[] plain = decrypt(in.readAllBytes());
            return new Decrypted(new ByteArrayInputStream(plain), plain.length);
        } catch (IOException e) {
            throw e;
        } catch (Exception e) {
            throw new IOException("Could not decrypt file", e);
        }
    }

    /** Pulls one chunk at a time from {@code source}, encrypting or decrypting it. */
    private final class ChunkStream extends InputStream {
        private final PushbackInputStream source;
        private final byte[] prefix;
        private final int chunk;
        private final boolean encrypt;
        private byte[] buf;
        private int pos;
        private long counter;
        private boolean done;

        ChunkStream(InputStream source, byte[] firstBytes, byte[] prefix, int chunk, boolean encrypt) {
            this.source = source instanceof PushbackInputStream p ? p : new PushbackInputStream(source, 1);
            this.prefix = prefix;
            this.chunk = chunk;
            this.encrypt = encrypt;
            this.buf = firstBytes;
        }

        private boolean fill() throws IOException {
            while (pos >= buf.length) {
                if (done) return false;
                int size = encrypt ? chunk : chunk + TAG;
                byte[] in = source.readNBytes(size);
                boolean last;
                if (in.length < size) {
                    last = true;
                } else {
                    int next = source.read();
                    if (next < 0) last = true; else { source.unread(next); last = false; }
                }
                try {
                    buf = crypt(in, last);
                } catch (GeneralSecurityException e) {
                    throw new IOException("File is damaged or has been tampered with", e);
                }
                pos = 0;
                counter++;
                if (last) done = true;
            }
            return true;
        }

        private byte[] crypt(byte[] data, boolean last) throws GeneralSecurityException, IOException {
            if (!encrypt && data.length < TAG) throw new IOException("File is damaged or truncated");
            byte[] nonce = ByteBuffer.allocate(12).put(prefix).putInt((int) counter).array();
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(encrypt ? Cipher.ENCRYPT_MODE : Cipher.DECRYPT_MODE, key, new GCMParameterSpec(128, nonce));
            c.updateAAD(new byte[] {(byte) (last ? 1 : 0)});
            return c.doFinal(data);
        }

        @Override
        public int read() throws IOException {
            return fill() ? buf[pos++] & 0xFF : -1;
        }

        @Override
        public int read(byte[] out, int off, int len) throws IOException {
            if (len == 0) return 0;
            if (!fill()) return -1;
            int n = Math.min(len, buf.length - pos);
            System.arraycopy(buf, pos, out, off, n);
            pos += n;
            return n;
        }

        @Override
        public void close() throws IOException {
            source.close();
        }
    }
}
