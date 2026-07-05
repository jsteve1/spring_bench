package com.springbench.insurance.persistence;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;

public final class JdbcTransactions {
    private JdbcTransactions() {
    }

    public interface Callback<T> {
        T execute(Connection connection) throws SQLException;
    }

    public static <T> T inTransaction(DataSource dataSource, Callback<T> callback) throws SQLException {
        Connection connection = dataSource.getConnection();
        try {
            SqlitePragmas.apply(connection);
            connection.setAutoCommit(false);
            T result = callback.execute(connection);
            connection.commit();
            return result;
        } catch (SQLException ex) {
            connection.rollback();
            throw ex;
        } catch (RuntimeException ex) {
            connection.rollback();
            throw ex;
        } finally {
            connection.close();
        }
    }
}
