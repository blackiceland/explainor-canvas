import {makeScene2D, Code, Rect} from '@motion-canvas/2d';
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

    const sharedLogic = `    if (!user.isEmailVerified()) {
        throw new IllegalStateException("Email not verified");
    }
    if (user.hasActiveSubscription()) {
        throw new IllegalStateException("Subscription already active");
    }`;

    // ===== LAYOUT =====
    const LEFT_X = -480;
    const RIGHT_X = 480;
    const CODE_Y = 0;
    const FONT_SIZE = 20;

    // ===== REFS =====
    const codeLeftRef = createRef<Code>();
    const codeRightRef = createRef<Code>();
    
    // Highlight boxes (semi-transparent overlay on the shared code)
    const highlightLeftRef = createRef<Rect>();
    const highlightRightRef = createRef<Rect>();
    
    // Shared code blocks that will move to center
    const sharedLeftRef = createRef<Code>();
    const sharedRightRef = createRef<Code>();

    // ===== CREATE ELEMENTS =====

    // Main code blocks (no background, just code on scene bg)
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

    // Highlight overlays (positioned over shared code lines)
    // Shared code is lines 1-6 (0-indexed), starting after function signature
    // Line height ~= fontSize * 1.5 = 30px
    // Signature is line 0. Shared starts at line 1.
    // Offset from code center: need to calculate based on total lines.
    // startTrial has ~17 lines. Center is middle. Line 1 is near top.
    // Total height ~= 17 * 30 = 510px. Center at 0. Top at -255.
    // Line 1 starts at: -255 + 30 = -225 (top of line 1)
    // Shared code is 6 lines = 180px tall.
    // Center of shared: -225 + 90 = -135
    
    const SHARED_CENTER_Y = -105; // Approximate center of shared block relative to card center
    const SHARED_HEIGHT = 190;
    const SHARED_WIDTH = 620;
    
    // Semi-transparent highlight boxes
    view.add(
        <Rect
            ref={highlightLeftRef}
            x={LEFT_X}
            y={SHARED_CENTER_Y}
            width={SHARED_WIDTH}
            height={SHARED_HEIGHT}
            fill={'rgba(46, 134, 171, 0.15)'} // Accent blue, very subtle
            stroke={'#2E86AB'}
            lineWidth={2}
            radius={4}
            opacity={0}
        />
    );

    view.add(
        <Rect
            ref={highlightRightRef}
            x={RIGHT_X}
            y={SHARED_CENTER_Y}
            width={SHARED_WIDTH}
            height={SHARED_HEIGHT}
            fill={'rgba(46, 134, 171, 0.15)'}
            stroke={'#2E86AB'}
            lineWidth={2}
            radius={4}
            opacity={0}
        />
    );

    // Shared code copies (will animate to center)
    // These start invisible and positioned over the original code
    view.add(
        <Code
            ref={sharedLeftRef}
            code={sharedLogic}
            fontFamily={StandardTheme.fonts.code}
            fontSize={FONT_SIZE}
            x={LEFT_X}
            y={SHARED_CENTER_Y}
            opacity={0}
        />
    );

    view.add(
        <Code
            ref={sharedRightRef}
            code={sharedLogic}
            fontFamily={StandardTheme.fonts.code}
            fontSize={FONT_SIZE}
            x={RIGHT_X}
            y={SHARED_CENTER_Y}
            opacity={0}
        />
    );

    // ===== ANIMATION =====

    // ACT 1: Show both methods
    yield* all(
        codeLeftRef().opacity(1, 0.8),
        codeRightRef().opacity(1, 0.8),
    );
    yield* waitFor(1.5);

    // ACT 2: Highlight shared code (X-Ray)
    // Dim the main code
    yield* all(
        codeLeftRef().opacity(0.3, 0.6),
        codeRightRef().opacity(0.3, 0.6),
    );

    // Show highlight boxes
    yield* all(
        highlightLeftRef().opacity(1, 0.4),
        highlightRightRef().opacity(1, 0.4),
    );

    // Show the shared code copies (bright, on top of dimmed code)
    yield* all(
        sharedLeftRef().opacity(1, 0.4),
        sharedRightRef().opacity(1, 0.4),
    );

    yield* waitFor(1.5);

    // ACT 3: Extract to center
    // Hide highlight boxes
    yield* all(
        highlightLeftRef().opacity(0, 0.3),
        highlightRightRef().opacity(0, 0.3),
    );

    // Move shared code to center
    yield* all(
        sharedLeftRef().position([0, 0], 1),
        sharedRightRef().position([0, 0], 1),
        sharedLeftRef().scale(1.15, 1),
        sharedRightRef().scale(1.15, 1),
    );

    yield* waitFor(2);
});
