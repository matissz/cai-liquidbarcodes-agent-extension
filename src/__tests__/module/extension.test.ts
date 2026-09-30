import { requestSsoTokenNode } from '../../nodes/requestSsoToken';
import { authSsoNode } from '../../nodes/authSso';
import { authOtpStartNode } from '../../nodes/authOtpStart';
import { authOtpVerifyNode } from '../../nodes/authOtpVerify';
import { getUserNode } from '../../nodes/getUser';
import { getStoresNode } from '../../nodes/getStores';
import { getStoresMachinesStatusNode } from '../../nodes/getStoresMachinesStatus';
import { getReceiptsNode } from '../../nodes/getReceipts';
import { cancelSubscriptionNode } from '../../nodes/cancelSubscription';
import { getSubscriptionUsersNode } from '../../nodes/getSubscriptionUsers';
import { addSubscriptionUserNode } from '../../nodes/addSubscriptionUser';
import { removeSubscriptionUserNode } from '../../nodes/removeSubscriptionUser';
import { setPlateNumberNode } from '../../nodes/setPlateNumber';
import { issueCouponNode } from '../../nodes/issueCoupon';
import { agentApiConnection } from '../../connections/agentApiConnection';

const ALL_NODES = [
  requestSsoTokenNode,
  authSsoNode,
  authOtpStartNode,
  authOtpVerifyNode,
  getUserNode,
  getStoresNode,
  getStoresMachinesStatusNode,
  getReceiptsNode,
  cancelSubscriptionNode,
  getSubscriptionUsersNode,
  addSubscriptionUserNode,
  removeSubscriptionUserNode,
  setPlateNumberNode,
  issueCouponNode,
];

describe('Extension structure', () => {
  test('all 14 nodes are defined', () => {
    expect(ALL_NODES).toHaveLength(14);
  });

  test('all nodes have unique types', () => {
    const types = ALL_NODES.map(n => n.type);
    expect(new Set(types).size).toBe(14);
  });

  test('all nodes have a defaultLabel', () => {
    for (const node of ALL_NODES) {
      expect(node.defaultLabel).toBeTruthy();
    }
  });

  test('all nodes have a function', () => {
    for (const node of ALL_NODES) {
      expect(typeof node.function).toBe('function');
    }
  });

  test('all nodes have fields', () => {
    for (const node of ALL_NODES) {
      expect(node.fields!.length).toBeGreaterThan(0);
    }
  });

  test('all nodes have sections', () => {
    for (const node of ALL_NODES) {
      expect(node.sections!.length).toBeGreaterThan(0);
    }
  });

  test('all nodes reference the correct connection type', () => {
    for (const node of ALL_NODES) {
      const connField = node.fields!.find((f: any) => f.type === 'connection');
      expect(connField).toBeDefined();
      expect((connField as any).params.connectionType).toBe('liquid-barcodes-agent-api');
    }
  });

  test('all section field refs match actual field keys', () => {
    for (const node of ALL_NODES) {
      const fieldKeys = new Set(node.fields!.map((f: any) => f.key));
      for (const section of node.sections!) {
        for (const fieldRef of (section as any).fields) {
          expect(fieldKeys.has(fieldRef)).toBe(true);
        }
      }
    }
  });

  test('connection schema has 5 fields', () => {
    expect(agentApiConnection.fields).toHaveLength(5);
    const names = agentApiConnection.fields.map(f => f.fieldName);
    expect(names).toContain('baseUrl');
    expect(names).toContain('apiKey');
    expect(names).toContain('signatureSalt');
    expect(names).toContain('appBaseUrl');
    expect(names).toContain('appSecretKey');
  });

  test('connection type is liquid-barcodes-agent-api', () => {
    expect(agentApiConnection.type).toBe('liquid-barcodes-agent-api');
  });
});
