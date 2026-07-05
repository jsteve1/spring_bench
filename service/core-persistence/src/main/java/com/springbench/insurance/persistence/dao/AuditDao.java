package com.springbench.insurance.persistence.dao;

import com.springbench.insurance.domain.enums.AuditAction;
import com.springbench.insurance.domain.enums.EntityType;
import com.springbench.insurance.domain.model.AuditEntry;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public class AuditDao {
    public void insert(Connection connection, AuditEntry entry) throws SQLException {
        String sql = "INSERT INTO audit (id, change, entity_type, entity_id, action, created, updated, updated_by) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, entry.getId());
            ps.setString(2, entry.getChange());
            ps.setString(3, entry.getEntityType() == null ? null : entry.getEntityType().name());
            ps.setString(4, entry.getEntityId());
            ps.setString(5, entry.getAction() == null ? null : entry.getAction().name());
            ps.setString(6, entry.getCreated());
            ps.setString(7, entry.getUpdated());
            ps.setString(8, entry.getUpdatedBy());
            ps.executeUpdate();
        }
    }

    public List<AuditEntry> list(Connection connection, int page, int size, String orderClause) throws SQLException {
        String sql = "SELECT id, change, entity_type, entity_id, action, created, updated, updated_by "
                + "FROM audit ORDER BY " + orderClause + " LIMIT ? OFFSET ?";
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setInt(1, size);
            ps.setInt(2, page * size);
            try (ResultSet rs = ps.executeQuery()) {
                List<AuditEntry> entries = new ArrayList<AuditEntry>();
                while (rs.next()) {
                    entries.add(map(rs));
                }
                return entries;
            }
        }
    }

    public long count(Connection connection) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement("SELECT COUNT(*) FROM audit");
             ResultSet rs = ps.executeQuery()) {
            rs.next();
            return rs.getLong(1);
        }
    }

    private AuditEntry map(ResultSet rs) throws SQLException {
        AuditEntry entry = new AuditEntry();
        entry.setId(rs.getString("id"));
        entry.setChange(rs.getString("change"));
        String entityType = rs.getString("entity_type");
        if (entityType != null) {
            entry.setEntityType(EntityType.fromString(entityType));
        }
        entry.setEntityId(rs.getString("entity_id"));
        String action = rs.getString("action");
        if (action != null) {
            entry.setAction(AuditAction.fromString(action));
        }
        entry.setCreated(rs.getString("created"));
        entry.setUpdated(rs.getString("updated"));
        entry.setUpdatedBy(rs.getString("updated_by"));
        return entry;
    }
}
