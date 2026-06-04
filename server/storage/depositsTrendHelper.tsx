// ─── Input types ─────────────────────────────────────────────────────────────

export type AccountType = 'checking' | 'savings' | 'cd';

export interface AccountMetadata {
  account_number: string;
  account_type: AccountType | string;
  interest_rate: number;
  current_balance: number;
}

export interface AccountTransaction {
  account_number: string;
  ledger_balance_after: number | string;
  transaction_date: Date | string;
  transaction_amount?: number | string;
}

// ─── Output types ─────────────────────────────────────────────────────────────

export interface AggregatedEntry {
  /** Day (mm/dd), week Monday (mm/dd), or month (mm/yy) depending on the view. */
  xAxis: string;
  /** Sum of all account type balances. */
  balance: number;
  checking: number;
  cd: number;
  savings: number;
}

export interface AggregatedAccountData {
  /** One entry per day for the last 30 days. */
  month: AggregatedEntry[];
  /** One entry per week from the start of the current quarter to today. */
  quarter: AggregatedEntry[];
  /** One entry per month for the last 12 months. */
  year: AggregatedEntry[];
}

// ─── Internal types ───────────────────────────────────────────────────────────

/** All dates are stored as 'YYYY-MM-DD' strings — no timestamps. */
type DateKey = string;

interface NormalisedTxn {
  account_number: string;
  account_type: string;
  balance: number;
  amount: number;
  date: DateKey;
}

interface BalanceRecord {
  balance: number;
  type: string;
}

interface Snapshot {
  checking: number;
  cd: number;
  savings: number;
  balance: number;
}

// ─── Main function ────────────────────────────────────────────────────────────

export function aggregateAccountData(
  accountMetadata: AccountMetadata[],
  accountTransactions: AccountTransaction[],
): AggregatedAccountData {
  // 1. Build lookup: account_number → normalised account_type
  const accountTypeMap: Record<string, string> = {};
  for (const acct of accountMetadata) {
    accountTypeMap[acct.account_number] = (acct.account_type ?? '').toLowerCase();
  }

  // 2. Normalise & sort transactions ascending by date string
  const txns: NormalisedTxn[] = accountTransactions
    .map((t) => ({
      account_number: t.account_number,
      account_type:   accountTypeMap[t.account_number] ?? 'unknown',
      balance:        Number(t.ledger_balance_after),
      amount:         Number(t.transaction_amount ?? 0),
      date:           toDateKey(t.transaction_date),
    }))
    .filter((t) => t.date !== '')
    .sort((a, b) => a.date.localeCompare(b.date));

  // 3. Index: last balance per account per day
  const dailyLastBalance: Record<DateKey, Record<string, BalanceRecord>> = {};
  for (const t of txns) {
    if (!dailyLastBalance[t.date]) dailyLastBalance[t.date] = {};
    dailyLastBalance[t.date][t.account_number] = { balance: t.balance, type: t.account_type };
  }

  const today = todayDateKey();

  // 4. MONTH – daily snapshots, last 30 days
  const monthStart = addDays(today, -29);
  const month: AggregatedEntry[] = [];
  walkWindow(
    txns, dailyLastBalance, monthStart, today,
    () => true,
    (dk, snap) => month.push({ xAxis: formatDay(dk), ...snap }),
  );

  // 5. QUARTER – weekly snapshots (Mondays), current quarter to today
  const quarterMonday = getMondayOf(getQuarterStart(today));
  const quarter: AggregatedEntry[] = [];
  walkWindow(
    txns, dailyLastBalance, quarterMonday, today,
    (dk) => isDayOfWeek(dk, 1),
    (dk, snap) => quarter.push({ xAxis: formatDay(dk), ...snap }),
  );

  // 6. YEAR – monthly snapshots (1st of month), last 12 months
  const yearStart = addMonths(today, -11, true);
  const year: AggregatedEntry[] = [];
  walkWindow(
    txns, dailyLastBalance, yearStart, today,
    (dk) => dk.endsWith('-01'),
    (dk, snap) => year.push({ xAxis: formatMonth(dk), ...snap }),
  );

  return { month, quarter, year };
}

// ─── Seed builder ─────────────────────────────────────────────────────────────

/**
 * For a given windowStart, returns a seed map: account_number → BalanceRecord.
 *
 * Per-account logic (txns must be sorted ascending by date key):
 *   1. Account has transactions BEFORE windowStart → use the last
 *      ledger_balance_after before the window (true opening balance).
 *   2. Account's first transaction is AT or AFTER windowStart →
 *      reverse-engineer: opening = ledger_balance_after − transaction_amount.
 *   3. Account has no transactions → not in txns, contributes nothing.
 */
function buildSeed(
  txns: NormalisedTxn[],
  windowStart: DateKey,
): Record<string, BalanceRecord> {
  const seed: Record<string, BalanceRecord> = {};

  const byAccount: Record<string, NormalisedTxn[]> = {};
  for (const t of txns) {
    if (!byAccount[t.account_number]) byAccount[t.account_number] = [];
    byAccount[t.account_number].push(t);
  }

  for (const [accountNumber, acctTxns] of Object.entries(byAccount)) {
    const type = acctTxns[0].account_type;

    let lastBefore: NormalisedTxn | null = null;
    for (const t of acctTxns) {
      if (t.date < windowStart) lastBefore = t;
      else break;
    }

    if (lastBefore) {
      seed[accountNumber] = { balance: lastBefore.balance, type };
    } else {
      const first = acctTxns[0];
      seed[accountNumber] = { balance: first.balance - first.amount, type };
    }
  }

  return seed;
}

// ─── Carry-forward walker ─────────────────────────────────────────────────────

/**
 * Walks from windowStart to endDate one day at a time, applying
 * transactions and carrying balances forward. At each sample date
 * (determined by the predicate), takes a snapshot and calls onSnapshot.
 */
function walkWindow(
  txns: NormalisedTxn[],
  dailyLastBalance: Record<DateKey, Record<string, BalanceRecord>>,
  windowStart: DateKey,
  endDate: DateKey,
  isSampleDate: (dk: DateKey) => boolean,
  onSnapshot: (dk: DateKey, snap: Snapshot) => void,
): void {
  const running: Record<string, BalanceRecord> = buildSeed(txns, windowStart);

  let dk = windowStart;
  while (dk <= endDate) {
    const dayTxns = dailyLastBalance[dk];
    if (dayTxns) Object.assign(running, dayTxns);

    if (isSampleDate(dk)) {
      let checking = 0, cd = 0, savings = 0;
      for (const { balance, type } of Object.values(running)) {
        if (type === 'checking')     checking += balance;
        else if (type === 'cd')      cd       += balance;
        else if (type === 'savings') savings  += balance;
      }
      onSnapshot(dk, { checking, cd, savings, balance: checking + cd + savings });
    }

    dk = addDays(dk, 1);
  }
}

// ─── Date-key helpers (all pure string / simple arithmetic) ──────────────────

/** Converts any Date or date-like string into a 'YYYY-MM-DD' key. Returns '' on failure. */
function toDateKey(input: Date | string): DateKey {
  if (typeof input === 'string') {
    // Already looks like YYYY-MM-DD? Keep it.
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
    // Otherwise try to extract the date portion from an ISO string or similar.
    if (/^\d{4}-\d{2}-\d{2}/.test(input)) return input.slice(0, 10);
  }
  // Date object or other parseable string — extract Y/M/D components directly.
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Returns today as a DateKey. */
function todayDateKey(): DateKey {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Adds n days to a DateKey and returns a new DateKey. */
function addDays(dk: DateKey, n: number): DateKey {
  const [y, m, d] = dk.split('-').map(Number);
  const date = new Date(y, m - 1, d + n);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/**
 * Returns a DateKey offset by n months.
 * If snapToFirst is true, returns the 1st of that month.
 */
function addMonths(dk: DateKey, n: number, snapToFirst: boolean = false): DateKey {
  const [y, m, d] = dk.split('-').map(Number);
  const date = new Date(y, m - 1 + n, snapToFirst ? 1 : d);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Checks if a DateKey falls on the given JS day-of-week (0=Sun, 1=Mon … 6=Sat). */
function isDayOfWeek(dk: DateKey, dow: number): boolean {
  const [y, m, d] = dk.split('-').map(Number);
  return new Date(y, m - 1, d).getDay() === dow;
}

/** Returns the Monday (DateKey) of the week containing the given DateKey. */
function getMondayOf(dk: DateKey): DateKey {
  const [y, m, d] = dk.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dow = date.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return addDays(dk, diff);
}

/** Returns the 1st of the quarter containing the given DateKey. */
function getQuarterStart(dk: DateKey): DateKey {
  const [y, m] = dk.split('-').map(Number);
  const qMonth = Math.floor((m - 1) / 3) * 3 + 1;
  return `${y}-${String(qMonth).padStart(2, '0')}-01`;
}

/** Formats a DateKey as 'mm/dd'. */
function formatDay(dk: DateKey): string {
  const parts = dk.split('-');
  return `${parts[1]}/${parts[2]}`;
}

/** Formats a DateKey as 'mm/yy'. */
function formatMonth(dk: DateKey): string {
  const parts = dk.split('-');
  return `${parts[1]}/${parts[0].slice(-2)}`;
}