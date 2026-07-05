package com.springbench.insurance.persistence.dao;

import com.springbench.insurance.domain.enums.EntityStatus;
import com.springbench.insurance.domain.model.Member;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public class MemberDao {
    public void insert(Connection connection, Member member, String demographicsId, String agreementId) throws SQLException {
        String sql = "INSERT INTO member (id, demographics_id, agreement_id, created, updated, updated_by, status) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?)";
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, member.getId());
            ps.setString(2, demographicsId);
            ps.setString(3, agreementId);
            ps.setString(4, member.getCreated());
            ps.setString(5, member.getUpdated());
            ps.setString(6, member.getUpdatedBy());
            ps.setString(7, member.getStatus().name());
            ps.executeUpdate();
        }
    }

    public void update(Connection connection, Member member, String agreementId) throws SQLException {
        String sql = "UPDATE member SET agreement_id = ?, updated = ?, updated_by = ?, status = ? WHERE id = ?";
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, agreementId);
            ps.setString(2, member.getUpdated());
            ps.setString(3, member.getUpdatedBy());
            ps.setString(4, member.getStatus().name());
            ps.setString(5, member.getId());
            ps.executeUpdate();
        }
    }

    public Member findById(Connection connection, String id) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement(
                "SELECT id, demographics_id, agreement_id, created, updated, updated_by, status "
                        + "FROM member WHERE id = ?")) {
            ps.setString(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                return mapRow(rs);
            }
        }
    }

    public List<Member> list(Connection connection, int page, int size, String orderClause) throws SQLException {
        String sql = "SELECT id, demographics_id, agreement_id, created, updated, updated_by, status "
                + "FROM member ORDER BY " + orderClause + " LIMIT ? OFFSET ?";
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setInt(1, size);
            ps.setInt(2, page * size);
            try (ResultSet rs = ps.executeQuery()) {
                List<Member> members = new ArrayList<Member>();
                while (rs.next()) {
                    members.add(mapRow(rs));
                }
                return members;
            }
        }
    }

    public long count(Connection connection) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement("SELECT COUNT(*) FROM member");
             ResultSet rs = ps.executeQuery()) {
            rs.next();
            return rs.getLong(1);
        }
    }

    private Member mapRow(ResultSet rs) throws SQLException {
        Member member = new Member();
        member.setId(rs.getString("id"));
        member.setDemographicsId(rs.getString("demographics_id"));
        member.setAgreementId(rs.getString("agreement_id"));
        member.setStatus(EntityStatus.fromString(rs.getString("status")));
        member.setCreated(rs.getString("created"));
        member.setUpdated(rs.getString("updated"));
        member.setUpdatedBy(rs.getString("updated_by"));
        return member;
    }
}
