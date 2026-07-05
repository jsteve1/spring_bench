package com.springbench.insurance.legacy.web;

import com.springbench.insurance.domain.model.LifeInsuranceAgreement;
import com.springbench.insurance.legacy.web.dto.AgreementRequest;
import com.springbench.insurance.persistence.service.CoreServices;
import javax.servlet.http.HttpServletRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.Map;

@RestController
public class AgreementController {
    private final CoreServices coreServices;

    public AgreementController(CoreServices coreServices) {
        this.coreServices = coreServices;
    }

    @PostMapping("/agreements")
    public ResponseEntity<Map<String, Object>> create(@RequestBody AgreementRequest request,
                                                      HttpServletRequest httpRequest) {
        LifeInsuranceAgreement agreement = coreServices.agreements.createAgreement(
                ApiMapper.toAgreement(request), UserContext.actor(httpRequest));
        return ResponseEntity.created(URI.create("/agreements/" + agreement.getId()))
                .body(ApiMapper.toAgreementMap(agreement));
    }

    @PutMapping("/agreements/{id}")
    public Map<String, Object> update(@PathVariable String id,
                                      @RequestBody AgreementRequest request,
                                      HttpServletRequest httpRequest) {
        LifeInsuranceAgreement agreement = coreServices.agreements.updateAgreement(
                id, ApiMapper.toAgreementUpdate(request), UserContext.actor(httpRequest));
        return ApiMapper.toAgreementMap(agreement);
    }
}
