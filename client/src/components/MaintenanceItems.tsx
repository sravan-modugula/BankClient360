import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Box,
  Typography,
  Chip,
  InputAdornment,
  CircularProgress,
  Alert,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import BuildIcon from '@mui/icons-material/Build';
import { MaintenanceItem } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Account {
  id: string;
  label: string; // e.g. "DDA — ****4821"
}

type SortField = keyof Omit<MaintenanceItem, 'id'>;
type SortDirection = 'asc' | 'desc';

// ─── Placeholder Data ─────────────────────────────────────────────────────────

export const PLACEHOLDER_ACCOUNTS: Account[] = [
  { id: 'ACC-001', label: 'DDA — ****4821' },
  { id: 'ACC-002', label: 'SAV — ****3307' },
  { id: 'ACC-003', label: 'MMA — ****7714' },
  { id: 'ACC-004', label: 'CD  — ****0092' },
];


// ─── Date Helpers ─────────────────────────────────────────────────────────────

function toDateInputValue(d: Date): string {
  return d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

function daysBetween(a: string, b: string): number {
  return Math.abs(
    (new Date(b).getTime() - new Date(a).getTime()) / 86_400_000,
  );
}

function formatDisplayDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${m}/${d}/${y}`;
}

function comparator(
  a: MaintenanceItem,
  b: MaintenanceItem,
  field: SortField,
): number {
  const av = a[field];
  const bv = b[field];
  if (av < bv) return -1;
  if (av > bv) return 1;
  return 0;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface MaintenanceModalProps {
  open: boolean;
  onClose: () => void;
  clientName?: string;
  cifNumber?: string;
  accounts?: Account[];
}

export default function MaintenanceModal({
  open,
  onClose,
  clientName = 'Jonathan R. Mitchell',
  cifNumber = '',
}: MaintenanceModalProps) {
  // ── Date range (default: last 30 days) ──────────────────────────────────────
  const today = toDateInputValue(new Date());
  const thirtyAgo = toDateInputValue(new Date(Date.now() - 30 * 86_400_000));

  const [startDate, setStartDate] = useState(thirtyAgo);
  const [endDate, setEndDate]     = useState(today);
  const [dateError, setDateError] = useState<string | null>(null);

  // ── Account filter ──────────────────────────────────────────────────────────
  const [accountId, setAccountId] = useState<string>('');

  // ── Query enabled when range ≤ 30 days and valid ────────────────────────────
  const rangeIsValid =
    !dateError &&
    startDate <= endDate &&
    daysBetween(startDate, endDate) <= 30;

  const { data, isFetching, isError } = useQuery<MaintenanceItem[]>({
    queryKey: ['maintenance', accountId, startDate, endDate],
    queryFn:  async () => { 
        const res = await fetch(`/api/customer/${cifNumber}/maintenance`, {
          method: "POST", // Specify the HTTP method
          headers: {
            "Content-Type": "application/json" // Inform server about JSON payload
          },
          body: JSON.stringify({
            startDate, 
            endDate
          }) // Convert JavaScript object to JSON string
        });
        if (!res.ok) throw new Error(`Request Failed: ${res.status}`);
        return res.json() as Promise<MaintenanceItem[]>;
    },
    enabled:  open && rangeIsValid,
    staleTime: 30_000,
    onError: (err: any) => console.error('[MaintenanceModal] Query failed:', err),
  } as any);

  
  const records: MaintenanceItem[] = isError ? [] : data ?? [];

  // ── Local sort / search / pagination ────────────────────────────────────────
  const [search,      setSearch]      = useState('');
  const [sortField,   setSortField]   = useState<SortField>('maintenanceDate');
  const [sortDir,     setSortDir]     = useState<SortDirection>('desc');
  const [page,        setPage]        = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Reset page whenever the fetched data changes
  useEffect(() => { setPage(0); }, [data]);

  function validateDates(start: string, end: string) {
    if (start > end) {
      setDateError('Start date must be on or before end date.');
      return;
    }
    if (daysBetween(start, end) > 30) {
      setDateError('Date range cannot exceed 30 days.');
      return;
    }
    setDateError(null);
  }

  function handleStartDate(val: string) {
    setStartDate(val);
    validateDates(val, endDate);
    setPage(0);
  }

  function handleEndDate(val: string) {
    setEndDate(val);
    validateDates(startDate, val);
    setPage(0);
  }

  const filtered = useMemo(() => {
    let rows = [...records];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.maintenanceField.toLowerCase().includes(q) ||
          r.oldValue.toLowerCase().includes(q) ||
          r.newValue.toLowerCase().includes(q),
      );
    }
    rows.sort((a, b) => {
      const cmp = comparator(a, b, sortField);
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [records, search, sortField, sortDir]);

  const paginated = useMemo(
    () => filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage),
    [filtered, page, rowsPerPage],
  );

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(0);
  }

  // ── Design tokens ────────────────────────────────────────────────────────────
  const brandGreen  = '#1a3d2b';
  const accentGreen = '#1a5c38';
  const borderColor = '#d8d6cf';
  const bgMuted     = '#f4f3ef';

  const inputSx = {
    '& .MuiOutlinedInput-root': {
      fontSize: '12px',
      borderRadius: '8px',
      '& fieldset': { borderColor },
      '&:hover fieldset': { borderColor: '#bbb' },
    },
    '& .MuiInputLabel-root': { fontSize: '12px' },
  };

  const headerCellSx = {
    fontSize: '11px',
    fontWeight: 500,
    color: accentGreen,
    borderBottom: '1.5px solid #e8e6e0',
    whiteSpace: 'nowrap',
    py: '7px',
    px: '10px',
    backgroundColor: '#fff',
  };

  const bodyCellSx = {
    fontSize: '12px',
    color: '#1a1a1a',
    py: '9px',
    px: '10px',
    borderBottom: '0.5px solid #e8e6e0',
    verticalAlign: 'middle',
  };

  const COLUMNS: { field: SortField; label: string }[] = [
    { field: 'maintenanceDate',     label: 'Date' },
    { field: 'maintenanceField',    label: 'Field' },
    { field: 'oldValue', label: 'Old Value' },
    { field: 'newValue', label: 'New Value' },
  ];

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth={false}
      PaperProps={{
        sx: {
          width: 860,
          maxWidth: '96vw',
          maxHeight: '85vh',
          borderRadius: '14px',
          border: `0.5px solid ${borderColor}`,
          boxShadow: '0 8px 40px rgba(0,0,0,0.14)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        },
      }}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <DialogTitle
        sx={{
          background: brandGreen,
          py: '14px',
          px: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <BuildIcon sx={{ color: 'rgba(255,255,255,0.7)', fontSize: 18 }} />
          <Typography sx={{ color: '#fff', fontSize: '14px', fontWeight: 600 }}>
            Maintenance — {clientName}
          </Typography>
        </Box>
        <IconButton
          onClick={onClose}
          size="small"
          sx={{ color: 'rgba(255,255,255,0.7)', '&:hover': { color: '#fff' }, p: 0 }}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <DialogContent
        sx={{
          px: '20px',
          pt: '24px',
          pb: '8px',
          overflowY: 'auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          // MUI DialogContent sets its own padding via first-child selector; override it
          '&.MuiDialogContent-root': { pt: '24px' },
        }}
      >
        {/* ── Controls row ── */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: '16px', flexWrap: 'wrap', mt: '4px' }}>

          {/* Account selector */}
          {/*
          <FormControl size="small" sx={{ minWidth: 190, ...inputSx }}>
            <InputLabel>Account</InputLabel>
            <Select
              label="Account"
              value={accountId}
              onChange={(e) => { setAccountId(e.target.value); setPage(0); }}
              sx={{ fontSize: '12px', borderRadius: '8px' }}
            >
              {data.map((a, idx) => (
                <MenuItem key={idx} value={idx} sx={{ fontSize: '12px', fontFamily: 'monospace' }}>
                  {a.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          */}

          {/* Start date */}
          <TextField
            size="small"
            label="Start Date"
            type="date"
            value={startDate}
            onChange={(e) => handleStartDate(e.target.value)}
            slotProps={{
                htmlInput: { max: endDate },
                inputLabel: { shrink: true }
            }}
            error={!!dateError}
            sx={{ width: 158, ...inputSx }}
          />

          {/* End date */}
          <TextField
            size="small"
            label="End Date"
            type="date"
            value={endDate}
            onChange={(e) => handleEndDate(e.target.value)}
            slotProps={{
                htmlInput: { min: startDate },
                inputLabel: { shrink: true }
            }}
            error={!!dateError}
            sx={{ width: 158, ...inputSx }}
          />

          {/* Spacer */}
          <Box sx={{ flex: 1 }} />

          {/* Search */}
          <TextField
            size="small"
            placeholder="Search field or value…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ fontSize: 16, color: '#bbb' }} />
                </InputAdornment>
              ),
            }}
            sx={{ minWidth: 200, ...inputSx }}
          />
        </Box>

        {/* Date validation error */}
        {dateError && (
          <Alert
            severity="warning"
            sx={{ mb: '12px', fontSize: '12px', py: '4px', borderRadius: '8px' }}
          >
            {dateError}
          </Alert>
        )}

        {/* ── Table ── */}
        <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
          <Table size="small" stickyHeader sx={{ minWidth: 560 }}>
            <TableHead>
              <TableRow>
                {COLUMNS.map(({ field, label }) => (
                  <TableCell
                    key={field}
                    sx={headerCellSx}
                    sortDirection={sortField === field ? sortDir : false}
                  >
                    <TableSortLabel
                      active={sortField === field}
                      direction={sortField === field ? sortDir : 'asc'}
                      onClick={() => handleSort(field)}
                      sx={{
                        color: `${accentGreen} !important`,
                        fontSize: '11px',
                        '& .MuiTableSortLabel-icon': { color: `${accentGreen} !important` },
                      }}
                    >
                      {label}
                    </TableSortLabel>
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>

            <TableBody>
              {!rangeIsValid && !isFetching ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    sx={{ textAlign: 'center', py: 5, color: '#bbb', fontSize: '13px' }}
                  >
                    Select a valid date range (max 30 days) to load records.
                  </TableCell>
                </TableRow>
              ) : isFetching ? (
                <TableRow>
                  <TableCell colSpan={4} sx={{ textAlign: 'center', py: 5 }}>
                    <CircularProgress size={20} sx={{ color: accentGreen }} />
                  </TableCell>
                </TableRow>
              ) : isError ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    sx={{ textAlign: 'center', py: 5, color: '#b83232', fontSize: '13px' }}
                  >
                    Failed to load records.
                  </TableCell>
                </TableRow>
              ) : paginated.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    sx={{ textAlign: 'center', py: 5, color: '#aaa', fontSize: '13px' }}
                  >
                    No records found for this range.
                  </TableCell>
                </TableRow>
              ) : (
                paginated.map((row, idx) => (
                  <TableRow
                    key={idx}
                    sx={{
                      background: idx % 2 === 1 ? '#fafaf8' : '#fff',
                      '&:hover td': { background: '#f4f3ef' },
                      '&:last-child td': { borderBottom: 'none' },
                    }}
                  >
                    <TableCell sx={{ ...bodyCellSx, whiteSpace: 'nowrap' }}>
                      {formatDisplayDate(row.maintenanceDate)}
                    </TableCell>
                    <TableCell sx={bodyCellSx}>{row.maintenanceField}</TableCell>
                    <TableCell sx={{ ...bodyCellSx, color: '#888' }}>{row.oldValue}</TableCell>
                    <TableCell sx={{ ...bodyCellSx, fontWeight: 500 }}>{row.newValue}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* ── Pagination ── */}
        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
          rowsPerPageOptions={[10, 25, 50]}
          sx={{
            borderTop: '0.5px solid #e8e6e0',
            mt: 'auto',
            '& .MuiTablePagination-select':        { fontSize: '12px' },
            '& .MuiTablePagination-displayedRows': { fontSize: '12px', color: '#888' },
            '& .MuiTablePagination-selectLabel':   { fontSize: '12px', color: '#888' },
          }}
        />
      </DialogContent>
    </Dialog>
  );
}