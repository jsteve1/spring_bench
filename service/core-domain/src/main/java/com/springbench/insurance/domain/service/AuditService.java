package com.springbench.insurance.domain.service;

import com.springbench.insurance.domain.model.AuditEntry;
import com.springbench.insurance.domain.model.PageResult;

public interface AuditService {
    PageResult<AuditEntry> listAudit(int page, int size, String sort);
}
