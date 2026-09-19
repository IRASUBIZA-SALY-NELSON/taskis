package com.taskis.backend;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/** Spring Boot entry point for the Taskis API (HTTP + WebSocket, default port 8080). */
@SpringBootApplication
public class BackendApplication {

	public static void main(String[] args) {
		String uri = System.getenv("MONGODB_URI");
		if (uri == null || uri.isBlank()) {
			System.err.println("MONGODB_URI is not set. On Render add the Atlas mongodb+srv:// URI.");
			System.exit(1);
		}
		SpringApplication.run(BackendApplication.class, args);
	}

}
