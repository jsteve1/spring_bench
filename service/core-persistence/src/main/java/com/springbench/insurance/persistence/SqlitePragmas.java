package com.springbench.insurance.persistence;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;

public final class SqlitePragmas {
    private SqlitePragmas() {
    }

    public static void apply(Connection connection) throws SQLException {
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA journal_mode=WAL");
            statement.execute("PRAGMA synchronous=NORMAL");
            statement.execute("PRAGMA busy_timeout=5000");
            statement.execute("PRAGMA foreign_keys=ON");
        }
    }

    public static void apply(DataSource dataSource) throws SQLException {
        try (Connection connection = dataSource.getConnection()) {
            apply(connection);
        }
    }
}
