package com.taskis.backend.config;

import com.taskis.backend.security.JwtUtil;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private UserDetailsService userDetailsService;

    @Autowired
    private com.taskis.backend.repositories.UserRepository userRepository;

    /** Mirror of the REST channel ACL — authorizes which topics a client may subscribe to. */
    private boolean canAccess(String username, String channel) {
        if (channel == null || channel.equals("feed")) return true; // public feed topic
        com.taskis.backend.models.User u = username == null ? null : userRepository.findByUsername(username).orElse(null);
        if (u == null) return false;
        if (channel.startsWith("dm_")) {
            String[] parts = channel.split("_");
            if (parts.length != 3 || u.getId() == null) return false;
            try {
                return u.getId().equals(Long.parseLong(parts[1])) || u.getId().equals(Long.parseLong(parts[2]));
            } catch (NumberFormatException e) { return false; }
        }
        if (channel.equals("confidential")) return Boolean.TRUE.equals(u.getConfidentialUnlocked());
        return true;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic", "/queue");
        config.setApplicationDestinationPrefixes("/app");
        config.setUserDestinationPrefix("/user");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        registry.addEndpoint("/ws")
                .setAllowedOriginPatterns("*")
                .withSockJS();
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (StompCommand.CONNECT.equals(accessor.getCommand())) {
                    String authHeader = accessor.getFirstNativeHeader("Authorization");
                    if (authHeader != null && authHeader.startsWith("Bearer ")) {
                        String token = authHeader.substring(7);
                        try {
                            String username = jwtUtil.extractUsername(token);
                            if (username != null) {
                                UserDetails userDetails = userDetailsService.loadUserByUsername(username);
                                if (userDetails.isEnabled() && jwtUtil.validateToken(token, userDetails.getUsername())) {
                                    UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                                            userDetails, null, userDetails.getAuthorities());
                                    SecurityContextHolder.getContext().setAuthentication(auth);
                                    accessor.setUser(auth);
                                }
                            }
                        } catch (Exception e) {
                            System.out.println("Invalid WebSocket JWT: " + e.getMessage());
                        }
                    }
                }
                // Authorize subscriptions: a client may only subscribe to topics it can access.
                if (StompCommand.SUBSCRIBE.equals(accessor.getCommand())) {
                    String dest = accessor.getDestination();
                    if (dest != null && dest.startsWith("/topic/")) {
                        String ch = dest.substring("/topic/".length());
                        if (ch.endsWith(".typing")) ch = ch.substring(0, ch.length() - ".typing".length());
                        String username = accessor.getUser() != null ? accessor.getUser().getName() : null;
                        if (!canAccess(username, ch)) {
                            // Drop the subscription silently — the client simply receives nothing.
                            return null;
                        }
                    }
                }
                return message;
            }
        });
    }
}
