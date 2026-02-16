import { describe, it, expect } from 'vitest';

import {
  CONTAINER_STATE_PATH,
  isInsideContainer,
  resolveContainerStatePath,
} from './container-env.js';

describe('isInsideContainer', () => {
  it('returns true when AGENT_ENV_CONTAINER is "true"', () => {
    const deps = { getEnv: (key: string) => (key === 'AGENT_ENV_CONTAINER' ? 'true' : undefined) };
    expect(isInsideContainer(deps)).toBe(true);
  });

  it('returns false when AGENT_ENV_CONTAINER is not set', () => {
    const deps = { getEnv: () => undefined };
    expect(isInsideContainer(deps)).toBe(false);
  });

  it('returns false when AGENT_ENV_CONTAINER is empty string', () => {
    const deps = { getEnv: (key: string) => (key === 'AGENT_ENV_CONTAINER' ? '' : undefined) };
    expect(isInsideContainer(deps)).toBe(false);
  });

  it('returns false when AGENT_ENV_CONTAINER is "false"', () => {
    const deps = { getEnv: (key: string) => (key === 'AGENT_ENV_CONTAINER' ? 'false' : undefined) };
    expect(isInsideContainer(deps)).toBe(false);
  });

  it('returns false when AGENT_ENV_CONTAINER is "1" (only "true" accepted)', () => {
    const deps = { getEnv: (key: string) => (key === 'AGENT_ENV_CONTAINER' ? '1' : undefined) };
    expect(isInsideContainer(deps)).toBe(false);
  });
});

describe('resolveContainerStatePath', () => {
  it('returns /etc/agent-env/state.json when inside container', () => {
    const deps = { getEnv: (key: string) => (key === 'AGENT_ENV_CONTAINER' ? 'true' : undefined) };
    expect(resolveContainerStatePath(deps)).toBe(CONTAINER_STATE_PATH);
  });

  it('returns undefined when on host', () => {
    const deps = { getEnv: () => undefined };
    expect(resolveContainerStatePath(deps)).toBeUndefined();
  });

  it('returns /etc/agent-env/state.json path', () => {
    expect(CONTAINER_STATE_PATH).toBe('/etc/agent-env/state.json');
  });
});
