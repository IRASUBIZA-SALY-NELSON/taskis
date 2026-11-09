package com.taskis.backend.storage;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class LocalFileStoreTest {

    @TempDir
    Path dir;

    @Test
    void roundTripsAndRemoves() throws Exception {
        LocalFileStore s = new LocalFileStore(dir);
        s.put("f1", new ByteArrayInputStream("hello".getBytes()), 5);
        assertTrue(s.exists("f1"));
        assertEquals(5, s.size("f1"));
        assertEquals("hello", new String(s.open("f1").readAllBytes()));
        s.put("f1.meta", new ByteArrayInputStream("text/plain".getBytes()), 10);
        assertEquals(2, s.deleteAll());
        assertFalse(s.exists("f1"));
        assertThrows(NoSuchFileException.class, () -> s.open("f1"));
    }

    @Test
    void aWrongLengthLeavesNothingBehind() throws Exception {
        LocalFileStore s = new LocalFileStore(dir);
        assertThrows(IOException.class, () -> s.put("f2", new ByteArrayInputStream(new byte[10]), 99));
        assertFalse(s.exists("f2"));
        try (var files = Files.list(dir)) { assertEquals(0, files.count()); }
    }

    @Test
    void refusesPathsOutsideTheFolder() throws Exception {
        LocalFileStore s = new LocalFileStore(dir);
        for (String bad : new String[] {"../x", "a/b", "..", ".hidden", "", "a\\b"}) {
            assertThrows(IOException.class, () -> s.open(bad), bad);
        }
    }
}
