import { createNodeDescriptor } from '@cognigy/extension-tools';

export const LIQUID_BARCODES_PARENT_TYPES = [
  'requestSsoToken',
  'authSso',
  'authOtpStart',
  'authOtpVerify',
  'getUser',
  'getStores',
  'getStoresMachinesStatus',
  'getReceipts',
  'cancelSubscription',
  'getSubscriptionUsers',
  'addSubscriptionUser',
  'removeSubscriptionUser',
  'setPlateNumber',
  'issueCoupon',
] as const;

export const RESULT_CHILD_TYPES = {
  success: 'liquidBarcodesOnSuccess',
  error: 'liquidBarcodesOnError',
} as const;

export const RESULT_CHILD_DEPENDENCIES = {
  children: [RESULT_CHILD_TYPES.success, RESULT_CHILD_TYPES.error],
};

export const RESULT_CHILD_CONSTRAINTS = {
  placement: {
    children: {
      whitelist: [RESULT_CHILD_TYPES.success, RESULT_CHILD_TYPES.error],
    },
  },
};

export const liquidBarcodesOnSuccessNode = createNodeDescriptor({
  type: RESULT_CHILD_TYPES.success,
  parentType: [...LIQUID_BARCODES_PARENT_TYPES],
  defaultLabel: 'On Success',
  summary: 'Continue after a successful Liquid Barcodes API operation',
  appearance: { color: '#55f855', variant: 'mini' },
});

export const liquidBarcodesOnErrorNode = createNodeDescriptor({
  type: RESULT_CHILD_TYPES.error,
  parentType: [...LIQUID_BARCODES_PARENT_TYPES],
  defaultLabel: 'On Error',
  summary: 'Continue after a failed Liquid Barcodes API operation',
  appearance: { color: '#f7504d', variant: 'mini' },
});