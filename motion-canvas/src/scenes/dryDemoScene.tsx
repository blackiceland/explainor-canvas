import {makeScene2D} from '@motion-canvas/2d';
import {runDryScene, DryPattern} from '../core/code';

const pattern: DryPattern = {
    pattern: 'dry',
    left: {
        code: `void startTrial(User user) {
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
}`,
        range: [1, 7],
    },
    right: {
        code: `void startPaid(User user, Plan plan) {
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
}`,
        range: [1, 7],
    },
    helper: `private void validate(User user) {
    if (!user.isEmailVerified()) {
        throw new IllegalStateException("Email not verified");
    }
    if (user.hasActiveSubscription()) {
        throw new IllegalStateException("Already active");
    }
}`,
    call: '    validate(user);',
};

export default makeScene2D(function* (view) {
    view.fill('#1a1a2e');
    yield* runDryScene(view, pattern);
});
