import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  InputAdornment,
  TableSortLabel,
  useTheme
} from '@mui/material';
import {
  AccountBalance,
  Savings,
  CreditCard,
  Home,
  AccountBalanceWallet,
  Search
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useDateFormatter } from '@/lib/dateFormatters';
import { useHasPermission } from '@/hooks/usePermissions';
import type { Account } from '@shared/schema';

interface AccountTableProp {
  accounts: Account[];
  canViewBalances: boolean;
  title?: string;
  onAccountSelect?: (accountId: number | null, accountLabel: string) => void;
  selectedAccountId?: number | null;
  onViewAccountDetail?: (accountId: number) => void;
  onRowClick?: (account: Account) => void;
}

function AccountTable({
  accounts,
  canViewBalances,
  title,
  onAccountSelect,
  selectedAccountId,
  onViewAccountDetail,
  onRowClick
}: AccountTableProp) {
  const theme = useTheme();
  const [, setLocation] = useLocation();
  const { formatCurrency } = useDateFormatter();

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Filter state
  const [accountTypeFilter, setAccountTypeFilter] = useState<'all' | 'deposits' | 'loans'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Sort state — default to Status asc so ACTIVE rows surface first
  // (normalizeStatus values are upper-case canonical; ACTIVE < CLOSED < FROZEN < INACTIVE < ...)
  type SortableColumn = 'balance' | 'status';
  const [orderBy, setOrderBy] = useState<SortableColumn | null>('status');
  const [order, setOrder] = useState<'asc' | 'desc'>('asc');

  const handleRequestSort = (column: SortableColumn) => {
    if (orderBy === column) {
      setOrder(order === 'asc' ? 'desc' : 'asc');
    } else {
      setOrderBy(column);
      setOrder('asc');
    }
  };

  // Map verbose backend statuses (e.g. "LOAN IS ACTIVE, TRANSACTIONS ACCEPTED")
  // down to a short canonical label so the column stays a stable width.
  const normalizeStatus = (status: string): string => {
    const s = (status || '').toLowerCase();
    if (!s) return 'UNKNOWN';
    if (s.includes('paid')) return 'PAID OFF';
    if (s.includes('matured')) return 'MATURED';
    if (s.includes('frozen')) return 'FROZEN';
    if (s.includes('suspended')) return 'SUSPENDED';
    if (s.includes('closed')) return 'CLOSED';
    if (s.includes('inactive')) return 'INACTIVE';
    if (s.includes('active')) return 'ACTIVE';
    return status.replace(/_/g, ' ').toUpperCase();
  };

  const getStatusColor = (status: string) => {
    switch (normalizeStatus(status)) {
      case 'ACTIVE': return 'success';
      case 'INACTIVE': return 'warning';
      case 'CLOSED': return 'error';
      case 'PAID OFF': return 'info';
      case 'FROZEN': return 'warning';
      case 'SUSPENDED': return 'error';
      case 'MATURED': return 'success';
      default: return 'default';
    }
  };

  const formatStatusLabel = (status: string) => {
    if (!status) return '-';
    return normalizeStatus(status);
  };

  const accountTypes = [
    { key: 'all', label: 'All' },
    { key: 'deposits', label: 'Deposits' },
    { key: 'loans', label: 'Loans' }
  ] as const;

  const isLoanType = (t: string) => {
    const s = (t || '').toLowerCase();
    return s.includes('loan') || s.includes('mortgage') || s.includes('heloc') || s.includes('credit');
  };

  useEffect(() => {
    setPage(0);
  }, [accountTypeFilter, searchQuery, orderBy, order]);

  // Safe parsing helpers
  const safeParseBalance = (balance: string | number | null | undefined): number => {
    if (balance === null || balance === undefined || balance === '') return 0;
    const parsed = typeof balance === 'string' ? parseFloat(balance) : balance;
    return isNaN(parsed) ? 0 : parsed;
  };

  const safeParseInterestRate = (rate: string | number | null | undefined): number | null => {
    if (rate === null || rate === undefined || rate === '') return null;
    const parsed = typeof rate === 'string' ? parseFloat(rate) : rate;
    return isNaN(parsed) ? null : parsed;
  };

  // Get account icon based on type
  const getAccountIcon = (accountType: string) => {
    const iconStyle = { color: theme.palette.primary.main, fontSize: 20 };

    switch (accountType.toLowerCase()) {
      case 'checking':
        return <AccountBalance sx={iconStyle} />;
      case 'savings':
      case 'cd':
        return <Savings sx={iconStyle} />;
      case 'credit_card':
      case 'credit':
        return <CreditCard sx={iconStyle} />;
      case 'mortgage':
      case 'heloc':
      case 'loan':
        return <Home sx={iconStyle} />;
      default:
        return <AccountBalanceWallet sx={iconStyle} />;
    }
  };

  // Get formatted account type label
  const getAccountTypeLabel = (accountType: string, accountSubtype: string | null) => {
    const typeFormatted = accountType.charAt(0).toUpperCase() + accountType.slice(1).replace('_', ' ');
    return typeFormatted;
  };

  // Get formatted product name
  const getProductName = (accountSubtype: string | null) => {
    if (!accountSubtype) return '-';
    return accountSubtype
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  // Mask account number (show last 5 digits)
  const maskAccountNumber = (accountNumber: string) => {
    if (accountNumber.length <= 5) return accountNumber;
    return '***' + accountNumber.slice(-5);
  };

  // Calculate total balance with safe parsing
  const totalBalance = accounts.reduce((sum, account) => {
    return sum + safeParseBalance(account.balance);
  }, 0);

  // Handle row click - navigate to account details page or call callback
  const handleRowClick = (account: Account) => {
    if (onRowClick) {
      onRowClick(account);
    } else if (onViewAccountDetail) {
      onViewAccountDetail(account.accountId);
    } else {
      setLocation(`/account/${account.accountId}`);
    }
  };

  // Pagination handlers
  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  // Filter accounts (case-insensitive to handle SQL Server data casing)
  const filteredAccounts = accounts.filter(account => {
    const type = account.accountType?.toLowerCase() || '';
    let matchesType = true;
    if (accountTypeFilter === 'deposits') matchesType = !isLoanType(type);
    else if (accountTypeFilter === 'loans') matchesType = isLoanType(type);

    const matchesSearch = !searchQuery ||
      account.accountNumber.includes(searchQuery) ||
      type.includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Sort accounts
  const sortedAccounts = orderBy
    ? [...filteredAccounts].sort((a, b) => {
      let cmp = 0;
      if (orderBy === 'balance') {
        cmp = safeParseBalance(a.balance) - safeParseBalance(b.balance);
      } else if (orderBy === 'status') {
        cmp = normalizeStatus(a.accountStatus).localeCompare(normalizeStatus(b.accountStatus));
      }
      return order === 'asc' ? cmp : -cmp;
    })
    : filteredAccounts;

  // Get paginated accounts
  const paginatedAccounts = sortedAccounts.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  return (
    <Card elevation={2} sx={{ mb: 3 }}>
      <CardContent>
        <Box sx={{ mb: 2 }}>
          <Typography
            variant="h6"
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              color: theme.palette.text.primary,
              fontWeight: 400
            }}
          >
            <AccountBalance sx={{ color: theme.palette.primary.main }} />
            {title} <Chip sx={{backgroundColor: "#eaf3e4", border: "1px solid #c0d8b8"}} label={accounts.length}/>
          </Typography>
        </Box>

        {/* Filter Bar */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
          <ToggleButtonGroup
            value={accountTypeFilter}
            exclusive
            onChange={(_e, value) => value && setAccountTypeFilter(value)}
            size="small"
          >
            {accountTypes.map(type => (
              <ToggleButton key={type.key} value={type.key} data-testid={`filter-${type.key}`}>
                {type.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <TextField
            placeholder="Search accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ width: 250 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              )
            }}
            data-testid="input-search-accounts-list"
          />
        </Box>

        <TableContainer component={Paper} sx={{ borderLeft: 'none', borderRight: 'none' }}>
          <Table size="small" sx={{ minWidth: 650 }}>
            <TableHead>
              <TableRow sx={{ backgroundColor: theme.palette.action.hover }}>
                <TableCell width="50"></TableCell>
                <TableCell sx={{ fontWeight: 400 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 400 }}>Account #</TableCell>
                <TableCell sx={{ fontWeight: 400 }}>Product</TableCell>
                <TableCell sx={{ fontWeight: 400 }}>Ownership Type</TableCell>
                {canViewBalances && (
                  <TableCell align="right" sx={{ fontWeight: 400 }} sortDirection={orderBy === 'balance' ? order : false}>
                    <TableSortLabel
                      active={orderBy === 'balance'}
                      direction={orderBy === 'balance' ? order : 'asc'}
                      onClick={() => handleRequestSort('balance')}
                      data-testid="sort-balance"
                    >
                      Balance
                    </TableSortLabel>
                  </TableCell>
                )}
                {canViewBalances && <TableCell align="center" sx={{ fontWeight: 400 }}>Interest Rate</TableCell>}
                <TableCell align="center" sx={{ fontWeight: 400 }} sortDirection={orderBy === 'status' ? order : false}>
                  <TableSortLabel
                    active={orderBy === 'status'}
                    direction={orderBy === 'status' ? order : 'asc'}
                    onClick={() => handleRequestSort('status')}
                    data-testid="sort-status"
                  >
                    Status
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedAccounts.map((account) => {
                const isSelected = selectedAccountId === account.accountId;
                return (
                  <TableRow
                    key={account.accountId}
                    hover
                    onClick={() => handleRowClick(account)}
                    sx={{
                      cursor: 'pointer',
                      backgroundColor: isSelected ? theme.palette.action.selected : 'inherit',
                      '&:hover': {
                        backgroundColor: theme.palette.action.hover
                      }
                    }}
                    data-testid={`account-row-${account.accountId}`}
                  >
                    <TableCell>
                      {getAccountIcon(account.accountType)}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="400">
                        {getAccountTypeLabel(account.accountType, account.accountSubtype)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography
                        variant="body2"
                        fontFamily="monospace"
                        sx={{ color: theme.palette.text.secondary }}
                      >
                        {maskAccountNumber(account.accountNumber)}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography variant="body2">
                        {getProductName(account.accountSubtype)}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Typography
                        variant="body2"
                        fontFamily="monospace"
                        sx={{ color: theme.palette.text.secondary }}
                      >
                        {account.ownershipType}
                      </Typography>
                    </TableCell>

                    {canViewBalances && (
                      <TableCell align="right">
                        <Typography
                          variant="body2"
                          fontWeight="400"
                          fontFamily="monospace"
                        >
                          {formatCurrency(safeParseBalance(account.balance))}
                        </Typography>
                      </TableCell>
                    )}
                    {canViewBalances && (
                      <TableCell align="center">
                        {(() => {
                          const rate = safeParseInterestRate(account.interestRate);
                          return rate !== null ? (
                            <Chip
                              label={`${rate.toFixed(4)}%`}
                              size="small"
                              sx={{
                                backgroundColor: theme.palette.success.light,
                                color: '#ffffff',
                                fontWeight: 400,
                                fontSize: '0.75rem'
                              }}
                            />
                          ) : (
                            <Typography variant="body2" color="text.disabled">
                              -
                            </Typography>
                          );
                        })()}
                      </TableCell>
                    )}
                    <TableCell align="center">
                      <Chip
                        label={formatStatusLabel(account.accountStatus)}
                        color={getStatusColor(account.accountStatus) as any}
                        size="small"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
              {paginatedAccounts.length > 0 && canViewBalances && (
                <TableRow sx={{ backgroundColor: theme.palette.action.hover }}>
                  <TableCell colSpan={5}>
                    <Typography variant="body2" fontWeight="600" color="text.secondary">
                      Total (All {accounts.length} Accounts)
                    </Typography>
                  </TableCell>
                  <TableCell align="right">
                    <Typography variant="body2" fontWeight="400">
                      {formatCurrency(totalBalance)}
                    </Typography>
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {filteredAccounts.length > 10 && (
          <TablePagination
            rowsPerPageOptions={[10, 25, 50, 100]}
            component="div"
            count={filteredAccounts.length}
            rowsPerPage={rowsPerPage}
            page={page}
            onPageChange={handleChangePage}
            onRowsPerPageChange={handleChangeRowsPerPage}
            sx={{ borderTop: `1px solid ${theme.palette.divider}` }}
          />
        )}
      </CardContent>
    </Card>
  )
}


interface AccountListProps {
  customerId?: number;
  title?: string;
  onAccountSelect?: (accountId: number | null, accountLabel: string) => void;
  selectedAccountId?: number | null;
  onViewAccountDetail?: (accountId: number) => void;
  onRowClick?: (account: Account) => void;
}

export default function AccountList({
  customerId,
  title = 'Accounts',
  onAccountSelect,
  selectedAccountId = null,
  onViewAccountDetail,
  onRowClick
}: AccountListProps) {
  const theme = useTheme();

  const canViewBalances = useHasPermission('account.view.balances');


  // Fetch accounts from API only when no pre-supplied accounts and customerId is provided
  const { data: fetchedAccounts = [], isLoading: queryLoading, error: queryError } = useQuery<Account[]>({
    queryKey: [`/api/customers/${customerId}/accounts`],
    enabled: !!customerId && Number.isFinite(customerId)
  });

  const primaryAccounts = fetchedAccounts.filter((x) => ["Primary account owner", "Joint Account Owner"].includes((x.ownershipType || "").trim()));
  const secondaryAccount = fetchedAccounts.filter((x) => !["Primary account owner", "Joint Account Owner"].includes((x.ownershipType || "").trim()));

  if (queryLoading) {
    return (
      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        </CardContent>
      </Card>
    );
  }

  if (queryError) {
    // Check if this is a 403 error (permission denied due to ABAC restriction)
    const is403 = queryError instanceof Error && 'status' in queryError && (queryError as any).status === 403;
    const errorMessage = is403 && (queryError as any).message?.includes('employee')
      ? 'Access restricted: Level 1 users cannot view account information for employee customers.'
      : 'Failed to load accounts';

    return (
      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          <Alert severity={is403 ? "warning" : "error"}>{errorMessage}</Alert>
        </CardContent>
      </Card>
    );
  }

  if (fetchedAccounts.length === 0) {
    return (
      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          <Alert severity="info">No accounts found for this customer</Alert>
        </CardContent>
      </Card>
    );
  }

  // NOTE: Keep the primary accounts table empty so bankers don't confuse primary accounts
  // and secondar accounts. We can hide the secondary accounts table if it's empty
  return (
    <>
      <AccountTable
        accounts={primaryAccounts}
        canViewBalances={canViewBalances}
        title={"Owned Accounts"}
        onAccountSelect={onAccountSelect}
        selectedAccountId={selectedAccountId}
        onViewAccountDetail={onViewAccountDetail}
        onRowClick={onRowClick}
      />
      {secondaryAccount.length > 0 && (
        <AccountTable
          accounts={secondaryAccount}
          canViewBalances={canViewBalances}
          title={"Affiliated Accounts (Non-Owned)"}
          onAccountSelect={onAccountSelect}
          selectedAccountId={selectedAccountId}
          onViewAccountDetail={onViewAccountDetail}
          onRowClick={onRowClick}
        />
      )}
    </>
  );
}
