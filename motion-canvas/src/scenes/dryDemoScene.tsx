import {makeScene2D} from '@motion-canvas/2d';
import {waitFor} from '@motion-canvas/core';
import {CodeGrid, dryRefactor} from '../core/code';

const LEFT_X = -420;
const RIGHT_X = 420;
const FONT_SIZE = 14;

const CODE_LEFT = `void startTrial(User user) {
    if (!user.isEmailVerified()) {
        throw new IllegalStateException("Email not verified");
    }
    if (user.hasActiveSubscription()) {
        throw new IllegalStateException("Subscription already active");
    }

    LocalDate start = LocalDate.now();
    LocalDate end = start.plusDays(7);

    Subscription sub = Subscription.trial(user.getId(), start, end);
    subscriptionRepository.save(sub);

    emailService.sendTrialStarted(user.getEmail(), end);
    analytics.track("trial_started", user.getId());
}`;

const CODE_RIGHT = `void startPaid(User user, Plan plan) {
    if (!user.isEmailVerified()) {
        throw new IllegalStateException("Email not verified");
    }
    if (user.hasActiveSubscription()) {
        throw new IllegalStateException("Subscription already active");
    }

    LocalDate start = LocalDate.now();
    LocalDate end = start.plusMonths(1);

    Subscription sub = Subscription.paid(user.getId(), plan.getId(), start, end);
    subscriptionRepository.save(sub);

    emailService.sendPaymentReceipt(user.getEmail(), plan.getPrice());
    analytics.track("paid_started", user.getId());
}`;

const HELPER_CODE = `private void validate(User user) {
    if (!user.isEmailVerified()) {
        throw new IllegalStateException("Email not verified");
    }
    if (user.hasActiveSubscription()) {
        throw new IllegalStateException("Subscription already active");
    }
}`;

const CALL_CODE = '    validate(user);';

export default makeScene2D(function* (view) {
    view.fill('#1a1a2e');

    const codeLeft = CodeGrid.fromCode(CODE_LEFT, {x: LEFT_X, y: 0, fontSize: FONT_SIZE});
    const codeRight = CodeGrid.fromCode(CODE_RIGHT, {x: RIGHT_X, y: 0, fontSize: FONT_SIZE});

    codeLeft.mount(view);
    codeRight.mount(view);

    yield* codeLeft.appear(0.8);
    yield* codeRight.appear(0.8);
    yield* waitFor(1.0);

    yield* codeLeft.highlight(1, 6);
    yield* codeRight.highlight(1, 6);
    yield* waitFor(1.0);

    yield* dryRefactor(
        view,
        [
            {grid: codeLeft, range: [1, 6]},
            {grid: codeRight, range: [1, 6]},
        ],
        HELPER_CODE,
        CALL_CODE,
    );

    yield* waitFor(2.5);
});
