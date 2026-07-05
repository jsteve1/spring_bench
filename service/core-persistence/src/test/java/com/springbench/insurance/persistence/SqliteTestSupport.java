package com.springbench.insurance.persistence;

import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;

import javax.sql.DataSource;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.stream.Collectors;

final class SqliteTestSupport {
    private SqliteTestSupport() {
    }

    static HikariDataSource createWritePool(Path dbFile) throws SQLException, IOException {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl("jdbc:sqlite:" + dbFile.toAbsolutePath());
        config.setDriverClassName("org.sqlite.JDBC");
        config.setMaximumPoolSize(1);
        config.setPoolName("insurance-write-test");
        HikariDataSource dataSource = new HikariDataSource(config);
        SqlitePragmas.apply(dataSource);
        migrate(dataSource);
        return dataSource;
    }

    static Path tempDbFile() throws IOException {
        return Files.createTempFile("springbench-", ".db");
    }

    private static void migrate(DataSource dataSource) throws SQLException, IOException {
        String sql;
        try (InputStream stream = SqliteTestSupport.class.getResourceAsStream("/db/migration/V1__init.sql")) {
            if (stream == null) {
                throw new IllegalStateException("V1__init.sql not found on classpath");
            }
            sql = new BufferedReader(new InputStreamReader(stream, StandardCharsets.UTF_8))
                    .lines()
                    .collect(Collectors.joining("\n"));
        }
        try (Connection connection = dataSource.getConnection();
             Statement statement = connection.createStatement()) {
            for (String fragment : sql.split(";")) {
                String trimmed = fragment.trim();
                if (!trimmed.isEmpty()) {
                    statement.execute(trimmed);
                }
            }
        }
    }
}
