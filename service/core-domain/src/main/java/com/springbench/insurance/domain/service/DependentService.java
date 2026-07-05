package com.springbench.insurance.domain.service;

import com.springbench.insurance.domain.model.Dependent;
import com.springbench.insurance.domain.model.Demographics;

public interface DependentService {
    Dependent addDependent(String memberId, Demographics demographics, String updatedBy);
}
