package com.springbench.insurance.persistence.service;

import com.springbench.insurance.domain.enums.AgreementStatus;
import com.springbench.insurance.domain.enums.DemographicsStatus;
import com.springbench.insurance.domain.model.Demographics;
import com.springbench.insurance.domain.model.LifeInsuranceAgreement;
import com.springbench.insurance.domain.service.MemberService;
import com.springbench.insurance.domain.service.SeedResult;
import com.springbench.insurance.domain.service.SeedService;

public class SeedServiceImpl implements SeedService {
    private final MemberService memberService;

    public SeedServiceImpl(MemberService memberService) {
        this.memberService = memberService;
    }

    @Override
    public SeedResult seed(int count, String updatedBy) {
        long start = System.currentTimeMillis();
        for (int i = 0; i < count; i++) {
            Demographics demographics = new Demographics();
            demographics.setFname("Seed");
            demographics.setLname("Member" + i);
            demographics.setEmail("seed" + i + "@example.com");
            demographics.setPhoneNumber("+1-555-" + String.format("%04d", i));
            demographics.setStatus(DemographicsStatus.ALIVE);
            memberService.createMember(demographics, null, updatedBy);
        }
        return new SeedResult(count, System.currentTimeMillis() - start);
    }
}
