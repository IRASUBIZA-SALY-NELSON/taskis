package com.taskis.backend.config;

import com.taskis.backend.models.Post;
import com.taskis.backend.repositories.CommentRepository;
import com.taskis.backend.repositories.PostRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;

import java.util.Date;
import java.util.List;

@Configuration
@EnableScheduling
public class ScheduledTasks {

    @Autowired
    private PostRepository postRepository;

    @Autowired
    private CommentRepository commentRepository;

    public static final long POST_TTL_MS = 24L * 60 * 60 * 1000; // exactly one day

    // Purge posts (and their comments) older than 24h. Runs every 5 minutes.
    @Scheduled(fixedRate = 5 * 60 * 1000)
    @Transactional
    public void purgeExpiredPosts() {
        Date cutoff = new Date(System.currentTimeMillis() - POST_TTL_MS);
        List<Post> expired = postRepository.findByCreatedAtBefore(cutoff);
        if (expired.isEmpty()) return;
        for (Post p : expired) {
            commentRepository.deleteByPostId(p.getId());
        }
        postRepository.deleteAll(expired);
        System.out.println("[Taskis] Purged " + expired.size() + " expired post(s).");
    }
}
