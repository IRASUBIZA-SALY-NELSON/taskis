package com.taskis.backend.config;

import com.taskis.backend.models.AuditLog;
import com.taskis.backend.models.Comment;
import com.taskis.backend.models.CustomEmoji;
import com.taskis.backend.models.Message;
import com.taskis.backend.models.OtpCode;
import com.taskis.backend.models.Post;
import com.taskis.backend.models.RegistrationKey;
import com.taskis.backend.models.Report;
import com.taskis.backend.models.User;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.mongodb.core.mapping.event.AbstractMongoEventListener;
import org.springframework.data.mongodb.core.mapping.event.BeforeConvertEvent;
import org.springframework.stereotype.Component;

@Component
public class MongoIdListener extends AbstractMongoEventListener<Object> {

    @Autowired
    private SequenceGenerator sequences;

    @Override
    public void onBeforeConvert(BeforeConvertEvent<Object> event) {
        Object source = event.getSource();
        if (source instanceof User u && u.getId() == null) u.setId(sequences.next("users"));
        else if (source instanceof Message m && m.getId() == null) m.setId(sequences.next("messages"));
        else if (source instanceof Post p && p.getId() == null) p.setId(sequences.next("posts"));
        else if (source instanceof Comment c && c.getId() == null) c.setId(sequences.next("comments"));
        else if (source instanceof Report r && r.getId() == null) r.setId(sequences.next("reports"));
        else if (source instanceof RegistrationKey k && k.getId() == null) k.setId(sequences.next("registration_keys"));
        else if (source instanceof OtpCode o && o.getId() == null) o.setId(sequences.next("otp_codes"));
        else if (source instanceof CustomEmoji e && e.getId() == null) e.setId(sequences.next("custom_emojis"));
        else if (source instanceof AuditLog a && a.getId() == null) a.setId(sequences.next("audit_logs"));
    }
}
