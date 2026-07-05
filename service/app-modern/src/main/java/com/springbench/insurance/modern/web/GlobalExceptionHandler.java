package com.springbench.insurance.modern.web;

import com.springbench.insurance.domain.exception.IllegalStatusTransitionException;
import com.springbench.insurance.domain.exception.NotFoundException;
import com.springbench.insurance.modern.web.dto.ProblemDetailResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class GlobalExceptionHandler {
    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(NotFoundException.class)
    public ResponseEntity<ProblemDetailResponse> notFound(NotFoundException ex, HttpServletRequest request) {
        return problem(HttpStatus.NOT_FOUND, "Not found", ex.getMessage(), request, null);
    }

    @ExceptionHandler(IllegalStatusTransitionException.class)
    public ResponseEntity<ProblemDetailResponse> conflict(IllegalStatusTransitionException ex, HttpServletRequest request) {
        return problem(HttpStatus.CONFLICT, "Conflict", ex.getMessage(), request, null);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ProblemDetailResponse> validation(MethodArgumentNotValidException ex, HttpServletRequest request) {
        Map<String, String> errors = new LinkedHashMap<String, String>();
        for (FieldError fieldError : ex.getBindingResult().getFieldErrors()) {
            errors.put(fieldError.getField(), fieldError.getDefaultMessage());
        }
        return problem(HttpStatus.BAD_REQUEST, "Validation failed", "Request validation failed", request, errors);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ProblemDetailResponse> generic(Exception ex, HttpServletRequest request) {
        log.error("Unhandled exception on {}", request.getRequestURI(), ex);
        return problem(HttpStatus.INTERNAL_SERVER_ERROR, "Internal error", "Unexpected server error", request, null);
    }

    private ResponseEntity<ProblemDetailResponse> problem(HttpStatus status, String title, String detail,
                                                          HttpServletRequest request, Map<String, String> errors) {
        ProblemDetailResponse body = new ProblemDetailResponse();
        body.setType("https://bench.local/errors/" + status.value());
        body.setTitle(title);
        body.setStatus(status.value());
        body.setDetail(detail);
        body.setInstance(request.getRequestURI());
        body.setRequestId(RequestIdFilter.currentRequestId(request));
        if (errors != null) {
            body.setErrors(errors);
        }
        return ResponseEntity.status(status).header("Content-Type", "application/problem+json").body(body);
    }
}
