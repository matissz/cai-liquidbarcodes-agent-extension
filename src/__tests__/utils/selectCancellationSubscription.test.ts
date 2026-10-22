import {
  CancellationSelectionInputError,
  parseAllowedPlanIds,
  selectCancellationSubscription,
} from '../../utils/selectCancellationSubscription';

describe('parseAllowedPlanIds', () => {
  test('parses and deduplicates a valid JSON array', () => {
    expect(parseAllowedPlanIds('[42, 108, 42]')).toEqual([42, 108]);
  });

  test.each([
    ['', 'valid JSON array'],
    ['{}', 'non-empty JSON array'],
    ['[]', 'non-empty JSON array'],
    ['[0]', 'positive integers'],
    ['[1.5]', 'positive integers'],
    ['["42"]', 'positive integers'],
  ])('rejects invalid configuration %#', (value, message) => {
    expect(() => parseAllowedPlanIds(value)).toThrow(message);
  });
});

describe('selectCancellationSubscription', () => {
  test('selects one eligible owner and preserves the original record', () => {
    const subscription = { planId: 42, subscriptionId: 108544, role: 'Owner' as const, subscriptionState: 'Active', extra: 'unchanged' };
    const result = selectCancellationSubscription({ subscriptions: [subscription] }, [42]);

    expect(result).toEqual({ outcome: 'selected', selected: subscription, candidates: [subscription] });
    expect(result.selected).toBe(subscription);
  });

  test('supports PascalCase fields', () => {
    const subscription = { PlanId: 42, SubscriptionId: 108544, Role: 'Owner' as const, SubscriptionState: 'Active' };
    expect(selectCancellationSubscription({ Subscriptions: [subscription] }, [42])).toEqual({
      outcome: 'selected', selected: subscription, candidates: [subscription],
    });
  });

  test.each([
    [{ planId: 42, subscriptionId: 1 }, 'missing role and state'],
    [{ planId: 42, subscriptionId: 1, role: 'Owner', subscriptionState: 'Downgrading' }, 'another non-cancelled state'],
  ])('selects an owned subscription with %s', (subscription, _description) => {
    expect(selectCancellationSubscription({ subscriptions: [subscription as any] }, [42]).outcome).toBe('selected');
  });

  test('returns multiple candidates without selecting the first', () => {
    const subscriptions = [
      { planId: 42, subscriptionId: 1, role: 'Owner' as const, subscriptionState: 'Active' },
      { planId: 42, subscriptionId: 2, role: 'Owner' as const, subscriptionState: 'Active' },
    ];
    expect(selectCancellationSubscription({ subscriptions }, [42])).toEqual({
      outcome: 'multipleCandidates', candidates: subscriptions,
    });
  });

  test('returns alreadyInactive before notOwner', () => {
    const cancelled = { planId: 42, subscriptionId: 1, role: 'Owner' as const, subscriptionState: 'Cancelled' };
    const child = { planId: 42, subscriptionId: 2, role: 'Child' as const, subscriptionState: 'Active' };
    expect(selectCancellationSubscription({ subscriptions: [cancelled], sharedSubscriptions: [child] }, [42])).toEqual({
      outcome: 'alreadyInactive', candidates: [cancelled],
    });
  });

  test('returns notOwner for shared-only matches', () => {
    const child = { planId: 42, subscriptionId: 2, role: 'Child' as const, subscriptionState: 'Active' };
    expect(selectCancellationSubscription({ sharedSubscriptions: [child] }, [42])).toEqual({
      outcome: 'notOwner', candidates: [child],
    });
  });

  test('does not select an explicit Child from owned subscriptions', () => {
    const child = { planId: 42, subscriptionId: 2, role: 'Child' as const, subscriptionState: 'Active' };
    expect(selectCancellationSubscription({ subscriptions: [child] }, [42])).toEqual({ outcome: 'noMatch', candidates: [] });
  });

  test('returns noMatch when no plan matches', () => {
    expect(selectCancellationSubscription({ subscriptions: [{ planId: 99, subscriptionId: 1 }] }, [42])).toEqual({
      outcome: 'noMatch', candidates: [],
    });
  });

  test.each([
    [{ planId: 42, role: 'Owner' }],
    [{ planId: 42, subscriptionId: 0, role: 'Owner' }],
    [{ planId: 42, subscriptionId: 1.5, role: 'Owner' }],
  ])('rejects a matching record with an invalid subscription ID', subscription => {
    expect(() => selectCancellationSubscription({ subscriptions: [subscription as any] }, [42]))
      .toThrow(CancellationSelectionInputError);
  });
});
