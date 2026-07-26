package com.springbench.insurance.legacy.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.crypto.factory.PasswordEncoderFactories;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.util.StringUtils;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.Arrays;
import java.util.Collections;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
    private final AppProperties appProperties;

    public SecurityConfig(AppProperties appProperties) {
        this.appProperties = appProperties;
    }

    @Bean
    public SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
        http.csrf().disable();
        if (!appProperties.getSecurity().isEnabled()) {
            http.authorizeRequests().anyRequest().permitAll();
            return http.build();
        }

        http.authorizeRequests()
                .antMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                .antMatchers(HttpMethod.GET,
                        "/health",
                        "/members",
                        "/members/**",
                        "/agreements",
                        "/agreements/**",
                        "/audit/**",
                        "/events",
                        "/v3/api-docs",
                        "/v3/api-docs/**",
                        "/swagger-ui.html",
                        "/swagger-ui/**",
                        "/actuator/health",
                        "/actuator/health/**",
                        "/actuator/info").permitAll()
                .anyRequest().authenticated()
                .and()
                .httpBasic()
                .and()
                .cors();
        return http.build();
    }

    @Bean
    public UserDetailsService userDetailsService(PasswordEncoder passwordEncoder) {
        UserDetails admin = User.builder()
                .username(appProperties.getSecurity().getAdminUser())
                .password(passwordEncoder.encode(appProperties.getSecurity().getAdminPassword()))
                .roles("ADMIN")
                .build();
        return new InMemoryUserDetailsManager(admin);
    }

    @Bean
    public PasswordEncoder passwordEncoder() {
        return PasswordEncoderFactories.createDelegatingPasswordEncoder();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration config = new CorsConfiguration();
        String origins = appProperties.getCors().getOrigins();
        if (StringUtils.hasText(origins)) {
            config.setAllowedOrigins(Arrays.asList(origins.split("\\s*,\\s*")));
            config.setAllowedMethods(Arrays.asList("GET", "POST", "PUT", "DELETE", "OPTIONS"));
            config.setAllowedHeaders(Collections.singletonList("*"));
            config.setAllowCredentials(true);
        } else {
            config.setAllowedOrigins(Collections.<String>emptyList());
        }
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", config);
        return source;
    }
}
