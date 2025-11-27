import {makeScene2D} from '@motion-canvas/2d';
import {all, waitFor} from '@motion-canvas/core';
import {CodeGrid} from '../core/code';

export default makeScene2D(function* (view) {
    view.fill('#1e1e1e');

    const codeLeft = CodeGrid.fromCode(
`void startTrial(User user) {
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
}`,
        {x: -450, y: 0, fontSize: 16}
    );

    const codeRight = CodeGrid.fromCode(
`void startPaid(User user, Plan plan) {
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
}`,
        {x: 450, y: 0, fontSize: 16}
    );

    codeLeft.mount(view);
    codeRight.mount(view);

    yield* all(
        codeLeft.appear(0.8),
        codeRight.appear(0.8),
    );

    yield* waitFor(1.5);

    yield* all(
        codeLeft.highlight(1, 6),
        codeRight.highlight(1, 6),
    );

    yield* waitFor(1.5);

    const extractedLeft = codeLeft.extract(1, 6);
    const extractedRight = codeRight.extract(1, 6);

    extractedLeft.mount(view);
    extractedRight.mount(view);

    yield* all(
        codeLeft.dimAll(0.15),
        codeRight.dimAll(0.15),
        extractedLeft.appear(0.3),
        extractedRight.appear(0.3),
    );

    yield* all(
        extractedLeft.moveTo(0, 0, 1),
        extractedRight.moveTo(0, 0, 1),
    );

    yield* waitFor(2);
});
