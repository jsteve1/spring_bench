package com.springbench.insurance.domain;

import com.springbench.insurance.domain.enums.AgreementStatus;
import com.springbench.insurance.domain.enums.EntityStatus;
import com.springbench.insurance.domain.exception.IllegalStatusTransitionException;

public final class StatusTransitions {
    private StatusTransitions() {
    }

    public static void assertMemberTransition(EntityStatus from, EntityStatus to) {
        if (from == to) {
            return;
        }
        if (from == EntityStatus.ARCHIVED) {
            throw new IllegalStatusTransitionException("Member already archived");
        }
        if (to == EntityStatus.ARCHIVED || to == EntityStatus.ACTIVE || to == EntityStatus.INACTIVE) {
            return;
        }
        throw new IllegalStatusTransitionException("Invalid member status: " + to);
    }

    public static void assertDependentTransition(EntityStatus from, EntityStatus to) {
        assertMemberTransition(from, to);
    }

    public static void assertAgreementTransition(AgreementStatus from, AgreementStatus to) {
        if (from == to) {
            return;
        }
        if (from == AgreementStatus.ARCHIVED) {
            throw new IllegalStatusTransitionException("Agreement already archived");
        }
        if (to == AgreementStatus.ARCHIVED || to == AgreementStatus.ACTIVE
                || to == AgreementStatus.INACTIVE || to == AgreementStatus.PENDING
                || to == AgreementStatus.EXPIRED) {
            return;
        }
        throw new IllegalStatusTransitionException("Invalid agreement status: " + to);
    }
}
