import { INodeFunctionBaseParams } from "@cognigy/extension-tools";

export function createMockApi() {
  const contextStore: Record<string, any> = {};
  const logs: Array<{ level: string; message: string }> = [];

  const api = {
    addToContext: jest.fn((key: string, value: any, _mode: string) => {
      contextStore[key] = value;
    }),
    log: jest.fn((level: string, message: string) => {
      logs.push({ level, message });
    }),
    say: jest.fn(),
    output: jest.fn(),
    setContext: jest.fn(),
    getContext: jest.fn(),
    deleteContext: jest.fn(),
    updateProfile: jest.fn(),
  };

  return { api, contextStore, logs };
}

export function createMockParams(config: Record<string, any>) {
  const { api, contextStore, logs } = createMockApi();

  const params: INodeFunctionBaseParams = {
    cognigy: {
      api: api as any,
      input: {} as any,
      context: {},
      profile: {},
    } as any,
    config: config as any,
    childConfigs: [],
    nodeId: 'test-node-id',
  };

  return { params, api, contextStore, logs };
}

export const TEST_CONNECTION = {
  baseUrl: 'https://agent.api.test.l-b.dev',
  apiKey: 'test-api-key-abc123',
  signatureSalt: 'test-signature-salt-xyz789',
  appBaseUrl: 'https://app.api.test.l-b.dev',
  appSecretKey: 'test-app-secret-key-abc123',
};

export function getNodeFunction(node: any): (params: INodeFunctionBaseParams) => Promise<void> {
  if (!node.function) {
    throw new Error(`Node "${node.type}" has no function defined`);
  }
  return node.function;
}
