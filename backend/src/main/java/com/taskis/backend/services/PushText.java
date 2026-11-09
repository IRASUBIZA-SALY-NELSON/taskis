package com.taskis.backend.services;

/**
 * Decides what a push notification says. Message text is only ever included when the
 * recipient turned "hide content" off AND the channel is not #confidential.
 */
public final class PushText {

    public record Text(String title, String body) {}

    private PushText() {}

    public static Text build(String channel, String senderName, int unread, boolean hideContent,
                             String content, boolean hasAttachment) {
        boolean hide = hideContent || "confidential".equals(channel);
        boolean dm = channel != null && channel.startsWith("dm_");
        int n = Math.max(unread, 1);

        String title = dm ? senderName : "#" + channel;
        String body;
        if (hide) {
            if (dm) body = n == 1 ? "sent you a message" : "sent you " + n + " messages";
            else body = n == 1 ? senderName + " sent a message" : n + " new messages";
        } else {
            String snippet = hasAttachment && (content == null || content.isBlank())
                    ? "📎 Attachment"
                    : truncate(content == null ? "" : content.strip(), 120);
            String prefix = dm ? "" : senderName + ": ";
            body = (n > 1 ? "(" + n + ") " : "") + prefix + snippet;
        }
        return new Text(title, body);
    }

    private static String truncate(String s, int max) {
        return s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }
}
