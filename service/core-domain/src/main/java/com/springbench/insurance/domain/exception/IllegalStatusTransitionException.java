package com.springbench.insurance.domain.exception;

public class IllegalStatusTransitionException extends RuntimeException {
    public IllegalStatusTransitionException(String message) {
        super(message);
    }
}
