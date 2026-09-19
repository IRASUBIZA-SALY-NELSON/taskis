package com.taskis.backend.models;

import lombok.Data;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Document("counters")
public class DatabaseSequence {
    @Id
    private String id;
    private long seq;
}
