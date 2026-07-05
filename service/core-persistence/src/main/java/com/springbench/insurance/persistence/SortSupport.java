package com.springbench.insurance.persistence;

public final class SortSupport {
    private SortSupport() {
    }

    public static String toOrderClause(String sort, String defaultColumn) {
        if (sort == null || sort.trim().isEmpty()) {
            return defaultColumn + " DESC";
        }
        String[] parts = sort.split(",", 2);
        String column = parts[0].trim();
        String direction = parts.length > 1 ? parts[1].trim().toUpperCase() : "DESC";
        if (!"ASC".equals(direction) && !"DESC".equals(direction)) {
            direction = "DESC";
        }
        if (!isAllowed(column)) {
            column = defaultColumn;
        }
        return column + " " + direction;
    }

    private static boolean isAllowed(String column) {
        return "created".equals(column) || "updated".equals(column) || "status".equals(column);
    }
}
