import {makeScene2D, Code, lines} from '@motion-canvas/2d';
import {all, waitFor, createRef} from '@motion-canvas/core';
import {StandardTheme} from '../core/theme';

export default makeScene2D(function* (view) {
    // ===== SCENE SETUP =====
    const BG_COLOR = '#1e1e1e';
    view.fill(BG_COLOR);

    // ===== CODE CONTENT =====
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

    // ===== LAYOUT =====
    const LEFT_X = -480;
    const RIGHT_X = 480;
    const CODE_Y = 0;
    const FONT_SIZE = 20;

    // ===== REFS =====
    const codeLeftRef = createRef<Code>();
    const codeRightRef = createRef<Code>();

    // ===== CREATE ELEMENTS =====

    view.add(
        <Code
            ref={codeLeftRef}
            code={codeStartTrial}
            fontFamily={StandardTheme.fonts.code}
            fontSize={FONT_SIZE}
            x={LEFT_X}
            y={CODE_Y}
            opacity={0}
        />
    );

    view.add(
        <Code
            ref={codeRightRef}
            code={codeStartPaid}
            fontFamily={StandardTheme.fonts.code}
            fontSize={FONT_SIZE}
            x={RIGHT_X}
            y={CODE_Y}
            opacity={0}
        />
    );

    // ===== ANIMATION =====

    // ACT 1: Show both methods
    yield* all(
        codeLeftRef().opacity(1, 0.8),
        codeRightRef().opacity(1, 0.8),
    );
    yield* waitFor(2);

    // ACT 2: Highlight shared code using selection
    // lines(start, end) highlights lines from start to end (0-indexed)
    // Shared code is lines 1-6 (the two if-blocks)
    yield* all(
        codeLeftRef().selection(lines(1, 6), 0.6),
        codeRightRef().selection(lines(1, 6), 0.6),
    );

    yield* waitFor(3);

    // ACT 3: Clear selection
    yield* all(
        codeLeftRef().selection([], 0.6),
        codeRightRef().selection([], 0.6),
    );

    yield* waitFor(1);
});
