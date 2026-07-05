package com.springbench.insurance.persistence.service;

import com.springbench.insurance.domain.model.AuditEntry;
import com.springbench.insurance.domain.model.PageResult;
import com.springbench.insurance.domain.service.AuditService;
import com.springbench.insurance.persistence.JdbcTransactions;
import com.springbench.insurance.persistence.SortSupport;
import com.springbench.insurance.persistence.dao.AuditDao;

import javax.sql.DataSource;
import java.sql.SQLException;

public class AuditServiceImpl implements AuditService {
    private final DataSource dataSource;
    private final AuditDao auditDao = new AuditDao();

    public AuditServiceImpl(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public PageResult<AuditEntry> listAudit(int page, int size, String sort) {
        int cappedSize = Math.min(Math.max(size, 1), 200);
        String orderClause = SortSupport.toOrderClause(sort, "created");
        try {
            return JdbcTransactions.inTransaction(dataSource, connection -> {
                long total = auditDao.count(connection);
                return new PageResult<AuditEntry>(
                        auditDao.list(connection, page, cappedSize, orderClause),
                        page,
                        cappedSize,
                        total,
                        sort == null ? "created,desc" : sort);
            });
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to list audit entries", ex);
        }
    }
}
