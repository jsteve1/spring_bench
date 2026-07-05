package com.springbench.insurance.modern.web;

import jakarta.servlet.http.HttpServletRequest;

public final class UserContext {
    private UserContext() {
    }

    public static String actor(HttpServletRequest request) {
        String user = request.getHeader("X-User");
        return user == null || user.isEmpty() ? "system" : user;
    }
}
