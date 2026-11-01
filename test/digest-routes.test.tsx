import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

let dir: string;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  process.env.LANE_MARKER = 'TEST-MARKER';
  dir = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  copyFileSync(join('runs', '2026-10-28.jsonl'), join(dir, '2026-10-28.jsonl'));
  writeFileSync(join(dir, '2026-10-30.jsonl'), '');
  writeFileSync(
    join(dir, '2026-10-31.jsonl'),
    [
      '{"at":"2026-10-31T01:00:00+01:00","job":"lane/sync","status":"ok","owner":"rook"}',
      'not json',
      '{"at":"2026-10-31T02:00:00+01:00","job":"rig/rotate-logs","status":"ok","owner":"lane-07"}',
      '',
    ].join('\n'),
  );
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir: dir,
  });
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

// Job names from the first cell of each body row, without the "! " mark.
function pageJobs(html: string): string[] {
  const body = html.split('<tbody>')[1]?.split('</tbody>')[0] ?? '';
  return [...body.matchAll(/<tr[^>]*><td>([^<]*)<\/td>/g)].map((m) => (m[1] ?? '').replace(/^! /, ''));
}

describe('digest routes', () => {
  it('good night: page and JSON agree on the jobs and their order', async () => {
    const page = await app.request('/digest/2026-10-28');
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('! fixtures/refresh');
    expect(html).toContain('! notes/backup');
    const fromPage = pageJobs(html);
    expect(fromPage).toHaveLength(5);
    expect(fromPage).toEqual([...fromPage].sort());

    const api = await app.request('/api/digest/2026-10-28');
    const body = (await api.json()) as Night;
    expect(api.status).toBe(200);
    expect(body.rows).toHaveLength(5);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(fromPage);
  });

  it('night with no file: 404 on both routes, JSON carries an error', async () => {
    const page = await app.request('/digest/2026-10-29');
    expect(page.status).toBe(404);
    const api = await app.request('/api/digest/2026-10-29');
    expect(api.status).toBe(404);
    const body = (await api.json()) as { error?: string };
    expect(typeof body.error).toBe('string');
  });

  it('empty night: says nothing ran, JSON has no rows', async () => {
    const page = await app.request('/digest/2026-10-30');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');
    const api = await app.request('/api/digest/2026-10-30');
    expect(api.status).toBe(200);
    const body = (await api.json()) as Night;
    expect(body.rows).toEqual([]);
    expect(body.badLines).toBe(0);
  });

  it('night with a bad line: valid jobs render, the note shows, JSON counts it', async () => {
    const page = await app.request('/digest/2026-10-31');
    const html = await page.text();
    expect(page.status).toBe(200);
    expect(pageJobs(html)).toEqual(['lane/sync', 'rig/rotate-logs']);
    expect(html).toContain('did not parse');
    const api = await app.request('/api/digest/2026-10-31');
    expect(((await api.json()) as Night).badLines).toBe(1);
  });
});
