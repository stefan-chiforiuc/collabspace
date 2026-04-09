import { describe, it, expect } from 'vitest';
import { generateRoomCode, isValidRoomCode } from './room-code';

describe('generateRoomCode', () => {
  it('produces adjective-noun-NNNN format', () => {
    const code = generateRoomCode();
    expect(code).toMatch(/^[a-z]+-[a-z]+-\d{4}$/);
  });

  it('generates different codes', () => {
    const codes = new Set(Array.from({ length: 50 }, () => generateRoomCode()));
    expect(codes.size).toBeGreaterThan(40);
  });
});

describe('isValidRoomCode', () => {
  it('accepts valid codes', () => {
    expect(isValidRoomCode('calm-river-7291')).toBe(true);
    expect(isValidRoomCode('swift-falcon-0001')).toBe(true);
  });

  it('rejects invalid codes', () => {
    expect(isValidRoomCode('')).toBe(false);
    expect(isValidRoomCode('abc')).toBe(false);
    expect(isValidRoomCode('Calm-River-7291')).toBe(false);
    expect(isValidRoomCode('calm-river-72')).toBe(false);
    expect(isValidRoomCode('calm-river-72910')).toBe(false);
  });
});
