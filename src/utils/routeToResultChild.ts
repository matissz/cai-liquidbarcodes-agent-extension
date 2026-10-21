import { RESULT_CHILD_TYPES } from '../nodes/resultBranches';

export type ResultRoute = keyof typeof RESULT_CHILD_TYPES;

type ResultChildConfig = {
  id: string;
  type: string;
};

type ResultRoutingApi = {
  log?: (level: 'error' | 'info' | 'fatal' | 'warn' | 'debug' | 'trace', message: string) => void;
  setNextNode: (nodeId: string, flowId?: string) => void;
};

export function routeToResultChild(
  childConfigs: ResultChildConfig[],
  api: ResultRoutingApi,
  route: ResultRoute,
): void {
  const childType = RESULT_CHILD_TYPES[route];
  const child = childConfigs.find(candidate => candidate.type === childType);

  if (!child) {
    api.log?.('warn', `Liquid Barcodes ${route} branch is not configured; continuing with the existing flow successor.`);
    return;
  }

  api.setNextNode(child.id);
}