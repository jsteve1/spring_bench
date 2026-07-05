package com.springbench.insurance.domain.service;

import com.springbench.insurance.domain.model.Demographics;
import com.springbench.insurance.domain.model.LifeInsuranceAgreement;
import com.springbench.insurance.domain.model.Member;
import com.springbench.insurance.domain.model.PageResult;

public interface MemberService {
    Member createMember(Demographics demographics, String agreementId, String updatedBy);

    Member getMember(String id);

    PageResult<Member> listMembers(int page, int size, String sort);

    Member updateMember(String id, EntityUpdate update, String updatedBy);

    Member archiveMember(String id, String updatedBy);

    Member attachAgreement(String memberId, String agreementId, String updatedBy);
}
