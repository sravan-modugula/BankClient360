import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip, 
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  TextField,
  InputAdornment,
  Pagination,
  CircularProgress,
  Alert
} from '@mui/material';
import { 
  AccountBalance,
  LocalAtm,
  CalendarToday,
  PhoneAndroid,
  SwapHoriz,
  FlashOn,
  AccountBalanceWallet,
  ShoppingCart,
  TrendingUp,
  Receipt,
  Search,
  History
} from '@mui/icons-material';
import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDateFormatter } from '@/lib/dateFormatters';

interface Transaction {
  transactionId: string;
  accountId: number;
  amount: string;
  transactionCode: string;
  transactionType: string;
  status: string;
  transactionDate: string;
  postingDate: string | null;
  description: string;
  referenceNumber: string | null;
  merchantName: string | null;
  merchantCategoryCode: string | null;
  categoryId: number | null;
  ledgerBalanceAfter: string | null;
  availableBalanceAfter: string | null;
  transferGroupId: string | null;
  sourceSystem: string | null;
  accountNumber?: string;
  accountType?: string;
}

interface TransactionHistoryProps {
  customerId?: number;
  accountId?: number;
  showFilters?: boolean;
  selectedAccountId?: number | null;
  selectedAccountLabel?: string;
}

export default function TransactionHistory({ 
  customerId, 
  accountId,
  showFilters = true,
  selectedAccountId = null,
  selectedAccountLabel = 'All Accounts'
}: TransactionHistoryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;
  
  // Use selectedAccountId from props if provided, otherwise use accountId from props
  const effectiveAccountId = selectedAccountId !== null ? selectedAccountId : accountId;
  
  // Use consistent PST date formatting
  const { formatCurrency, formatDate, formatTime } = useDateFormatter();

  // Fetch transactions from API
  // If selectedAccountId is provided, use account-specific endpoint
  // Otherwise, use customer-level endpoint
  const { data, isLoading, error} = useQuery({
    queryKey: effectiveAccountId
      ? [`/api/accounts/${effectiveAccountId}/transactions`]
      : customerId 
      ? [`/api/customers/${customerId}/transactions`]
      : ['/api/transactions?limit=200'],
    enabled: !!customerId || !!effectiveAccountId || (!customerId && !effectiveAccountId),
    staleTime: 30000, // Cache for 30 seconds
    refetchOnWindowFocus: false
  });

  const transactions = data?.transactions || [];

  // Get transaction icon based on transaction code
  const getTransactionIcon = (code: string) => {
    const iconStyle = { color: '#1b4d20', fontSize: 28 }; // Green theme color
    
    switch (code) {
      case 'DD':
        return <AccountBalance sx={iconStyle} />;
      case 'ATM':
        return <LocalAtm sx={iconStyle} />;
      case 'BILLPAY':
        return <CalendarToday sx={iconStyle} />;
      case 'MOBDEP':
        return <PhoneAndroid sx={iconStyle} />;
      case 'ZELLE':
        return <SwapHoriz sx={iconStyle} />;
      case 'WIRE':
        return <FlashOn sx={iconStyle} />;
      case 'ACH':
        return <AccountBalanceWallet sx={iconStyle} />;
      case 'POS':
        return <ShoppingCart sx={iconStyle} />;
      case 'INT':
        return <TrendingUp sx={iconStyle} />;
      case 'FEE':
        return <Receipt sx={iconStyle} />;
      default:
        return <History sx={iconStyle} />;
    }
  };

  // Get transaction type label
  const getTransactionTypeLabel = (code: string) => {
    const labels: { [key: string]: string } = {
      'DD': 'Direct Deposit',
      'ATM': 'ATM Withdrawal',
      'BILLPAY': 'Bill Payment',
      'MOBDEP': 'Mobile Deposit',
      'ZELLE': 'Zelle Transfer',
      'WIRE': 'Wire Transfer',
      'ACH': 'ACH Transfer',
      'POS': 'Point of Sale',
      'INT': 'Interest Credit',
      'FEE': 'Bank Fee'
    };
    return labels[code] || code;
  };

  // Filter transactions based on search
  const filteredTransactions = transactions.filter((transaction: Transaction) =>
    (transaction.description && transaction.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (transaction.merchantName && transaction.merchantName.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (transaction.referenceNumber && transaction.referenceNumber.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  // Paginate transactions
  const paginatedTransactions = filteredTransactions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage);

  // Calculate totals for quick stats
  const totals = filteredTransactions.reduce((acc: any, trans: Transaction) => {
    const amount = parseFloat(trans.amount);
    if (amount > 0) {
      acc.credits += amount;
    } else {
      acc.debits += Math.abs(amount);
    }
    return acc;
  }, { credits: 0, debits: 0 });

  if (isLoading) {
    return (
      <Card elevation={2}>
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
      ? 'Access restricted: Level 1 users cannot view transaction information for employee customers.'
      : 'Failed to load transactions';
    
    return (
      <Card elevation={2}>
        <CardContent>
          <Alert severity={is403 ? "warning" : "error"}>{errorMessage}</Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card elevation={2}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Box>
            <Typography variant="h5" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <History sx={{ color: '#1b4d20' }} />
              Transaction History
            </Typography>
            {selectedAccountId !== null && selectedAccountLabel !== 'All Accounts' && (
              <Typography variant="body2" color="text.secondary" sx={{ ml: 5, mt: 0.5 }}>
                Showing transactions for: <Chip label={selectedAccountLabel} size="small" color="primary" sx={{ ml: 1 }} />
              </Typography>
            )}
          </Box>
        </Box>

        {/* Quick Stats Bar */}
        <Box sx={{ 
          display: 'flex', 
          gap: 3, 
          mb: 3, 
          pb: 2, 
          borderBottom: '1px solid #e0e0e0',
          flexWrap: 'wrap'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountBalance sx={{ color: '#1b4d20', fontSize: 20 }} />
            <Typography variant="body2" color="text.secondary">
              Deposits: <strong>{formatCurrency(totals.credits)}</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ShoppingCart sx={{ color: '#1b4d20', fontSize: 20 }} />
            <Typography variant="body2" color="text.secondary">
              Spending: <strong>{formatCurrency(totals.debits)}</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Net: <strong style={{ color: totals.credits - totals.debits >= 0 ? '#1b4d20' : '#000' }}>
                {totals.credits - totals.debits >= 0 ? '+' : '-'}{formatCurrency(Math.abs(totals.credits - totals.debits))}
              </strong>
            </Typography>
          </Box>
        </Box>

        {showFilters && (
          <Box sx={{ mb: 3 }}>
            <TextField
              size="small"
              placeholder="Search transactions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              data-testid="input-transaction-search"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search color="action" />
                  </InputAdornment>
                )
              }}
              sx={{ minWidth: 300 }}
            />
          </Box>
        )}

        <TableContainer component={Paper} sx={{ borderLeft: 'none', borderRight: 'none' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell width="50"></TableCell>
                <TableCell>Date/Time</TableCell>
                <TableCell>Transaction Details</TableCell>
                <TableCell align="right">Amount</TableCell>
                <TableCell align="right">Balance</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedTransactions.map((transaction: Transaction) => {
                const amount = parseFloat(transaction.amount);
                const isCredit = amount > 0;
                
                return (
                  <TableRow 
                    key={transaction.transactionId}
                    hover
                    data-testid={`transaction-${transaction.transactionId}`}
                  >
                    <TableCell>
                      {getTransactionIcon(transaction.transactionCode)}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" fontWeight="400">
                        {formatDate(transaction.transactionDate)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatTime(transaction.transactionDate)}
                      </Typography>
                      {transaction.postingDate && transaction.postingDate !== transaction.transactionDate.split('T')[0] && (
                        <Typography variant="caption" display="block" color="text.secondary">
                          Posted: {formatDate(transaction.postingDate)}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Box>
                        <Typography variant="body2" fontWeight="400">
                          {transaction.description}
                        </Typography>
                        {transaction.merchantName && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            {transaction.merchantName}
                          </Typography>
                        )}
                        <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                          {getTransactionTypeLabel(transaction.transactionCode)}
                        </Typography>
                        {transaction.referenceNumber && (
                          <Typography variant="caption" color="text.secondary" display="block">
                            Ref: {transaction.referenceNumber}
                          </Typography>
                        )}
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Box>
                        <Typography 
                          variant="body2" 
                          fontWeight="400"
                          data-testid={`amount-${transaction.transactionId}`}
                        >
                          {isCredit ? '+' : '-'}{formatCurrency(amount)}
                        </Typography>
                        <Chip 
                          label={transaction.transactionCode}
                          size="small"
                          sx={{ 
                            mt: 0.5, 
                            fontSize: '0.7rem',
                            height: 20,
                            backgroundColor: '#f5f5f5',
                            color: '#666'
                          }}
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="body2" data-testid={`balance-${transaction.transactionId}`}>
                        {transaction.ledgerBalanceAfter ? formatCurrency(transaction.ledgerBalanceAfter) : 'N/A'}
                      </Typography>
                      {transaction.availableBalanceAfter && 
                       transaction.availableBalanceAfter !== transaction.ledgerBalanceAfter && (
                        <Typography variant="caption" color="text.secondary" display="block">
                          Available: {formatCurrency(transaction.availableBalanceAfter)}
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>

        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <Pagination
              count={totalPages}
              page={currentPage}
              onChange={(_, page) => setCurrentPage(page)}
              color="primary"
              data-testid="pagination-transactions"
            />
          </Box>
        )}

        <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
          Showing {paginatedTransactions.length} of {filteredTransactions.length} transactions
        </Typography>
      </CardContent>
    </Card>
  );
}