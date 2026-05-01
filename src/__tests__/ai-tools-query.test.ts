import { describe, it, expect } from 'vitest';
import { z } from 'zod';

// Preprocess input to normalize arrays before validation
const preprocessArrays = (schema: z.ZodTypeAny) => {
  return z.preprocess((arg) => {
    if (arg === undefined || arg === null) return arg;
    if (typeof arg === 'object' && !Array.isArray(arg)) {
      // Handle object inputs - normalize arrays in properties
      const obj = { ...arg as Record<string, unknown> };
      for (const key of Object.keys(obj)) {
        if (Array.isArray(obj[key])) {
          obj[key] = (obj[key] as unknown[])[0];
        }
      }
      return obj;
    }
    return arg;
  }, schema);
};

// Fixed schema using preprocess to handle arrays before validation
const toolEnum = ['getRevenue', 'getShiftsSummary', 'getEmployees', 'getEmployeeHours', 'selectClub', 'parseCallback'] as const;
const periodEnum = ['today', 'yesterday', 'last7days', 'last30days', 'this_month'] as const;

const QuerySchema = z.object({
  tool: z.enum(toolEnum),
  clubId: z.union([z.coerce.number(), z.number()]).optional(),
  employeeId: z.string().optional(),
  period: z.enum(periodEnum).optional(),
  data: z.string().optional(),
}).transform((arg) => {
  // After validation, normalize any remaining arrays (should be none after preprocess)
  return {
    tool: arg.tool,
    clubId: arg.clubId,
    employeeId: arg.employeeId,
    period: arg.period,
    data: arg.data,
  };
});

const PreprocessedSchema = preprocessArrays(QuerySchema);

describe('AI Tools Query Schema', () => {
  describe('tool field', () => {
    it('accepts single string value', () => {
      const result = PreprocessedSchema.safeParse({ tool: 'getRevenue' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.tool).toBe('getRevenue');
    });

    it('rejects invalid tool value', () => {
      const result = PreprocessedSchema.safeParse({ tool: 'invalidTool' });
      expect(result.success).toBe(false);
    });
  });

  describe('period field', () => {
    it('accepts single string value', () => {
      const result = PreprocessedSchema.safeParse({ tool: 'getRevenue', period: 'today' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.period).toBe('today');
    });

    it('returns undefined for missing period', () => {
      const result = PreprocessedSchema.safeParse({ tool: 'getRevenue' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.period).toBeUndefined();
    });
  });

  describe('clubId field', () => {
    it('accepts number value', () => {
      const result = PreprocessedSchema.safeParse({ tool: 'getRevenue', clubId: 1 });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.clubId).toBe(1);
    });

    it('accepts string value', () => {
      const result = PreprocessedSchema.safeParse({ tool: 'getRevenue', clubId: '2' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.clubId).toBe(2);
    });
  });

  describe('employeeId field', () => {
    it('accepts string value', () => {
      const result = PreprocessedSchema.safeParse({ tool: 'getEmployeeHours', employeeId: 'abc-123' });
      expect(result.success).toBe(true);
      if (result.success) expect(result.data.employeeId).toBe('abc-123');
    });
  });

  describe('full request objects', () => {
    it('handles typical n8n request with single values', () => {
      const result = PreprocessedSchema.safeParse({
        tool: 'getRevenue',
        clubId: 1,
        period: 'last7days'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tool).toBe('getRevenue');
        expect(result.data.clubId).toBe(1);
        expect(result.data.period).toBe('last7days');
      }
    });

    it('handles selectClub', () => {
      const result = PreprocessedSchema.safeParse({
        tool: 'selectClub',
        clubId: '5'
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tool).toBe('selectClub');
        expect(result.data.clubId).toBe(5);
      }
    });

    it('handles getEmployees with club selection', () => {
      const result = PreprocessedSchema.safeParse({
        tool: 'getEmployees',
        clubId: 2
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.tool).toBe('getEmployees');
        expect(result.data.clubId).toBe(2);
      }
    });
  });
});

// Test that arrays are properly normalized - this is the key fix!
describe('Array handling (the main bug fix)', () => {
  it('handles tool as array - extracts first element', () => {
    // Simulate what the preprocess does
    const input = { tool: ['getRevenue'] };
    const normalized = { ...input, tool: Array.isArray(input.tool) ? input.tool[0] : input.tool };
    expect(normalized.tool).toBe('getRevenue');
    
    // Then it should validate
    const result = PreprocessedSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it('handles period as array - extracts first element', () => {
    const input = { tool: 'getRevenue', period: ['last7days'] };
    const result = PreprocessedSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.period).toBe('last7days');
  });

  it('handles clubId as array - extracts and coerces', () => {
    const input = { tool: 'getRevenue', clubId: ['3'] };
    const result = PreprocessedSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.clubId).toBe(3);
  });

  it('handles full n8n payload with all arrays', () => {
    const input = {
      tool: ['getRevenue'],
      clubId: [1],
      period: ['last7days']
    };
    const result = PreprocessedSchema.safeParse(input);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.tool).toBe('getRevenue');
      expect(result.data.clubId).toBe(1);
      expect(result.data.period).toBe('last7days');
    }
  });
});
