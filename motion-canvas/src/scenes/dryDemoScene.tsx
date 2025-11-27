import {makeScene2D} from '@motion-canvas/2d';
import {all, waitFor} from '@motion-canvas/core';
import {CodeBlock} from '../core/code';
import {StandardTheme} from '../core/theme';

export default makeScene2D(function* (view) {
    view.fill('#1e1e1e');

    const codeStartTrial = `void startTrial(User user) {
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

    const codeStartPaid = `void startPaid(User user, Plan plan) {
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

    const codeLeft = new CodeBlock({
        code: codeStartTrial,
        x: -480,
        y: 0,
        fontSize: 18,
    });

    const codeRight = new CodeBlock({
        code: codeStartPaid,
        x: 480,
        y: 0,
        fontSize: 18,
    });

    codeLeft.mount(view, StandardTheme);
    codeRight.mount(view, StandardTheme);

    yield* all(
        codeLeft.appear(0.8),
        codeRight.appear(0.8),
    );
    yield* waitFor(1.5);

    yield* all(
        codeLeft.highlightLines(1, 6),
        codeRight.highlightLines(1, 6),
    );
    yield* waitFor(1.5);

    yield* all(
        codeLeft.flyLinesTo(1, 6, 0, 0, 1),
        codeRight.flyLinesTo(1, 6, 0, 0, 1),
    );

    yield* waitFor(2);
});
