package com.springbench.insurance.persistence.service;

import com.springbench.insurance.domain.service.AgreementService;
import com.springbench.insurance.domain.service.AuditService;
import com.springbench.insurance.domain.service.DependentService;
import com.springbench.insurance.domain.service.MemberService;
import com.springbench.insurance.domain.service.SeedService;

import javax.sql.DataSource;

public final class CoreServices {
    public final MemberService members;
    public final AgreementService agreements;
    public final DependentService dependents;
    public final AuditService audit;
    public final SeedService seed;

    public CoreServices(DataSource dataSource) {
        this.members = new MemberServiceImpl(dataSource);
        this.agreements = new AgreementServiceImpl(dataSource);
        this.dependents = new DependentServiceImpl(dataSource);
        this.audit = new AuditServiceImpl(dataSource);
        this.seed = new SeedServiceImpl(members);
    }
}
