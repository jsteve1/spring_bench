package com.springbench.insurance.persistence.dao;

import com.springbench.insurance.domain.enums.EntityStatus;
import com.springbench.insurance.domain.model.Dependent;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public class DependentDao {
    public void insert(Connection connection, Dependent dependent, String demographicsId) throws SQLException {
        String sql = "INSERT INTO dependent (id, demographics_id, member_id, created, updated, updated_by, status) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?)";
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, dependent.getId());
            ps.setString(2, demographicsId);
            ps.setString(3, dependent.getMemberId());
            ps.setString(4, dependent.getCreated());
            ps.setString(5, dependent.getUpdated());
            ps.setString(6, dependent.getUpdatedBy());
            ps.setString(7, dependent.getStatus().name());
            ps.executeUpdate();
        }
    }

    public List<Dependent> findByMemberId(Connection connection, String memberId) throws SQLException {
        String sql = "SELECT id, demographics_id, member_id, created, updated, updated_by, status "
                + "FROM dependent WHERE member_id = ?";
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, memberId);
            try (ResultSet rs = ps.executeQuery()) {
                List<Dependent> dependents = new ArrayList<Dependent>();
                while (rs.next()) {
                    dependents.add(mapRow(rs));
                }
                return dependents;
            }
        }
    }

    private Dependent mapRow(ResultSet rs) throws SQLException {
        Dependent dependent = new Dependent();
        dependent.setId(rs.getString("id"));
        dependent.setDemographicsId(rs.getString("demographics_id"));
        dependent.setMemberId(rs.getString("member_id"));
        dependent.setStatus(EntityStatus.fromString(rs.getString("status")));
        dependent.setCreated(rs.getString("created"));
        dependent.setUpdated(rs.getString("updated"));
        dependent.setUpdatedBy(rs.getString("updated_by"));
        return dependent;
    }
}
