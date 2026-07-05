package com.springbench.insurance.persistence.dao;

import com.springbench.insurance.domain.enums.DemographicsStatus;
import com.springbench.insurance.domain.model.Demographics;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class DemographicsDao {
    public void insert(Connection connection, Demographics demographics) throws SQLException {
        String sql = "INSERT INTO demographics (id, fname, lname, email, phone_number, status, created, updated, updated_by) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            bind(ps, demographics);
            ps.executeUpdate();
        }
    }

    public Demographics findById(Connection connection, String id) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement(
                "SELECT id, fname, lname, email, phone_number, status, created, updated, updated_by "
                        + "FROM demographics WHERE id = ?")) {
            ps.setString(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                return map(rs);
            }
        }
    }

    private void bind(PreparedStatement ps, Demographics demographics) throws SQLException {
        ps.setString(1, demographics.getId());
        ps.setString(2, demographics.getFname());
        ps.setString(3, demographics.getLname());
        ps.setString(4, demographics.getEmail());
        ps.setString(5, demographics.getPhoneNumber());
        ps.setString(6, demographics.getStatus().name());
        ps.setString(7, demographics.getCreated());
        ps.setString(8, demographics.getUpdated());
        ps.setString(9, demographics.getUpdatedBy());
    }

    private Demographics map(ResultSet rs) throws SQLException {
        Demographics demographics = new Demographics();
        demographics.setId(rs.getString("id"));
        demographics.setFname(rs.getString("fname"));
        demographics.setLname(rs.getString("lname"));
        demographics.setEmail(rs.getString("email"));
        demographics.setPhoneNumber(rs.getString("phone_number"));
        demographics.setStatus(DemographicsStatus.fromString(rs.getString("status")));
        demographics.setCreated(rs.getString("created"));
        demographics.setUpdated(rs.getString("updated"));
        demographics.setUpdatedBy(rs.getString("updated_by"));
        return demographics;
    }
}
