package com.springbench.insurance.modern.config;

import com.springbench.insurance.persistence.SqlitePragmas;
import com.springbench.insurance.persistence.service.CoreServices;
import com.zaxxer.hikari.HikariConfig;
import com.zaxxer.hikari.HikariDataSource;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import javax.sql.DataSource;
import java.sql.SQLException;

@Configuration
public class CoreConfig {

    @Bean
    DataSource dataSource(
            @Value("${spring.datasource.url}") String jdbcUrl,
            @Value("${spring.datasource.driver-class-name}") String driverClassName,
            @Value("${spring.datasource.hikari.maximum-pool-size:1}") int poolSize,
            @Value("${spring.datasource.hikari.pool-name:insurance-write}") String poolName) throws SQLException {
        HikariConfig config = new HikariConfig();
        config.setJdbcUrl(jdbcUrl);
        config.setDriverClassName(driverClassName);
        config.setMaximumPoolSize(poolSize);
        config.setPoolName(poolName);
        HikariDataSource dataSource = new HikariDataSource(config);
        SqlitePragmas.apply(dataSource);
        return dataSource;
    }

    @Bean
    CoreServices coreServices(DataSource dataSource) {
        return new CoreServices(dataSource);
    }

    @Bean
    @org.springframework.boot.context.properties.ConfigurationProperties(prefix = "bench")
    BenchProperties benchProperties() {
        return new BenchProperties();
    }
}
