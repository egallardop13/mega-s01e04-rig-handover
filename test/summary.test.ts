import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { summarizeNights } from '../src/status.js';

const line = (job: string, status: string) => JSON.stringify({ at: '2026-10-28T01:00:00+01:00', job, status, owner: null });

describe('summarizeNights', () => {
  it('counts jobs by last status, newest night first', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-'));
    writeFileSync(join(dir, '2026-10-27.jsonl'), [line('a', 'ok'), line('b', 'retry'), line('b', 'ok')].join('\n') + '\n');
    writeFileSync(join(dir, '2026-10-28.jsonl'), [line('a', 'ok'), line('b', 'retry'), line('c', 'fail'), line('c', 'retry')].join('\n') + '\n');
    writeFileSync(join(dir, '2026-10-29.jsonl'), '');
    expect(summarizeNights(dir)).toEqual([
      { night: '2026-10-29', counts: { ok: 0, retry: 0, fail: 0 } },
      { night: '2026-10-28', counts: { ok: 1, retry: 2, fail: 0 } },
      { night: '2026-10-27', counts: { ok: 2, retry: 0, fail: 0 } },
    ]);
  });
});
