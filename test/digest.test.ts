import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';
import { NightNotFoundError } from '../src/digest/types.js';

describe('readNight on runs/2026-10-28.jsonl', () => {
  const n = readNight('runs', '2026-10-28');
  const row = (job: string) => n.rows.find((r) => r.job === job);

  it('has 5 jobs and 1 bad line', () => {
    expect(n.night).toBe('2026-10-28');
    expect(n.rows).toHaveLength(5);
    expect(n.badLines).toBe(1);
  });

  it('sorts rows by job name', () => {
    expect(n.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts runs and retries, keeps the last error after a later ok', () => {
    expect(row('fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: 'upstream 503',
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('keeps a fail and its error', () => {
    expect(row('notes/backup')).toMatchObject({ lastStatus: 'fail', lastError: 'quota exceeded', runs: 1 });
  });

  it('keeps a row whose owner is null', () => {
    expect(row('digest/render')).toMatchObject({ owner: null, lastStatus: 'ok', lastError: null });
  });

  it('keeps the offset from the log', () => {
    expect(row('lane/sync')).toMatchObject({
      runs: 8,
      retries: 1,
      firstAt: '2026-10-28T23:00:06+01:00',
      lastAt: '2026-10-29T05:00:04+01:00',
    });
  });
});

describe('readNight edge cases', () => {
  const dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('throws NightNotFoundError for a night with no file (routes return 404)', () => {
    expect(() => readNight(dir, '2026-01-01')).toThrow(NightNotFoundError);
  });

  it('throws NightNotFoundError for a night that is not a date', () => {
    expect(() => readNight(dir, '../etc')).toThrow(NightNotFoundError);
  });

  it('reads an empty file as 0 rows and 0 bad lines', () => {
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('counts JSON without the required fields or with an unknown status as bad', () => {
    writeFileSync(
      join(dir, '2026-01-03.jsonl'),
      [
        '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"ok","owner":"x"}',
        '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"skipped","owner":"x"}',
        '{"job":"a","status":"ok","owner":"x"}',
        '[1,2]',
        'not json',
      ].join('\n') + '\n',
    );
    const n = readNight(dir, '2026-01-03');
    expect(n.rows).toHaveLength(1);
    expect(n.badLines).toBe(4);
  });
});
