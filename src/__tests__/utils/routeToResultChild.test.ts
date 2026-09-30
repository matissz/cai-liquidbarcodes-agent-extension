import { RESULT_CHILD_TYPES } from '../../nodes/resultBranches';
import { routeToResultChild } from '../../utils/routeToResultChild';

describe('routeToResultChild', () => {
  const children = [
    { id: 'success-1', type: RESULT_CHILD_TYPES.success, config: {} },
    { id: 'error-1', type: RESULT_CHILD_TYPES.error, config: {} },
  ];

  test.each([
    ['success', 'success-1'],
    ['error', 'error-1'],
  ] as const)('routes %s to the matching child ID', (route, childId) => {
    const api = { setNextNode: jest.fn(), log: jest.fn() };

    routeToResultChild(children, api, route);

    expect(api.setNextNode).toHaveBeenCalledWith(childId);
  });

  test('warns and preserves linear execution when the expected child is absent', () => {
    const api = { setNextNode: jest.fn(), log: jest.fn() };

    routeToResultChild([], api, 'error');

    expect(api.setNextNode).not.toHaveBeenCalled();
    expect(api.log).toHaveBeenCalledWith('warn', expect.stringContaining('error branch is not configured'));
  });

  test('ignores unrelated children', () => {
    const api = { setNextNode: jest.fn(), log: jest.fn() };

    routeToResultChild([{ id: 'other', type: 'otherChild' }], api, 'success');

    expect(api.setNextNode).not.toHaveBeenCalled();
  });

  test('uses the first matching child when duplicates are present', () => {
    const api = { setNextNode: jest.fn(), log: jest.fn() };
    const duplicates = [
      { id: 'first', type: RESULT_CHILD_TYPES.success },
      { id: 'second', type: RESULT_CHILD_TYPES.success },
    ];

    routeToResultChild(duplicates, api, 'success');

    expect(api.setNextNode).toHaveBeenCalledWith('first');
  });
});