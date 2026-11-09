package com.taskis.backend.services;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PushTextTest {

    private static final String SECRET = "the launch code is 4471";

    @Test
    void hiddenModeNeverLeaksTheMessage() {
        for (String channel : new String[] {"dm_1_2", "general", "confidential"}) {
            var t = PushText.build(channel, "Nelson", 3, true, SECRET, false);
            assertFalse((t.title() + t.body()).contains("4471"), channel);
        }
    }

    @Test
    void confidentialIsHiddenEvenWhenContentIsAllowed() {
        var t = PushText.build("confidential", "Nelson", 1, false, SECRET, false);
        assertFalse((t.title() + t.body()).contains("4471"));
    }

    @Test
    void dmShowsWhoAndHowMany() {
        assertEquals("Nelson", PushText.build("dm_1_2", "Nelson", 1, true, "x", false).title());
        assertEquals("sent you a message", PushText.build("dm_1_2", "Nelson", 1, true, "x", false).body());
        assertEquals("sent you 4 messages", PushText.build("dm_1_2", "Nelson", 4, true, "x", false).body());
    }

    @Test
    void channelShowsCountOrSender() {
        assertEquals("#general", PushText.build("general", "Nelson", 2, true, "x", false).title());
        assertEquals("Nelson sent a message", PushText.build("general", "Nelson", 1, true, "x", false).body());
        assertEquals("5 new messages", PushText.build("general", "Nelson", 5, true, "x", false).body());
    }

    @Test
    void visibleModeShowsTextAndTruncates() {
        assertEquals("hello", PushText.build("dm_1_2", "Nelson", 1, false, "hello", false).body());
        assertEquals("Nelson: hi", PushText.build("general", "Nelson", 1, false, "hi", false).body());
        assertTrue(PushText.build("dm_1_2", "N", 1, false, "a".repeat(500), false).body().length() <= 120);
    }
}
