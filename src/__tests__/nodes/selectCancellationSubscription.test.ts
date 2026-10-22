import axios from 'axios';
import MockAdapter from 'axios-mock-adapter';
import { selectCancellationSubscriptionNode } from '../../nodes/selectCancellationSubscription';
import { createMockParams, getNodeFunction } from '../helpers';

const execute = getNodeFunction(selectCancellationSubscriptionNode);
let mock: MockAdapter;

beforeEach(() => {
  mock = new MockAdapter(axios);
});

afterEach(() => {
  mock.restore();
});

describe('Select Cancellation Subscription node', () => {
  test.each([
    ['selected', [{ planId: 42, subscriptionId: 1, role: 'Owner', subscriptionState: 'Active' }], []],
    ['multipleCandidates', [
      { planId: 42, subscriptionId: 1, role: 'Owner', subscriptionState: 'Active' },
      { planId: 42, subscriptionId: 2, role: 'Owner', subscriptionState: 'Active' },
    ], []],
    ['alreadyInactive', [{ planId: 42, subscriptionId: 1, role: 'Owner', subscriptionState: 'Cancelled' }], []],
    ['notOwner', [], [{ planId: 42, subscriptionId: 2, role: 'Child', subscriptionState: 'Active' }]],
    ['noMatch', [{ planId: 99, subscriptionId: 1, role: 'Owner', subscriptionState: 'Active' }], []],
  ])('stores the %s outcome from the supplied profile', async (outcome, subscriptions, sharedSubscriptions) => {
    const profile = { subscriptions, sharedSubscriptions };
    const { params, contextStore } = createMockParams({
      userProfile: profile,
      allowedPlanIds: '[42]',
      contextKey: 'lb.selection',
    });

    await execute(params);

    expect(contextStore['lb.selection'].outcome).toBe(outcome);
    expect(mock.history.get).toHaveLength(0);
    expect(mock.history.post).toHaveLength(0);
  });

  test('accepts a JSON profile and preserves selected provider records', async () => {
    const subscription = { PlanId: 42, SubscriptionId: 1, Role: 'Owner', SubscriptionState: 'Active', PlanName: 'Wash' };
    const { params, contextStore } = createMockParams({
      userProfile: JSON.stringify({ Subscriptions: [subscription] }),
      allowedPlanIds: '[42]',
      contextKey: 'lb.selection',
    });

    await execute(params);

    expect(contextStore['lb.selection']).toEqual({
      outcome: 'selected',
      selected: subscription,
      candidates: [subscription],
    });
  });

  test.each([
    [undefined, '[42]'],
    ['', '[42]'],
    ['not-json', '[42]'],
    [{ subscriptions: [] }, ''],
    [{ subscriptions: [] }, '[]'],
    [{ subscriptions: [] }, '["42"]'],
  ])('routes invalid profile or plan configuration to On Error', async (userProfile, allowedPlanIds) => {
    const children = [{ id: 'error-child', type: 'liquidBarcodesOnError', config: {} }];
    const { params, contextStore, api } = createMockParams({
      userProfile,
      allowedPlanIds,
      contextKey: 'lb.selection',
    }, children);

    await execute(params);

    expect(contextStore['liquidBarcodesAgent.errorHandling.current']).toMatchObject({
      operation: 'selectCancellationSubscription',
      outcome: 'invalidInput',
      directive: 'doNotRetry',
    });
    expect(api.setNextNode).toHaveBeenCalledWith('error-child');
  });

  test('routes a valid classification through On Success', async () => {
    const children = [{ id: 'success-child', type: 'liquidBarcodesOnSuccess', config: {} }];
    const { params, api } = createMockParams({
      userProfile: { subscriptions: [] },
      allowedPlanIds: '[42]',
      contextKey: 'lb.selection',
    }, children);

    await execute(params);

    expect(api.setNextNode).toHaveBeenCalledWith('success-child');
  });
});
