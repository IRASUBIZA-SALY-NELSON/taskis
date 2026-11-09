package com.taskis.backend.storage;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.NoSuchFileException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

import static org.junit.jupiter.api.Assertions.*;

class S3FileStoreTest {

    private HttpServer server;
    private final Map<String, byte[]> objects = new ConcurrentHashMap<>();
    private final List<String> authHeaders = new CopyOnWriteArrayList<>();
    private S3FileStore store;

    @BeforeEach
    void setUp() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", this::handle);
        server.start();
        store = new S3FileStore("http://127.0.0.1:" + server.getAddress().getPort(), "taskis", "AKID", "SECRET", "auto");
    }

    @AfterEach
    void tearDown() {
        server.stop(0);
    }

    /** A tiny in-memory S3: path-style PUT/GET/HEAD/DELETE and a paged ListObjectsV2. */
    private void handle(HttpExchange ex) throws IOException {
        authHeaders.add(String.valueOf(ex.getRequestHeaders().getFirst("Authorization")));
        String path = ex.getRequestURI().getPath();
        String query = ex.getRequestURI().getQuery();
        String method = ex.getRequestMethod();
        if (!path.startsWith("/taskis")) { ex.sendResponseHeaders(404, -1); ex.close(); return; }
        String key = path.length() > "/taskis/".length() ? path.substring("/taskis/".length()) : "";

        if (method.equals("GET") && key.isEmpty() && query != null && query.contains("list-type=2")) {
            // Like real S3, the continuation token marks the last key already listed, so deleting while paging skips nothing.
            String after = query.contains("continuation-token=")
                    ? java.net.URLDecoder.decode(query.replaceAll(".*continuation-token=([^&]*).*", "$1"), StandardCharsets.UTF_8) : "";
            List<String> keys = new ArrayList<>();
            for (String k : new TreeSet<>(objects.keySet())) if (k.compareTo(after) > 0) keys.add(k);
            List<String> page = keys.subList(0, Math.min(2, keys.size()));
            StringBuilder xml = new StringBuilder("<ListBucketResult>");
            for (String k : page) xml.append("<Contents><Key>").append(k).append("</Key></Contents>");
            boolean more = keys.size() > page.size();
            xml.append("<IsTruncated>").append(more).append("</IsTruncated>");
            if (more) xml.append("<NextContinuationToken>").append(page.get(page.size() - 1)).append("</NextContinuationToken>");
            xml.append("</ListBucketResult>");
            byte[] b = xml.toString().getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(200, b.length);
            ex.getResponseBody().write(b);
        } else if (method.equals("PUT")) {
            long declared = Long.parseLong(ex.getRequestHeaders().getFirst("Content-Length"));
            byte[] body = ex.getRequestBody().readAllBytes();
            if (body.length != declared) { ex.sendResponseHeaders(400, -1); ex.close(); return; }
            objects.put(key, body);
            ex.sendResponseHeaders(200, -1);
        } else if (method.equals("GET") && objects.containsKey(key)) {
            byte[] b = objects.get(key);
            ex.sendResponseHeaders(200, b.length);
            ex.getResponseBody().write(b);
        } else if (method.equals("HEAD") && objects.containsKey(key)) {
            ex.getResponseHeaders().set("Content-Length", String.valueOf(objects.get(key).length));
            ex.sendResponseHeaders(200, -1);
        } else if (method.equals("DELETE")) {
            objects.remove(key);
            ex.sendResponseHeaders(204, -1);
        } else {
            ex.sendResponseHeaders(404, -1);
        }
        ex.close();
    }

    @Test
    void signatureMatchesAmazonsPublishedExample() {
        // "GET Object" example from the AWS Signature Version 4 documentation.
        TreeMap<String, String> headers = new TreeMap<>();
        headers.put("host", "examplebucket.s3.amazonaws.com");
        headers.put("range", "bytes=0-9");
        headers.put("x-amz-content-sha256", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
        headers.put("x-amz-date", "20130524T000000Z");
        String auth = S3FileStore.authorization("GET", "/test.txt", "", headers,
                "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
                "AKIAIOSFODNN7EXAMPLE", "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY", "us-east-1", "20130524T000000Z");
        assertTrue(auth.contains("Credential=AKIAIOSFODNN7EXAMPLE/20130524/us-east-1/s3/aws4_request"), auth);
        assertTrue(auth.contains("SignedHeaders=host;range;x-amz-content-sha256;x-amz-date"), auth);
        assertTrue(auth.endsWith("Signature=f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41"), auth);
    }

    @Test
    void storesAndReadsBackLargeContentExactly() throws Exception {
        byte[] data = new byte[5 * 1024 * 1024 + 123];
        new Random(7).nextBytes(data);
        store.put("abc123", new ByteArrayInputStream(data), data.length);
        assertTrue(store.exists("abc123"));
        assertEquals(data.length, store.size("abc123"));
        try (var in = store.open("abc123")) {
            assertArrayEquals(data, in.readAllBytes());
        }
        assertTrue(authHeaders.stream().allMatch(h -> h.startsWith("AWS4-HMAC-SHA256 Credential=AKID/") && h.contains("/auto/s3/aws4_request")), authHeaders.toString());
    }

    @Test
    void missingObjectsAreReportedAsMissing() throws Exception {
        assertFalse(store.exists("nope"));
        assertThrows(NoSuchFileException.class, () -> store.open("nope"));
        assertThrows(NoSuchFileException.class, () -> store.size("nope"));
    }

    @Test
    void deletesOneAndEverythingAcrossPages() throws Exception {
        for (String k : new String[] {"a1", "a2", "a3", "a4", "a5"}) store.put(k, new ByteArrayInputStream(new byte[] {1}), 1);
        store.delete("a1");
        assertFalse(store.exists("a1"));
        assertEquals(4, store.deleteAll());
        assertTrue(objects.isEmpty());
    }

    @Test
    void refusesKeysThatCouldEscapeTheBucketPath() {
        assertThrows(IOException.class, () -> store.put("../evil", new ByteArrayInputStream(new byte[0]), 0));
        assertThrows(IOException.class, () -> store.open("a/b"));
    }
}
