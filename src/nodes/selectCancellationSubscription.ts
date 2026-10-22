import { createNodeDescriptor, INodeFunctionBaseParams } from '@cognigy/extension-tools';
import { clearApiError, storeApiError } from '../utils/errorHandling';
import { routeToResultChild, ResultRoute } from '../utils/routeToResultChild';
import {
  CancellationSelectionInputError,
  parseAllowedPlanIds,
  selectCancellationSubscription,
} from '../utils/selectCancellationSubscription';
import { RESULT_CHILD_CONSTRAINTS, RESULT_CHILD_DEPENDENCIES } from './resultBranches';
import type { IUserResponse } from '../types/agentApi';

export const selectCancellationSubscriptionNode = createNodeDescriptor({
  type: 'selectCancellationSubscription',
  defaultLabel: 'Select Cancellation Subscription',
  summary: 'Classify cancellable subscriptions from a fresh Get User profile',
  constraints: RESULT_CHILD_CONSTRAINTS,
  dependencies: RESULT_CHILD_DEPENDENCIES,

  fields: [
    {
      key: 'userProfile',
      label: 'User Profile',
      type: 'cognigyText',
      defaultValue: '{{context.liquidBarcodesAgent.user}}',
      params: { required: true },
      description: 'The complete profile returned by Get User Profile, as a resolved object or JSON text.',
    },
    {
      key: 'allowedPlanIds',
      label: 'Allowed Car-Wash Plan IDs',
      type: 'cognigyText',
      params: { required: true },
      description: 'A JSON array of allowed car-wash plan IDs, for example [42, 108].',
    },
    {
      key: 'contextKey',
      label: 'Store Result In',
      type: 'cognigyText',
      defaultValue: 'liquidBarcodesAgent.cancellationSelection',
      params: { required: true },
    },
  ],

  sections: [
    {
      key: 'selection',
      label: 'Cancellation Selection',
      defaultCollapsed: false,
      fields: ['userProfile', 'allowedPlanIds'],
    },
    {
      key: 'output',
      label: 'Output Settings',
      defaultCollapsed: true,
      fields: ['contextKey'],
    },
  ],

  form: [
    { type: 'section', key: 'selection' },
    { type: 'section', key: 'output' },
  ],

  function: async ({ cognigy, config, childConfigs }: INodeFunctionBaseParams) => {
    const { api } = cognigy;
    const { userProfile, allowedPlanIds, contextKey } = config as any;
    let route: ResultRoute = 'error';

    try {
      const profile = parseUserProfile(userProfile);
      const selection = selectCancellationSubscription(profile, parseAllowedPlanIds(allowedPlanIds));
      api.addToContext?.(contextKey, selection, 'simple');
      clearApiError(api);
      route = 'success';
    } catch (error: any) {
      const apiError = error instanceof CancellationSelectionInputError
        ? { message: error.message, code: 'InvalidInput', errorCode: 1001, status: 400 }
        : { message: 'User Profile must be a valid object or JSON object.', code: 'InvalidInput', errorCode: 1001, status: 400 };
      storeApiError(api, contextKey, 'selectCancellationSubscription', 'protectedRead', apiError);
    }

    routeToResultChild(childConfigs, api, route);
  },
});

function parseUserProfile(value: unknown): IUserResponse {
  let parsed: unknown = value;

  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new CancellationSelectionInputError('User Profile must be a valid JSON object.');
    }
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new CancellationSelectionInputError('User Profile must be an object returned by Get User Profile.');
  }

  return parsed as IUserResponse;
}
