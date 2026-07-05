package com.springbench.insurance.persistence.service;

import com.springbench.insurance.domain.DomainIds;
import com.springbench.insurance.domain.DomainTime;
import com.springbench.insurance.domain.enums.AuditAction;
import com.springbench.insurance.domain.enums.EntityType;
import com.springbench.insurance.domain.model.AuditEntry;
import com.springbench.insurance.persistence.dao.AuditDao;

import java.sql.Connection;
import java.sql.SQLException;

final class AuditWriter {
    private final AuditDao auditDao = new AuditDao();

    void write(Connection connection, String change, EntityType entityType, String entityId,
               AuditAction action, String updatedBy) throws SQLException {
        AuditEntry entry = new AuditEntry();
        String now = DomainTime.now();
        entry.setId(DomainIds.newId());
        entry.setChange(change);
        entry.setEntityType(entityType);
        entry.setEntityId(entityId);
        entry.setAction(action);
        entry.setCreated(now);
        entry.setUpdated(now);
        entry.setUpdatedBy(updatedBy);
        auditDao.insert(connection, entry);
    }
}
