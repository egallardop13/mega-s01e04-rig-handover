import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { lastBeat, type Beat } from './heartbeat.js';
import { readNight } from './digest/read.js';

export type Counts = { ok: number; retry: number; fail: number };

// counts is null when the night's file could not be read: the view prints `—`.
export type NightSummary = { night: string; counts: Counts | null };

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: NightSummary[];
};

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

// Pure per-night summary: jobs by their last status.
export function summarizeNights(runsDir: string): NightSummary[] {
  return nightsOnDisk(runsDir).map((night) => {
    try {
      const counts: Counts = { ok: 0, retry: 0, fail: 0 };
      for (const row of readNight(runsDir, night).rows) counts[row.lastStatus]++;
      return { night, counts };
    } catch {
      return { night, counts: null };
    }
  });
}

export function readStatus(config: RigConfig): Status {
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights: summarizeNights(config.runsDir),
  };
}
