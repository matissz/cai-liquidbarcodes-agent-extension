import type { CancellationSelection, ISubscription, IUserResponse } from '../types/agentApi';

export class CancellationSelectionInputError extends Error {}

export function parseAllowedPlanIds(value: unknown): number[] {
  let parsed: unknown;
  try {
    parsed = typeof value === 'string' ? JSON.parse(value) : value;
  } catch {
    throw new CancellationSelectionInputError('Allowed Car-Wash Plan IDs must be a valid JSON array.');
  }

  if (!Array.isArray(parsed) || parsed.length === 0) {
    throw new CancellationSelectionInputError('Allowed Car-Wash Plan IDs must be a non-empty JSON array.');
  }

  if (!parsed.every(id => Number.isSafeInteger(id) && id > 0)) {
    throw new CancellationSelectionInputError('Allowed Car-Wash Plan IDs must contain only positive integers.');
  }

  return [...new Set(parsed)];
}

export function selectCancellationSubscription(
  user: IUserResponse,
  allowedPlanIds: readonly number[],
): CancellationSelection {
  const allowed = new Set(allowedPlanIds);
  const owned = user.subscriptions ?? user.Subscriptions ?? [];
  const shared = user.sharedSubscriptions ?? user.SharedSubscriptions ?? [];
  const eligibleOwners: ISubscription[] = [];
  const cancelledOwners: ISubscription[] = [];
  const sharedMatches: ISubscription[] = [];

  for (const subscription of owned) {
    if (!matchesAllowedPlan(subscription, allowed)) continue;

    const role = subscription.role ?? subscription.Role;
    if (role !== undefined && role !== 'Owner') continue;

    requireValidSubscriptionId(subscription);
    const state = subscription.subscriptionState ?? subscription.SubscriptionState;
    if (state === 'Cancelled') cancelledOwners.push(subscription);
    else eligibleOwners.push(subscription);
  }

  for (const subscription of shared) {
    if (!matchesAllowedPlan(subscription, allowed)) continue;
    requireValidSubscriptionId(subscription);
    sharedMatches.push(subscription);
  }

  if (eligibleOwners.length === 1) {
    return { outcome: 'selected', selected: eligibleOwners[0], candidates: eligibleOwners };
  }
  if (eligibleOwners.length > 1) {
    return { outcome: 'multipleCandidates', candidates: eligibleOwners };
  }
  if (cancelledOwners.length > 0) {
    return { outcome: 'alreadyInactive', candidates: cancelledOwners };
  }
  if (sharedMatches.length > 0) {
    return { outcome: 'notOwner', candidates: sharedMatches };
  }
  return { outcome: 'noMatch', candidates: [] };
}

function matchesAllowedPlan(subscription: ISubscription, allowed: ReadonlySet<number>): boolean {
  const planId = subscription.planId ?? subscription.PlanId;
  return Number.isSafeInteger(planId) && allowed.has(planId!);
}

function requireValidSubscriptionId(subscription: ISubscription): void {
  const subscriptionId = subscription.subscriptionId ?? subscription.SubscriptionId;
  if (!Number.isSafeInteger(subscriptionId) || subscriptionId! <= 0) {
    throw new CancellationSelectionInputError('A matching subscription has an invalid subscription ID.');
  }
}
