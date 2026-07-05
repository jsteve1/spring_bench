package com.springbench.insurance.modern.web;

import com.springbench.insurance.domain.model.AuditEntry;
import com.springbench.insurance.domain.model.PageResult;
import com.springbench.insurance.persistence.service.CoreServices;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
public class AuditController {
    private final CoreServices coreServices;

    public AuditController(CoreServices coreServices) {
        this.coreServices = coreServices;
    }

    @GetMapping("/audit")
    public Map<String, Object> list(@RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "20") int size,
                                    @RequestParam(defaultValue = "created,desc") String sort) {
        PageResult<AuditEntry> result = coreServices.audit.listAudit(page, size, sort);
        List<Map<String, Object>> content = new ArrayList<Map<String, Object>>();
        for (AuditEntry entry : result.getContent()) {
            content.add(ApiMapper.toAuditMap(entry));
        }
        return ApiMapper.toPageMap(result, content);
    }
}
