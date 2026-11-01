// Plan morning-digest § 1 (issue #1). The contract section 2 builds against.
// The implementation lives in ./read.ts: `import { readNight } from './digest/read.js'`.

export type RunStatus = 'ok' | 'retry' | 'fail';

// One parsed line of runs/<night>.jsonl.
export type RunLine = {
  at: string; // offset kept as written in the log, never converted to UTC
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

// One row per job, in file order of its lines.
export type DigestRow = {
  job: string;
  owner: string | null; // null stays null here; the view prints `—`
  runs: number; // lines for this job
  retries: number; // lines with status `retry`
  lastStatus: RunStatus;
  lastError: string | null; // error of the latest line that had one
  firstAt: string; // `at` of the job's first line, offset as in the log
  lastAt: string; // `at` of the job's last line, offset as in the log
};

export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job name
  badLines: number; // lines that are not JSON, miss a field, or carry an unknown status
};

// readNight(runsDir, night) reads `<runsDir>/<night>.jsonl`.
// - An empty file gives { rows: [], badLines: 0 } ("nothing ran").
// - No file (or a night that isn't YYYY-MM-DD) throws NightNotFoundError: routes map it to 404.
// - Any other I/O error is thrown as is.
export type ReadNight = (runsDir: string, night: string) => Night;

export class NightNotFoundError extends Error {
  readonly night: string;
  constructor(night: string) {
    super(`no run log for night ${night}`);
    this.name = 'NightNotFoundError';
    this.night = night;
  }
}
