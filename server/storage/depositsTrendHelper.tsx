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
  transaction_date: Date | string;
  transaction_amount: number | string;
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
  loan: number;
  loanBalance: number;
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

interface BalanceRecord {
  balance: number;
  type: string;
}

interface Snapshot {
  checking: number;
  cd: number;
  savings: number;
  balance: number;
  loan: number;
  loanBalance: number;
}

// ─── Main function ────────────────────────────────────────────────────────────

export function aggregateAccountData(
  accountMetadata: AccountMetadata[],
  accountTransactions: AccountTransaction[],
): AggregatedAccountData {
  const today = todayDateKey();

  // 1. Window boundaries
  const monthStart   = addDays(today, -29);
  const currentQuarter = getQuarterStart(today);
  const oneMonthInto = addMonths(currentQuarter, 1, false)
  const effectiveQuarter = today < oneMonthInto
    ? addMonths(currentQuarter, -3, true)
    : currentQuarter;
  const quarterStart = getMondayOf(effectiveQuarter);
  const yearStart    = addMonths(today, -11, true);

  // Earliest date we need to reach (yearStart is always the furthest back)
  const windowStart = yearStart < quarterStart ? yearStart : quarterStart;

  // 2. Seed running balances from current_balance in AccountMetadata
  const running: Record<string, BalanceRecord> = {};
  for (const acct of accountMetadata) {
    running[acct.account_number] = {
      balance: Number(acct.current_balance),
      type: (acct.account_type ?? '').toLowerCase(),
    };
  }

  // 3. Index: sum of transaction_amounts per account per day
  const dailyAmounts: Record<DateKey, Record<string, number>> = {};
  for (const t of accountTransactions) {
    const dk = toDateKey(t.transaction_date);
    if (dk === '') continue;
    const amount = Number(t.transaction_amount ?? 0);
    if (!dailyAmounts[dk]) dailyAmounts[dk] = {};
    if (!dailyAmounts[dk][t.account_number]) dailyAmounts[dk][t.account_number] = 0;
    dailyAmounts[dk][t.account_number] += amount;
  }

  // 4. Single backwards walk from today → windowStart.
  //    Snapshot into each view when the day meets that view's criteria.
  //    After snapshotting, undo the day's transactions to reveal
  //    the previous day's closing balance.
  const month:   AggregatedEntry[] = [];
  const quarter: AggregatedEntry[] = [];
  const year:    AggregatedEntry[] = [];

  let dk = today;
  while (dk >= windowStart) {
    const snap = takeSnapshot(running);

    // MONTH – every day within the last 30 days
    if (dk >= monthStart) {
      month.push({ xAxis: formatDay(dk), ...snap });
    }

    // QUARTER – Mondays within the current quarter window
    if (dk >= quarterStart) { //  && isDayOfWeek(dk, 1)) {
      quarter.push({ xAxis: formatDay(dk), ...snap });
    }

    // YEAR – 1st of month within the last 12 months
    if (dk >= yearStart && isDayOfWeek(dk, 1)) { // dk.endsWith('-01')) {
      year.push({ xAxis: formatMonth(dk), ...snap });
    }

    // Undo this day's transactions to step back one day.
    // Subtracting reverses both credits (+amount) and debits (−amount).
    const dayAmounts = dailyAmounts[dk];
    if (dayAmounts) {
      for (const [acctNum, amount] of Object.entries(dayAmounts)) {
        if (running[acctNum]) {
          running[acctNum] = {
            ...running[acctNum],
            balance: running[acctNum].balance - amount,
          };
        }
      }
    }

    dk = addDays(dk, -1);
  }

  // Walked backwards, so reverse all three into chronological order
  month.reverse();
  quarter.reverse();
  year.reverse();

  return { month, quarter, year };
}

// ─── Snapshot helper ──────────────────────────────────────────────────────────

function takeSnapshot(running: Record<string, BalanceRecord>): Snapshot {
  let checking = 0, cd = 0, savings = 0, loan = 0;

  for (const { balance, type } of Object.values(running)) {
    if (type === 'checking' || type === 'deposit checking') {
      checking += balance;
    } else if (type === 'cd' || type === 'time deposit') {
      cd += balance;
    } else if (type === 'savings' || type === 'christmas club depo') {
      savings += balance;
    } else if (type === 'loan') {
      loan += balance;
    }
  }

  return {
    checking,
    cd,
    savings,
    loan,
    balance: checking + cd + savings,
    loanBalance: loan,
  };
}

// ─── Date-key helpers (all pure string / simple arithmetic) ──────────────────


function formatFlatDate(dateString: string | undefined): string {
    if (!dateString) return 'N/A';

    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return 'N/A';
    }

    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'UTC' // Essential for Z-ending strings
    });;
};



/** Converts any Date or date-like string into a 'YYYY-MM-DD' key. Returns '' on failure. */
function toDateKey(input: Date | string): DateKey {
  if (typeof input === 'string') {
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
    if (/^\d{4}-\d{2}-\d{2}/.test(input)) return input.slice(0, 10);
  }
  const d = typeof input === 'string' ? new Date(input) : input;
  if (isNaN(d.getTime())) return '';
  // Use toISOString so a UTC midnight date doesn't shift back a day in local time
  return d.toISOString().slice(0, 10);
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

/** Returns a DateKey offset by n months. If snapToFirst is true, returns the 1st of that month. */
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
  const dow = new Date(y, m - 1, d).getDay();
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