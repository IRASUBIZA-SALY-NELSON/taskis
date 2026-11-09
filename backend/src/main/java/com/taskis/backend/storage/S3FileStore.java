package com.taskis.backend.storage;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.NoSuchFileException;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Files in an S3-compatible bucket (Cloudflare R2, AWS S3, MinIO...), using path-style URLs and AWS Signature V4.
 * Written directly against the S3 REST API, so it needs no SDK. Bodies are streamed and sent unsigned
 * (UNSIGNED-PAYLOAD), which S3 and R2 accept over HTTPS; the files themselves are already encrypted before they get here.
 */
public class S3FileStore implements FileStore {

    private static final DateTimeFormatter AMZ_DATE = DateTimeFormatter.ofPattern("yyyyMMdd'T'HHmmss'Z'").withZone(ZoneOffset.UTC);
    private static final String EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    private static final String UNSIGNED = "UNSIGNED-PAYLOAD";

    private final String endpoint;
    private final String bucket;
    private final String accessKey;
    private final String secretKey;
    private final String region;
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();

    public S3FileStore(String endpoint, String bucket, String accessKey, String secretKey, String region) {
        this.endpoint = endpoint.replaceAll("/+$", "");
        this.bucket = bucket;
        this.accessKey = accessKey;
        this.secretKey = secretKey;
        this.region = region == null || region.isBlank() ? "auto" : region;
    }

    // ---- FileStore ----

    @Override
    public void put(String key, InputStream in, long length) throws IOException {
        checkKey(key);
        HttpRequest.Builder b = request("PUT", "/" + bucket + "/" + key, "", UNSIGNED, Duration.ofMinutes(15))
                .PUT(HttpRequest.BodyPublishers.fromPublisher(HttpRequest.BodyPublishers.ofInputStream(() -> in), length));
        HttpResponse<InputStream> res = send(b.build());
        drain(res);
        if (res.statusCode() / 100 != 2) throw new IOException("Storage upload failed (HTTP " + res.statusCode() + ")");
    }

    @Override
    public InputStream open(String key) throws IOException {
        checkKey(key);
        HttpResponse<InputStream> res = send(request("GET", "/" + bucket + "/" + key, "", EMPTY_SHA256, Duration.ofMinutes(15)).GET().build());
        if (res.statusCode() == 404) { drain(res); throw new NoSuchFileException(key); }
        if (res.statusCode() / 100 != 2) { drain(res); throw new IOException("Storage download failed (HTTP " + res.statusCode() + ")"); }
        return res.body();
    }

    @Override
    public long size(String key) throws IOException {
        checkKey(key);
        HttpResponse<InputStream> res = send(request("HEAD", "/" + bucket + "/" + key, "", EMPTY_SHA256, Duration.ofSeconds(30))
                .method("HEAD", HttpRequest.BodyPublishers.noBody()).build());
        drain(res);
        if (res.statusCode() == 404) throw new NoSuchFileException(key);
        if (res.statusCode() / 100 != 2) throw new IOException("Storage lookup failed (HTTP " + res.statusCode() + ")");
        return res.headers().firstValueAsLong("Content-Length").orElseThrow(() -> new IOException("Storage did not report a size"));
    }

    @Override
    public boolean exists(String key) throws IOException {
        try {
            size(key);
            return true;
        } catch (NoSuchFileException e) {
            return false;
        }
    }

    @Override
    public void delete(String key) throws IOException {
        checkKey(key);
        HttpResponse<InputStream> res = send(request("DELETE", "/" + bucket + "/" + key, "", EMPTY_SHA256, Duration.ofSeconds(30))
                .DELETE().build());
        drain(res);
        if (res.statusCode() / 100 != 2 && res.statusCode() != 404) throw new IOException("Storage delete failed (HTTP " + res.statusCode() + ")");
    }

    @Override
    public int deleteAll() throws IOException {
        int n = 0;
        String token = null;
        do {
            String query = (token == null ? "" : "continuation-token=" + enc(token) + "&") + "list-type=2";
            HttpResponse<InputStream> res = send(request("GET", "/" + bucket, query, EMPTY_SHA256, Duration.ofSeconds(60)).GET().build());
            String xml = new String(res.body().readAllBytes(), StandardCharsets.UTF_8);
            if (res.statusCode() / 100 != 2) throw new IOException("Storage listing failed (HTTP " + res.statusCode() + ")");
            List<String> keys = new ArrayList<>();
            Matcher m = Pattern.compile("<Key>([^<]*)</Key>").matcher(xml);
            while (m.find()) keys.add(m.group(1));
            for (String k : keys) if (FileStore.validKey(k)) { delete(k); n++; }
            Matcher t = Pattern.compile("<NextContinuationToken>([^<]*)</NextContinuationToken>").matcher(xml);
            token = xml.contains("<IsTruncated>true</IsTruncated>") && t.find() ? t.group(1) : null;
        } while (token != null);
        return n;
    }

    @Override
    public String describe() {
        return "S3-compatible bucket '" + bucket + "' at " + endpoint;
    }

    // ---- requests and signing ----

    private void checkKey(String key) throws IOException {
        if (!FileStore.validKey(key)) throw new IOException("Invalid file key");
    }

    private HttpRequest.Builder request(String method, String path, String query, String payloadHash, Duration timeout) {
        URI uri = URI.create(endpoint + path + (query.isEmpty() ? "" : "?" + query));
        String host = uri.getPort() == -1 ? uri.getHost() : uri.getHost() + ":" + uri.getPort();
        String amzDate = AMZ_DATE.format(ZonedDateTime.now(ZoneOffset.UTC));
        TreeMap<String, String> headers = new TreeMap<>();
        headers.put("host", host);
        headers.put("x-amz-content-sha256", payloadHash);
        headers.put("x-amz-date", amzDate);
        String auth = authorization(method, path, query, headers, payloadHash, accessKey, secretKey, region, amzDate);
        return HttpRequest.newBuilder(uri).timeout(timeout)
                .header("x-amz-content-sha256", payloadHash)
                .header("x-amz-date", amzDate)
                .header("Authorization", auth);
    }

    private HttpResponse<InputStream> send(HttpRequest req) throws IOException {
        try {
            return http.send(req, HttpResponse.BodyHandlers.ofInputStream());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IOException("Storage request interrupted", e);
        }
    }

    private static void drain(HttpResponse<InputStream> res) {
        try (InputStream in = res.body()) {
            in.transferTo(java.io.OutputStream.nullOutputStream());
        } catch (IOException ignored) { /* nothing useful in an error body */ }
    }

    /** AWS Signature Version 4 "Authorization" header value. {@code headers} are lower-case names to be signed. */
    static String authorization(String method, String canonicalPath, String canonicalQuery, TreeMap<String, String> headers,
                                String payloadHash, String accessKey, String secretKey, String region, String amzDate) {
        String date = amzDate.substring(0, 8);
        StringBuilder canonHeaders = new StringBuilder();
        for (Map.Entry<String, String> h : headers.entrySet()) canonHeaders.append(h.getKey()).append(':').append(h.getValue().trim()).append('\n');
        String signedHeaders = String.join(";", headers.keySet());
        String canonicalRequest = method + "\n" + canonicalPath + "\n" + canonicalQuery + "\n" + canonHeaders + "\n" + signedHeaders + "\n" + payloadHash;
        String scope = date + "/" + region + "/s3/aws4_request";
        String stringToSign = "AWS4-HMAC-SHA256\n" + amzDate + "\n" + scope + "\n" + hex(sha256(canonicalRequest.getBytes(StandardCharsets.UTF_8)));
        byte[] k = hmac(("AWS4" + secretKey).getBytes(StandardCharsets.UTF_8), date);
        k = hmac(k, region);
        k = hmac(k, "s3");
        k = hmac(k, "aws4_request");
        String signature = hex(hmac(k, stringToSign));
        return "AWS4-HMAC-SHA256 Credential=" + accessKey + "/" + scope + ", SignedHeaders=" + signedHeaders + ", Signature=" + signature;
    }

    private static byte[] hmac(byte[] key, String data) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key, "HmacSHA256"));
            return mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static byte[] sha256(byte[] data) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(data);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String hex(byte[] b) {
        return HexFormat.of().formatHex(b);
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8).replace("+", "%20").replace("*", "%2A").replace("%7E", "~");
    }
}
