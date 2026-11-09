package com.taskis.backend.config;

import com.taskis.backend.storage.FileStore;
import com.taskis.backend.storage.LocalFileStore;
import com.taskis.backend.storage.S3FileStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.nio.file.Paths;

@Configuration
public class StorageConfig {

    @Bean
    public FileStore fileStore(
            @Value("${taskis.storage.s3.endpoint:}") String endpoint,
            @Value("${taskis.storage.s3.bucket:}") String bucket,
            @Value("${taskis.storage.s3.access-key:}") String accessKey,
            @Value("${taskis.storage.s3.secret-key:}") String secretKey,
            @Value("${taskis.storage.s3.region:auto}") String region,
            @Value("${taskis.storage.local-dir:uploads}") String localDir) throws IOException {
        FileStore store;
        if (!endpoint.isBlank() && !bucket.isBlank() && !accessKey.isBlank() && !secretKey.isBlank()) {
            store = new S3FileStore(endpoint, bucket, accessKey, secretKey, region);
        } else {
            store = new LocalFileStore(Paths.get(System.getProperty("user.dir")).resolve(localDir));
            if (System.getenv("RENDER") != null) {
                System.out.println("WARNING: uploaded files are stored on this server's disk and will be LOST on every redeploy. "
                        + "Set S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY and S3_SECRET_KEY (see docs/FILE-STORAGE-SETUP.md).");
            }
        }
        System.out.println("File storage: " + store.describe());
        return store;
    }
}
