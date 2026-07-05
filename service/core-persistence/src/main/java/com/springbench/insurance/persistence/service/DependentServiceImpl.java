package com.springbench.insurance.persistence.service;

import com.springbench.insurance.domain.DomainIds;
import com.springbench.insurance.domain.DomainTime;
import com.springbench.insurance.domain.enums.AuditAction;
import com.springbench.insurance.domain.enums.EntityStatus;
import com.springbench.insurance.domain.enums.EntityType;
import com.springbench.insurance.domain.exception.NotFoundException;
import com.springbench.insurance.domain.model.Dependent;
import com.springbench.insurance.domain.model.Demographics;
import com.springbench.insurance.domain.service.DependentService;
import com.springbench.insurance.persistence.JdbcTransactions;
import com.springbench.insurance.persistence.dao.DemographicsDao;
import com.springbench.insurance.persistence.dao.DependentDao;
import com.springbench.insurance.persistence.dao.MemberDao;

import javax.sql.DataSource;
import java.sql.SQLException;

public class DependentServiceImpl implements DependentService {
    private final DataSource dataSource;
    private final MemberDao memberDao = new MemberDao();
    private final DemographicsDao demographicsDao = new DemographicsDao();
    private final DependentDao dependentDao = new DependentDao();
    private final AuditWriter auditWriter = new AuditWriter();

    public DependentServiceImpl(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public Dependent addDependent(String memberId, Demographics demographics, String updatedBy) {
        try {
            return JdbcTransactions.inTransaction(dataSource, connection -> {
                if (memberDao.findById(connection, memberId) == null) {
                    throw new NotFoundException("Member not found: " + memberId);
                }
                String now = DomainTime.now();
                demographics.setId(DomainIds.newId());
                demographics.setCreated(now);
                demographics.setUpdated(now);
                demographics.setUpdatedBy(updatedBy);
                demographicsDao.insert(connection, demographics);

                Dependent dependent = new Dependent();
                dependent.setId(DomainIds.newId());
                dependent.setMemberId(memberId);
                dependent.setStatus(EntityStatus.ACTIVE);
                dependent.setCreated(now);
                dependent.setUpdated(now);
                dependent.setUpdatedBy(updatedBy);
                dependentDao.insert(connection, dependent, demographics.getId());
                dependent.setDemographics(demographics);

                auditWriter.write(connection, "Added dependent " + dependent.getId(), EntityType.DEPENDENT,
                        dependent.getId(), AuditAction.CREATE, updatedBy);
                return dependent;
            });
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to add dependent", ex);
        }
    }
}
