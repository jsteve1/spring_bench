package com.springbench.insurance.persistence.service;

import com.springbench.insurance.domain.DomainIds;
import com.springbench.insurance.domain.DomainTime;
import com.springbench.insurance.domain.StatusTransitions;
import com.springbench.insurance.domain.enums.AgreementStatus;
import com.springbench.insurance.domain.enums.AuditAction;
import com.springbench.insurance.domain.enums.EntityType;
import com.springbench.insurance.domain.exception.NotFoundException;
import com.springbench.insurance.domain.model.LifeInsuranceAgreement;
import com.springbench.insurance.domain.service.AgreementService;
import com.springbench.insurance.domain.service.EntityUpdate;
import com.springbench.insurance.persistence.JdbcTransactions;
import com.springbench.insurance.persistence.dao.AgreementDao;

import javax.sql.DataSource;
import java.sql.SQLException;

public class AgreementServiceImpl implements AgreementService {
    private final DataSource dataSource;
    private final AgreementDao agreementDao = new AgreementDao();
    private final AuditWriter auditWriter = new AuditWriter();

    public AgreementServiceImpl(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public LifeInsuranceAgreement createAgreement(LifeInsuranceAgreement agreement, String updatedBy) {
        try {
            return JdbcTransactions.inTransaction(dataSource, connection -> {
                String now = DomainTime.now();
                agreement.setId(DomainIds.newId());
                if (agreement.getStatus() == null) {
                    agreement.setStatus(AgreementStatus.PENDING);
                }
                agreement.setCreated(now);
                agreement.setUpdated(now);
                agreement.setUpdatedBy(updatedBy);
                agreementDao.insert(connection, agreement);
                auditWriter.write(connection, "Created agreement " + agreement.getId(), EntityType.AGREEMENT,
                        agreement.getId(), AuditAction.CREATE, updatedBy);
                return agreementDao.findById(connection, agreement.getId());
            });
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to create agreement", ex);
        }
    }

    @Override
    public LifeInsuranceAgreement updateAgreement(String id, EntityUpdate update, String updatedBy) {
        try {
            return JdbcTransactions.inTransaction(dataSource, connection -> {
                LifeInsuranceAgreement agreement = agreementDao.findById(connection, id);
                if (agreement == null) {
                    throw new NotFoundException("Agreement not found: " + id);
                }
                if (update.getAgreementStatus() != null) {
                    StatusTransitions.assertAgreementTransition(agreement.getStatus(), update.getAgreementStatus());
                    agreement.setStatus(update.getAgreementStatus());
                }
                if (update.getExpiryDate() != null) {
                    agreement.setExpiryDate(update.getExpiryDate());
                }
                if (update.getSentDate() != null) {
                    agreement.setSentDate(update.getSentDate());
                }
                if (update.getPdfLink() != null) {
                    agreement.setPdfLink(update.getPdfLink());
                }
                agreement.setUpdated(DomainTime.now());
                agreement.setUpdatedBy(updatedBy);
                agreementDao.update(connection, agreement);
                auditWriter.write(connection, "Updated agreement " + id, EntityType.AGREEMENT, id,
                        AuditAction.UPDATE, updatedBy);
                return agreementDao.findById(connection, id);
            });
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to update agreement", ex);
        }
    }
}
