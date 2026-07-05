package com.springbench.insurance.persistence.dao;

import com.springbench.insurance.domain.enums.AgreementStatus;
import com.springbench.insurance.domain.model.LifeInsuranceAgreement;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;

public class AgreementDao {
    public void insert(Connection connection, LifeInsuranceAgreement agreement) throws SQLException {
        String sql = "INSERT INTO life_insurance_agreement "
                + "(id, created, updated, updated_by, expiry_date, sent_date, pdf_link, status) "
                + "VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            bind(ps, agreement);
            ps.executeUpdate();
        }
    }

    public void update(Connection connection, LifeInsuranceAgreement agreement) throws SQLException {
        String sql = "UPDATE life_insurance_agreement SET updated = ?, updated_by = ?, expiry_date = ?, "
                + "sent_date = ?, pdf_link = ?, status = ? WHERE id = ?";
        try (PreparedStatement ps = connection.prepareStatement(sql)) {
            ps.setString(1, agreement.getUpdated());
            ps.setString(2, agreement.getUpdatedBy());
            ps.setString(3, agreement.getExpiryDate());
            ps.setString(4, agreement.getSentDate());
            ps.setString(5, agreement.getPdfLink());
            ps.setString(6, agreement.getStatus().name());
            ps.setString(7, agreement.getId());
            ps.executeUpdate();
        }
    }

    public LifeInsuranceAgreement findById(Connection connection, String id) throws SQLException {
        try (PreparedStatement ps = connection.prepareStatement(
                "SELECT id, created, updated, updated_by, expiry_date, sent_date, pdf_link, status "
                        + "FROM life_insurance_agreement WHERE id = ?")) {
            ps.setString(1, id);
            try (ResultSet rs = ps.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                return map(rs);
            }
        }
    }

    private void bind(PreparedStatement ps, LifeInsuranceAgreement agreement) throws SQLException {
        ps.setString(1, agreement.getId());
        ps.setString(2, agreement.getCreated());
        ps.setString(3, agreement.getUpdated());
        ps.setString(4, agreement.getUpdatedBy());
        ps.setString(5, agreement.getExpiryDate());
        ps.setString(6, agreement.getSentDate());
        ps.setString(7, agreement.getPdfLink());
        ps.setString(8, agreement.getStatus().name());
    }

    private LifeInsuranceAgreement map(ResultSet rs) throws SQLException {
        LifeInsuranceAgreement agreement = new LifeInsuranceAgreement();
        agreement.setId(rs.getString("id"));
        agreement.setCreated(rs.getString("created"));
        agreement.setUpdated(rs.getString("updated"));
        agreement.setUpdatedBy(rs.getString("updated_by"));
        agreement.setExpiryDate(rs.getString("expiry_date"));
        agreement.setSentDate(rs.getString("sent_date"));
        agreement.setPdfLink(rs.getString("pdf_link"));
        agreement.setStatus(AgreementStatus.fromString(rs.getString("status")));
        return agreement;
    }
}
