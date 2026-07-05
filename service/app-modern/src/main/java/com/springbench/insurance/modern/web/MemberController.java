package com.springbench.insurance.modern.web;

import com.springbench.insurance.domain.model.AuditEntry;
import com.springbench.insurance.domain.model.Member;
import com.springbench.insurance.domain.model.PageResult;
import com.springbench.insurance.modern.config.BenchProperties;
import com.springbench.insurance.modern.web.dto.AddDependentRequest;
import com.springbench.insurance.modern.web.dto.AttachAgreementRequest;
import com.springbench.insurance.modern.web.dto.CreateMemberRequest;
import com.springbench.insurance.modern.web.dto.UpdateMemberRequest;
import com.springbench.insurance.persistence.service.CoreServices;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
public class MemberController {
    private final CoreServices coreServices;
    private final BenchProperties benchProperties;

    public MemberController(CoreServices coreServices, BenchProperties benchProperties) {
        this.coreServices = coreServices;
        this.benchProperties = benchProperties;
    }

    @GetMapping("/members")
    public Map<String, Object> list(@RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "20") int size,
                                    @RequestParam(defaultValue = "created,desc") String sort) {
        PageResult<Member> result = coreServices.members.listMembers(page, size, sort);
        List<Map<String, Object>> content = new ArrayList<Map<String, Object>>();
        for (Member member : result.getContent()) {
            content.add(ApiMapper.toMemberMap(member));
        }
        return ApiMapper.toPageMap(result, content);
    }

    @PostMapping("/members")
    public ResponseEntity<Map<String, Object>> create(@Valid @RequestBody CreateMemberRequest request,
                                                      HttpServletRequest httpRequest) {
        Member member = coreServices.members.createMember(
                ApiMapper.toDemographics(request.getDemographics()),
                request.getAgreementId(),
                UserContext.actor(httpRequest));
        return ResponseEntity.created(URI.create("/members/" + member.getId())).body(ApiMapper.toMemberMap(member));
    }

    @GetMapping("/members/{id}")
    public Map<String, Object> get(@PathVariable String id) {
        return ApiMapper.toMemberMap(coreServices.members.getMember(id));
    }

    @PutMapping("/members/{id}")
    public Map<String, Object> update(@PathVariable String id,
                                      @RequestBody UpdateMemberRequest request,
                                      HttpServletRequest httpRequest) {
        Member member = coreServices.members.updateMember(id, ApiMapper.toEntityUpdate(request),
                UserContext.actor(httpRequest));
        return ApiMapper.toMemberMap(member);
    }

    @DeleteMapping("/members/{id}")
    public Map<String, Object> delete(@PathVariable String id, HttpServletRequest httpRequest) {
        Member member = coreServices.members.archiveMember(id, UserContext.actor(httpRequest));
        return ApiMapper.toMemberMap(member);
    }

    @PostMapping("/members/{id}/dependents")
    public ResponseEntity<Map<String, Object>> addDependent(@PathVariable String id,
                                                             @Valid @RequestBody AddDependentRequest request,
                                                             HttpServletRequest httpRequest) {
        var dependent = coreServices.dependents.addDependent(id, ApiMapper.toDemographics(request.getDemographics()),
                UserContext.actor(httpRequest));
        return ResponseEntity.status(HttpStatus.CREATED).body(ApiMapper.toDependentMap(dependent));
    }

    @PostMapping("/members/{id}/agreement")
    public Map<String, Object> attachAgreement(@PathVariable String id,
                                               @RequestBody AttachAgreementRequest request,
                                               HttpServletRequest httpRequest) {
        Member member = coreServices.members.attachAgreement(id, request.getAgreementId(), UserContext.actor(httpRequest));
        return ApiMapper.toMemberMap(member);
    }

    @PostMapping("/seed")
    public Map<String, Object> seed(@RequestParam(defaultValue = "10") int count, HttpServletRequest httpRequest) {
        if (!benchProperties.getSeed().isEnabled()) {
            throw new IllegalStateException("Seed endpoint disabled");
        }
        var result = coreServices.seed.seed(count, UserContext.actor(httpRequest));
        Map<String, Object> body = new LinkedHashMap<String, Object>();
        body.put("created", result.getCreated());
        body.put("elapsedMs", result.getElapsedMs());
        return body;
    }
}
