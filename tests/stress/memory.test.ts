import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SankhyaError } from '../../src/core/errors.js';
import { createPaginator } from '../../src/core/pagination.js';
import type { PaginatedResult } from '../../src/types/common.js';

describe('Memory stress tests', () => {
  it('large paginated dataset: 10,000 items across 100 pages stays bounded', async () => {
    const TOTAL_ITEMS = 10_000;
    const ITEMS_PER_PAGE = 100;
    const TOTAL_PAGES = TOTAL_ITEMS / ITEMS_PER_PAGE;

    const fetchPage = async (page: number): Promise<PaginatedResult<{ id: number }>> => {
      const items = Array.from({ length: ITEMS_PER_PAGE }, (_, i) => ({
        id: page * ITEMS_PER_PAGE + i,
      }));
      return {
        data: items,
        page,
        hasMore: page < TOTAL_PAGES - 1,
        totalRecords: TOTAL_ITEMS,
      };
    };

    const gen = createPaginator(fetchPage);
    let count = 0;
    let lastId = -1;

    // Process items one at a time — memory should not grow proportionally to total
    for await (const item of gen) {
      count++;
      lastId = item.id;
      // We don't accumulate items — just process them
    }

    expect(count).toBe(TOTAL_ITEMS);
    expect(lastId).toBe(TOTAL_ITEMS - 1);
  });

  it('large error details should be truncated', () => {
    // Create a 10MB string
    const largeBody = 'x'.repeat(10 * 1024 * 1024);

    const error = new SankhyaError('Big error', 'API_ERROR', 500, largeBody);

    // Details should have been truncated by the SankhyaError constructor
    const details = error.details as string;
    expect(details.length).toBeLessThan(largeBody.length);
    expect(details).toContain('[truncated]');
    // Should be around 1000 chars + truncation marker
    expect(details.length).toBeLessThan(2000);
  });

  it('many concurrent generators: 50 generators created, completed ones can be GC-ed', async () => {
    const GENERATOR_COUNT = 50;
    const ITEMS_PER_GEN = 20;

    const fetchPage = async (page: number): Promise<PaginatedResult<{ value: number }>> => ({
      data: [{ value: page }],
      page,
      hasMore: page < ITEMS_PER_GEN - 1,
      totalRecords: ITEMS_PER_GEN,
    });

    // Create all generators
    const generators = Array.from({ length: GENERATOR_COUNT }, () => createPaginator(fetchPage));

    // Consume them all concurrently
    const results = await Promise.all(
      generators.map(async (gen) => {
        let count = 0;
        for await (const _ of gen) {
          count++;
        }
        return count;
      }),
    );

    // Each generator should have yielded ITEMS_PER_GEN items
    for (const count of results) {
      expect(count).toBe(ITEMS_PER_GEN);
    }

    // After completion, all generator references are released
    // No assertion for GC directly, but we verify no errors and correct counts
    expect(results).toHaveLength(GENERATOR_COUNT);
  });
});
