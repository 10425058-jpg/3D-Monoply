// Small hand-written request validators. Every function throws a 400 VALIDATION_ERROR.
import { validationError } from './errors';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Body = Record<string, unknown>;

/** The body must be a JSON object and may only contain the listed keys. */
export function body(value: unknown, allowedKeys: string[]): Body {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw validationError('Request body must be a JSON object.');
  }
  const unknown = Object.keys(value).filter((k) => !allowedKeys.includes(k));
  if (unknown.length > 0) throw validationError(`Unknown field: ${unknown[0]}.`, { fields: unknown });
  return value as Body;
}

export function str(value: unknown, field: string, opts: { min?: number; max?: number; pattern?: RegExp } = {}): string {
  if (typeof value !== 'string') throw validationError(`${field} must be a string.`, { field });
  const { min = 1, max = 255, pattern } = opts;
  if (value.length < min || value.length > max) {
    throw validationError(`${field} must be ${min}-${max} characters long.`, { field });
  }
  if (pattern && !pattern.test(value)) throw validationError(`${field} has an invalid format.`, { field });
  return value;
}

export function optionalStr(value: unknown, field: string, opts: { min?: number; max?: number; pattern?: RegExp } = {}): string | undefined {
  return value === undefined ? undefined : str(value, field, opts);
}

export function uuid(value: unknown, field: string): string {
  if (typeof value !== 'string' || !UUID.test(value)) throw validationError(`${field} must be a UUID.`, { field });
  return value.toLowerCase();
}

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value);
}

export function int(value: unknown, field: string, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max) {
    throw validationError(`${field} must be a whole number from ${min} to ${max}.`, { field });
  }
  return value;
}

export function bool(value: unknown, field: string): boolean {
  if (typeof value !== 'boolean') throw validationError(`${field} must be true or false.`, { field });
  return value;
}

export function literal<T extends string>(value: unknown, field: string, expected: T): T {
  if (value !== expected) throw validationError(`${field} must be "${expected}".`, { field });
  return expected;
}
