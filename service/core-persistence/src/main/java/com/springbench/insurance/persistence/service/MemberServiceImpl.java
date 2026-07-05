package com.springbench.insurance.persistence.service;

import com.springbench.insurance.domain.DomainIds;
import com.springbench.insurance.domain.DomainTime;
import com.springbench.insurance.domain.StatusTransitions;
import com.springbench.insurance.domain.enums.AuditAction;
import com.springbench.insurance.domain.enums.EntityStatus;
import com.springbench.insurance.domain.enums.EntityType;
import com.springbench.insurance.domain.exception.NotFoundException;
import com.springbench.insurance.domain.model.Demographics;
import com.springbench.insurance.domain.model.Member;
import com.springbench.insurance.domain.model.PageResult;
import com.springbench.insurance.domain.service.EntityUpdate;
import com.springbench.insurance.domain.service.MemberService;
import com.springbench.insurance.persistence.JdbcTransactions;
import com.springbench.insurance.persistence.SortSupport;
import com.springbench.insurance.persistence.dao.AgreementDao;
import com.springbench.insurance.persistence.dao.DemographicsDao;
import com.springbench.insurance.persistence.dao.DependentDao;
import com.springbench.insurance.persistence.dao.MemberDao;

import javax.sql.DataSource;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;

public class MemberServiceImpl implements MemberService {
    private final DataSource dataSource;
    private final MemberDao memberDao = new MemberDao();
    private final DemographicsDao demographicsDao = new DemographicsDao();
    private final AgreementDao agreementDao = new AgreementDao();
    private final DependentDao dependentDao = new DependentDao();
    private final AuditWriter auditWriter = new AuditWriter();
    private final MemberHydrator hydrator = new MemberHydrator();

    public MemberServiceImpl(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    @Override
    public Member createMember(Demographics demographics, String agreementId, String updatedBy) {
        try {
            return JdbcTransactions.inTransaction(dataSource, connection -> {
                String now = DomainTime.now();
                demographics.setId(DomainIds.newId());
                demographics.setCreated(now);
                demographics.setUpdated(now);
                demographics.setUpdatedBy(updatedBy);
                demographicsDao.insert(connection, demographics);

                if (agreementId != null && agreementDao.findById(connection, agreementId) == null) {
                    throw new NotFoundException("Agreement not found: " + agreementId);
                }

                Member member = new Member();
                member.setId(DomainIds.newId());
                member.setStatus(EntityStatus.ACTIVE);
                member.setCreated(now);
                member.setUpdated(now);
                member.setUpdatedBy(updatedBy);
                memberDao.insert(connection, member, demographics.getId(), agreementId);

                auditWriter.write(connection, "Created member " + member.getId(), EntityType.MEMBER,
                        member.getId(), AuditAction.CREATE, updatedBy);
                return hydrator.hydrate(connection, memberDao.findById(connection, member.getId()));
            });
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to create member", ex);
        }
    }

    @Override
    public Member getMember(String id) {
        try {
            return JdbcTransactions.inTransaction(dataSource, connection -> {
                Member member = memberDao.findById(connection, id);
                if (member == null) {
                    throw new NotFoundException("Member not found: " + id);
                }
                return hydrator.hydrate(connection, member);
            });
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to load member", ex);
        }
    }

    @Override
    public PageResult<Member> listMembers(int page, int size, String sort) {
        int cappedSize = Math.min(Math.max(size, 1), 200);
        String orderClause = SortSupport.toOrderClause(sort, "created");
        try {
            return JdbcTransactions.inTransaction(dataSource, connection -> {
                List<Member> rows = memberDao.list(connection, page, cappedSize, orderClause);
                List<Member> hydrated = new ArrayList<Member>();
                for (Member row : rows) {
                    hydrated.add(hydrator.hydrate(connection, row));
                }
                long total = memberDao.count(connection);
                return new PageResult<Member>(hydrated, page, cappedSize, total, sort == null ? "created,desc" : sort);
            });
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to list members", ex);
        }
    }

    @Override
    public Member updateMember(String id, EntityUpdate update, String updatedBy) {
        try {
            return JdbcTransactions.inTransaction(dataSource, connection -> {
                Member member = memberDao.findById(connection, id);
                if (member == null) {
                    throw new NotFoundException("Member not found: " + id);
                }
                if (update.getStatus() != null) {
                    StatusTransitions.assertMemberTransition(member.getStatus(), update.getStatus());
                    member.setStatus(update.getStatus());
                }
                if (update.getAgreementId() != null) {
                    if (agreementDao.findById(connection, update.getAgreementId()) == null) {
                        throw new NotFoundException("Agreement not found: " + update.getAgreementId());
                    }
                    member.setAgreementId(update.getAgreementId());
                }
                member.setUpdated(DomainTime.now());
                member.setUpdatedBy(updatedBy);
                memberDao.update(connection, member, member.getAgreementId());
                auditWriter.write(connection, "Updated member " + id, EntityType.MEMBER, id,
                        AuditAction.UPDATE, updatedBy);
                return hydrator.hydrate(connection, memberDao.findById(connection, id));
            });
        } catch (SQLException ex) {
            throw new IllegalStateException("Failed to update member", ex);
        }
    }

    @Override
    public Member archiveMember(String id, String updatedBy) {
        EntityUpdate update = new EntityUpdate();
        update.setStatus(EntityStatus.ARCHIVED);
        return updateMember(id, update, updatedBy);
    }

    @Override
    public Member attachAgreement(String memberId, String agreementId, String updatedBy) {
        EntityUpdate update = new EntityUpdate();
        update.setAgreementId(agreementId);
        return updateMember(memberId, update, updatedBy);
    }

    private final class MemberHydrator {
        Member hydrate(Connection connection, Member member) throws SQLException {
            member.setDemographics(demographicsDao.findById(connection, member.getDemographicsId()));
            if (member.getAgreementId() != null) {
                member.setAgreement(agreementDao.findById(connection, member.getAgreementId()));
            }
            List<com.springbench.insurance.domain.model.Dependent> dependents =
                    dependentDao.findByMemberId(connection, member.getId());
            for (com.springbench.insurance.domain.model.Dependent dependent : dependents) {
                dependent.setDemographics(demographicsDao.findById(connection, dependent.getDemographicsId()));
            }
            member.setDependents(dependents);
            return member;
        }
    }
}
