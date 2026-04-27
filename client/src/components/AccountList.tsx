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

interface AccountListProps {
  customerId: number;
  onAccountSelect?: (accountId: number | null, accountLabel: string) => void;
  selectedAccountId?: number | null;
  onViewAccountDetail?: (accountId: number) => void;
}

export default function AccountList({
  customerId,
  onAccountSelect,
  selectedAccountId = null,
  onViewAccountDetail
}: AccountListProps) {
  const theme = useTheme();
  const [, setLocation] = useLocation();
  const { formatCurrency } = useDateFormatter();
  const canViewBalances = useHasPermission('account.view.balances');

  // Pagination state
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Filter state
  const [accountTypeFilter, setAccountTypeFilter] = useState<'all' | 'deposits' | 'loans'>('all');
  const [searchQuery, setSearchQuery] = useState('');

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
  }, [accountTypeFilter, searchQuery]);

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

  // Fetch accounts from API
  const { data: accounts = [], isLoading, error } = useQuery<Account[]>({
    queryKey: [`/api/customers/${customerId}/accounts`],
    enabled: !!customerId && Number.isFinite(customerId)
  });

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
    if (onViewAccountDetail) {
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

  // Get paginated accounts
  const paginatedAccounts = filteredAccounts.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );

  if (isLoading) {
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

  if (error) {
    // Check if this is a 403 error (permission denied due to ABAC restriction)
    const is403 = error instanceof Error && 'status' in error && (error as any).status === 403;
    const errorMessage = is403 && (error as any).message?.includes('employee') 
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

  if (accounts.length === 0) {
    return (
      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          <Alert severity="info">No accounts found for this customer</Alert>
        </CardContent>
      </Card>
    );
  }

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
            Accounts ({accounts.length})
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
                {canViewBalances && <TableCell align="right" sx={{ fontWeight: 400 }}>Balance</TableCell>}
                {canViewBalances && <TableCell align="center" sx={{ fontWeight: 400 }}>Interest Rate</TableCell>}
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
                  </TableRow>
                );
              })}
              {paginatedAccounts.length > 0 && canViewBalances && (
                <TableRow sx={{ backgroundColor: theme.palette.action.hover }}>
                  <TableCell colSpan={4}>
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
  );
}
