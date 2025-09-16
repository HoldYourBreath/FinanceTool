// tests/_helpers/api.ts
import type { APIRequestContext } from '@playwright/test';

export const API =
  process.env.API_URL?.replace(/\/$/, '') || 'http://127.0.0.1:5000';

export const isFiniteNumber = (v: any) => typeof v === 'number' && Number.isFinite(v);
export const isString = (v: any) => typeof v === 'string';
export const isStringOrNull = (v: any) => v == null || typeof v === 'string';
export const isNumberOrNull = (v: any) => v == null || typeof v === 'number';

export async function getJSON(request: APIRequestContext, path: string) {
  const res = await request.get(`${API}${path}`);
  const body = await res.text();
  if (!res.ok()) {
    throw new Error(`${path} should respond 2xx, got ${res.status()} ${body.slice(0, 200)}`);
  }
  const json = body ? JSON.parse(body) : null;
  return { res, json };
}
