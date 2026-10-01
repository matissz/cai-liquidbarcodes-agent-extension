import { authOtpStartNode } from '../../nodes/authOtpStart';
import { authOtpVerifyNode } from '../../nodes/authOtpVerify';
import { getUserNode } from '../../nodes/getUser';
import { cancelSubscriptionNode } from '../../nodes/cancelSubscription';
import {
  LIQUID_BARCODES_PARENT_TYPES,
  RESULT_CHILD_TYPES,
  liquidBarcodesOnErrorNode,
  liquidBarcodesOnSuccessNode,
} from '../../nodes/resultBranches';
import { agentApiConnection } from '../../connections/agentApiConnection';
import extension from '../../module';

const PARENT_NODES = [
  authOtpStartNode,
  authOtpVerifyNode,
  getUserNode,
  cancelSubscriptionNode,
];
const CHILD_NODES = [liquidBarcodesOnSuccessNode, liquidBarcodesOnErrorNode];
const ALL_NODES = [...PARENT_NODES, ...CHILD_NODES];

describe('Extension structure', () => {
  test('four enabled API parents and two result children are defined', () => {
    expect(PARENT_NODES).toHaveLength(4);
    expect(CHILD_NODES).toHaveLength(2);
    expect(ALL_NODES).toHaveLength(6);
  });

  test('extension registers both result children with all API parents', () => {
    expect(extension.nodes.map(node => node.type)).toEqual(ALL_NODES.map(node => node.type));
  });

  test('all nodes have unique types', () => {
    const types = ALL_NODES.map(n => n.type);
    expect(new Set(types).size).toBe(6);
  });

  test('all nodes have a defaultLabel', () => {
    for (const node of PARENT_NODES) {
      expect(node.defaultLabel).toBeTruthy();
    }
  });

  test('all nodes have a function', () => {
    for (const node of PARENT_NODES) {
      expect(typeof node.function).toBe('function');
    }
  });

  test('all nodes have fields', () => {
    for (const node of PARENT_NODES) {
      expect(node.fields!.length).toBeGreaterThan(0);
    }
  });

  test('all nodes have sections', () => {
    for (const node of PARENT_NODES) {
      expect(node.sections!.length).toBeGreaterThan(0);
    }
  });

  test('all nodes reference the correct connection type', () => {
    for (const node of PARENT_NODES) {
      const connField = node.fields!.find((f: any) => f.type === 'connection');
      expect(connField).toBeDefined();
      expect((connField as any).params.connectionType).toBe('liquid-barcodes-agent-api');
    }
  });

  test('all API parents create and allow only the shared result children', () => {
    const expectedTypes = [RESULT_CHILD_TYPES.success, RESULT_CHILD_TYPES.error];

    for (const node of PARENT_NODES) {
      expect(node.dependencies?.children).toEqual(expectedTypes);
      expect(node.constraints?.placement.children?.whitelist).toEqual(expectedTypes);
    }
  });

  test('result children are fieldless mini nodes accepted by every API parent', () => {
    for (const node of CHILD_NODES) {
      expect(node.appearance.variant).toBe('mini');
      expect(node.parentType).toEqual([...LIQUID_BARCODES_PARENT_TYPES]);
      expect(node.fields).toEqual([]);
      expect(node.function).toBeNull();
    }
    expect(liquidBarcodesOnSuccessNode.defaultLabel).toBe('On Success');
    expect(liquidBarcodesOnSuccessNode.appearance.color).toBe('#55f855');
    expect(liquidBarcodesOnErrorNode.defaultLabel).toBe('On Error');
    expect(liquidBarcodesOnErrorNode.appearance.color).toBe('#f7504d');
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
