package com.taskis.backend.storage;

import java.io.IOException;
import java.io.InputStream;

/**
 * Where uploaded files live. Keys are plain file names (an id, or an id plus ".meta"). Either the server's own disk
 * (fine for development) or an S3-compatible bucket such as Cloudflare R2, which survives redeploys.
 */
public interface FileStore {

    /** Stores the bytes read from {@code in}; {@code length} must be exactly how many there are. */
    void put(String key, InputStream in, long length) throws IOException;

    /** Streams the object; throws {@link java.nio.file.NoSuchFileException} when it does not exist. */
    InputStream open(String key) throws IOException;

    /** Size in bytes; throws {@link java.nio.file.NoSuchFileException} when it does not exist. */
    long size(String key) throws IOException;

    boolean exists(String key) throws IOException;

    void delete(String key) throws IOException;

    /** Removes everything this store holds (the admin self-destruct). Returns how many objects were removed. */
    int deleteAll() throws IOException;

    /** Short human description for the startup log. */
    String describe();

    static boolean validKey(String key) {
        return key != null && key.matches("[A-Za-z0-9][A-Za-z0-9._-]{0,127}") && !key.contains("..");
    }
}
