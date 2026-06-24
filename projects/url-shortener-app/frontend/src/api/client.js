import { createMockService } from '../mock/mockData.js';

const API_BASE_URL = 'http://localhost:4000';
const mockService = createMockService();

let runtimeMode = 'unknown';

async function fetchJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    let message = 'Unexpected API error.';

    try {
      const payload = await response.json();
      message = payload.error || message;
    } catch {
      message = response.statusText || message;
    }

    throw new Error(message);
  }

  return response.json();
}

async function useBackendOrMock(backendAction, mockAction) {
  if (runtimeMode === 'mock') {
    return mockAction();
  }

  try {
    const result = await backendAction();
    runtimeMode = 'backend';
    return result;
  } catch (error) {
    if (runtimeMode === 'backend') {
      throw error;
    }

    runtimeMode = 'mock';
    return mockAction();
  }
}

export async function initializeClient() {
  try {
    await fetchJson('/api/health');
    runtimeMode = 'backend';
  } catch {
    runtimeMode = 'mock';
  }

  return runtimeMode;
}

export function getRuntimeMode() {
  return runtimeMode === 'unknown' ? 'mock' : runtimeMode;
}

export async function listLinks() {
  return useBackendOrMock(
    () => fetchJson('/api/links'),
    () => Promise.resolve(mockService.listLinks())
  );
}

export async function createLink(payload) {
  return useBackendOrMock(
    () =>
      fetchJson('/api/links', {
        method: 'POST',
        body: JSON.stringify(payload)
      }),
    () => Promise.resolve(mockService.createLink(payload))
  );
}

export async function getAnalytics(shortCode) {
  return useBackendOrMock(
    () => fetchJson(`/api/links/${shortCode}/analytics`),
    () => Promise.resolve(mockService.getAnalytics(shortCode))
  );
}

export async function visitLink(shortCode) {
  return useBackendOrMock(
    () =>
      fetchJson(`/api/links/${shortCode}/visit`, {
        method: 'POST'
      }),
    () => Promise.resolve(mockService.visitLink(shortCode))
  );
}
