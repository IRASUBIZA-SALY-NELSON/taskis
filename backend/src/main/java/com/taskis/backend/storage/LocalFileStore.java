package com.taskis.backend.storage;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.*;
import java.util.stream.Stream;

/** Files on the server's own disk. Simple, but a redeploy on most hosts (e.g. Render) wipes the disk. */
public class LocalFileStore implements FileStore {

    private final Path base;

    public LocalFileStore(Path base) throws IOException {
        this.base = base.toAbsolutePath().normalize();
        Files.createDirectories(this.base);
    }

    private Path path(String key) throws IOException {
        if (!FileStore.validKey(key)) throw new IOException("Invalid file key");
        Path p = base.resolve(key).normalize();
        if (!p.startsWith(base) || !p.getParent().equals(base)) throw new IOException("Invalid file key");
        return p;
    }

    @Override
    public void put(String key, InputStream in, long length) throws IOException {
        Path target = path(key);
        Path tmp = Files.createTempFile(base, ".upload-", ".tmp");
        try {
            long copied = Files.copy(in, tmp, StandardCopyOption.REPLACE_EXISTING);
            if (copied != length) throw new IOException("Expected " + length + " bytes but received " + copied);
            Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } finally {
            Files.deleteIfExists(tmp);
        }
    }

    @Override
    public InputStream open(String key) throws IOException {
        return Files.newInputStream(path(key));
    }

    @Override
    public long size(String key) throws IOException {
        return Files.size(path(key));
    }

    @Override
    public boolean exists(String key) throws IOException {
        return Files.isRegularFile(path(key));
    }

    @Override
    public void delete(String key) throws IOException {
        Files.deleteIfExists(path(key));
    }

    @Override
    public int deleteAll() throws IOException {
        int n = 0;
        try (Stream<Path> s = Files.list(base)) {
            for (Path p : (Iterable<Path>) s::iterator) {
                if (Files.isRegularFile(p) && FileStore.validKey(p.getFileName().toString())) { Files.deleteIfExists(p); n++; }
            }
        }
        return n;
    }

    @Override
    public String describe() {
        return "local disk at " + base;
    }
}
