import {makeScene2D} from '@motion-canvas/2d';
import {all, waitFor} from '@motion-canvas/core';
import {CodeGrid, Stage, dryRefactor} from '../core/code';

const FONT_SIZE = 16;

const CODE_LEFT = `void startTrial(User user) {
    if (!user.isEmailVerified()) {
        throw new IllegalStateException("Email not verified");
    }
    if (user.hasActiveSubscription()) {
        throw new IllegalStateException("Already active");
    }

    LocalDate start = LocalDate.now();
    LocalDate end = start.plusDays(7);

    Subscription sub = Subscription.trial(user.getId(), start, end);
    subscriptionRepository.save(sub);
}`;

const CODE_RIGHT = `void startPaid(User user, Plan plan) {
    if (!user.isEmailVerified()) {
        throw new IllegalStateException("Email not verified");
    }
    if (user.hasActiveSubscription()) {
        throw new IllegalStateException("Already active");
    }

    LocalDate start = LocalDate.now();
    LocalDate end = start.plusMonths(1);

    Subscription sub = Subscription.paid(user.getId(), plan, start, end);
    subscriptionRepository.save(sub);
}`;

const HELPER_CODE = `private void validate(User user) {
    if (!user.isEmailVerified()) {
        throw new IllegalStateException("Email not verified");
    }
    if (user.hasActiveSubscription()) {
        throw new IllegalStateException("Already active");
    }
}`;

const CALL_CODE = '    validate(user);';

export default makeScene2D(function* (view) {
    view.fill('#1a1a2e');

    const stage = new Stage({columnGap: 40});

    const codeLeft = CodeGrid.fromCodeAt(CODE_LEFT, stage.left(), {fontSize: FONT_SIZE});
    const codeRight = CodeGrid.fromCodeAt(CODE_RIGHT, stage.offset(stage.right(), -60, 0), {fontSize: FONT_SIZE});

    codeLeft.mount(view);
    codeRight.mount(view);

    yield* all(
        codeLeft.appear(0.6),
        codeRight.appear(0.6),
    );
    yield* waitFor(0.8);

    yield* all(
        codeLeft.highlight(1, 7),
        codeRight.highlight(1, 7),
    );
    yield* waitFor(0.8);

    yield* dryRefactor(
        view,
        [
            {grid: codeLeft, range: [1, 7]},
            {grid: codeRight, range: [1, 7]},
        ],
        HELPER_CODE,
        CALL_CODE,
    );

    yield* waitFor(2.0);
});
