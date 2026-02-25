import { useState } from 'react';
import { useLocation } from 'wouter';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Divider,
  Grid,
  TextField,
  InputAdornment,
  ToggleButtonGroup,
  ToggleButton,
  useTheme,
  IconButton,
  Tooltip
} from '@mui/material';
import {
  ArrowBack,
  Home,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Search,
  FilterList,
  Print,
  Download,
  CheckCircle,
  Schedule,
  AccountBalanceWallet,
  Visibility,
  MoreVert
} from '@mui/icons-material';
import { useDateFormatter } from '@/lib/dateFormatters';

interface AccountDetailOption2Props {
  accountId?: string;
  onBack?: () => void;
  params?: Record<string, string>;
}

const mockAccount = {
  accountId: 12345,
  accountNumber: '****4521',
  fullAccountNumber: '1234567894521',
  accountType: 'checking',
  productName: 'Premium Checking',
  productCode: 'CHK-PREM-001',
  jackHenryId: 'JH-789456',
  status: 'active',
  currentBalance: 5432.18,
  availableBalance: 5200.00,
  pendingBalance: 232.18,
  interestRate: 0.0005,
  ytdInterest: 12.45,
  openedDate: '2018-01-15',
  lastActivity: '2024-12-10',
  branch: 'Main Street #101',
  branchPhone: '(555) 123-4567',
  statementCycle: 'Monthly - 15th',
  averageBalance: 4850.00
};

const mockDebitCards = [
  { cardNumber: '****1234', status: 'active', expiry: '12/26', dailyLimit: 1000, brand: 'VISA' },
  { cardNumber: '****5678', status: 'active', expiry: '08/25', dailyLimit: 500, brand: 'VISA' }
];

const mockOwnership = {
  name: 'John Smith',
  role: 'Primary',
  percentage: 100,
  signingAuthority: true,
  canViewStatements: true,
  canTransact: true
};

const mockTransactions = [
  { date: '2024-12-10', description: 'Amazon.com', category: 'Shopping', amount: -45.99 },
  { date: '2024-12-09', description: 'ACME Corp Payroll', category: 'Payroll', amount: 2500.00 },
  { date: '2024-12-08', description: 'City Electric Co', category: 'Utilities', amount: -125.00 },
  { date: '2024-12-07', description: 'ATM Withdrawal #4521', category: 'Cash', amount: -200.00 },
  { date: '2024-12-05', description: 'Transfer from Savings', category: 'Transfer', amount: 500.00 },
  { date: '2024-12-04', description: 'Netflix Subscription', category: 'Entertainment', amount: -15.99 },
  { date: '2024-12-03', description: 'Gas Station', category: 'Auto', amount: -52.30 },
  { date: '2024-12-02', description: 'Grocery Mart', category: 'Groceries', amount: -127.45 }
];

const mockBalanceHistory = [
  { month: 'Jan', balance: 4200 },
  { month: 'Feb', balance: 4500 },
  { month: 'Mar', balance: 4100 },
  { month: 'Apr', balance: 4800 },
  { month: 'May', balance: 5100 },
  { month: 'Jun', balance: 4900 },
  { month: 'Jul', balance: 5200 },
  { month: 'Aug', balance: 5000 },
  { month: 'Sep', balance: 5300 },
  { month: 'Oct', balance: 5100 },
  { month: 'Nov', balance: 5400 },
  { month: 'Dec', balance: 5432 }
];

export default function AccountDetailOption2({ accountId, onBack, params }: AccountDetailOption2Props) {
  const theme = useTheme();
  const [, setLocation] = useLocation();
  const { formatCurrency, formatDate, formatPercentage } = useDateFormatter();
  const [txFilter, setTxFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      setLocation('/');
    }
  };

  const filteredTransactions = mockTransactions.filter(tx => {
    if (txFilter === 'deposits' && tx.amount < 0) return false;
    if (txFilter === 'withdrawals' && tx.amount > 0) return false;
    if (txFilter === 'transfers' && tx.category !== 'Transfer') return false;
    if (searchQuery && !tx.description.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const maxBalance = Math.max(...mockBalanceHistory.map(b => b.balance));

  return (
    <Box sx={{ p: 3, maxWidth: 1400, margin: '0 auto' }}>
      {/* Top Navigation Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={handleBack}
          variant="text"
          data-testid="btn-back"
        >
          BACK TO CLIENT
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<Print />} variant="outlined" size="small">Print</Button>
          <Button startIcon={<Download />} variant="outlined" size="small">Export</Button>
        </Box>
      </Box>

      {/* Executive Summary Hero Card */}
      <Card elevation={3} sx={{ mb: 3, bgcolor: theme.palette.primary.main, color: 'white' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Home sx={{ fontSize: 48 }} />
              <Box>
                <Typography variant="h4" fontWeight={500}>
                  {mockAccount.productName}
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  Account: {mockAccount.accountNumber} | Product: {mockAccount.productCode} | JH ID: {mockAccount.jackHenryId}
                </Typography>
              </Box>
            </Box>
            <Chip 
              label={mockAccount.status.toUpperCase()} 
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 500 }}
              icon={<CheckCircle sx={{ color: 'white !important' }} />}
            />
          </Box>

          <Grid container spacing={3}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', p: 2, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>CURRENT BALANCE</Typography>
                <Typography variant="h4" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                  {formatCurrency(mockAccount.currentBalance)}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', p: 2, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>AVAILABLE</Typography>
                <Typography variant="h4" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                  {formatCurrency(mockAccount.availableBalance)}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', p: 2, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>PENDING</Typography>
                <Typography variant="h4" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                  {formatCurrency(mockAccount.pendingBalance)}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', p: 2, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>YTD INTEREST</Typography>
                <Typography variant="h4" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                  {formatCurrency(mockAccount.ytdInterest)}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Modular Cards Row */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Account Details Card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card elevation={1} sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <AccountBalanceWallet fontSize="small" color="primary" />
                Account Details
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Account Type</Typography>
                  <Typography variant="body2" fontWeight={500}>{mockAccount.accountType.charAt(0).toUpperCase() + mockAccount.accountType.slice(1)}</Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Branch</Typography>
                  <Typography variant="body2" fontWeight={500}>{mockAccount.branch}</Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Opened</Typography>
                  <Typography variant="body2" fontWeight={500}>{formatDate(mockAccount.openedDate)}</Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Statement Cycle</Typography>
                  <Typography variant="body2" fontWeight={500}>{mockAccount.statementCycle}</Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Interest Rate</Typography>
                  <Typography variant="body2" fontWeight={500}>{formatPercentage(mockAccount.interestRate)}</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Ownership Card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card elevation={1} sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <Visibility fontSize="small" color="primary" />
                Ownership & Access
              </Typography>
              <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body1" fontWeight={500}>{mockOwnership.name}</Typography>
                  <Chip label={mockOwnership.role} size="small" color="primary" />
                </Box>
                <Typography variant="body2" color="text.secondary">
                  {mockOwnership.percentage}% Ownership
                </Typography>
              </Box>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle fontSize="small" color="success" />
                  <Typography variant="body2">Signing Authority</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle fontSize="small" color="success" />
                  <Typography variant="body2">View Statements</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CheckCircle fontSize="small" color="success" />
                  <Typography variant="body2">Transact</Typography>
                </Box>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Debit Cards Card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card elevation={1} sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CreditCard fontSize="small" color="primary" />
                Linked Cards ({mockDebitCards.length})
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {mockDebitCards.map((card, idx) => (
                  <Box 
                    key={idx} 
                    sx={{ 
                      bgcolor: 'action.hover', 
                      p: 2, 
                      borderRadius: 1,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <Box>
                      <Typography variant="body2" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                        {card.brand} {card.cardNumber}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Exp: {card.expiry} | Limit: {formatCurrency(card.dailyLimit)}/day
                      </Typography>
                    </Box>
                    <Chip 
                      label={card.status} 
                      size="small" 
                      color={card.status === 'active' ? 'success' : 'default'}
                    />
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Balance Trend Card */}
      <Card elevation={1} sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUp fontSize="small" color="primary" />
              12-Month Balance Trend
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Avg: {formatCurrency(mockAccount.averageBalance)}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 120 }}>
            {mockBalanceHistory.map((item, idx) => (
              <Tooltip key={idx} title={`${item.month}: ${formatCurrency(item.balance)}`}>
                <Box sx={{ flex: 1, textAlign: 'center' }}>
                  <Box
                    sx={{
                      height: `${(item.balance / maxBalance) * 100}px`,
                      bgcolor: idx === mockBalanceHistory.length - 1 ? 'primary.main' : 'primary.light',
                      borderRadius: '4px 4px 0 0',
                      transition: 'all 0.3s',
                      '&:hover': { bgcolor: 'primary.dark' }
                    }}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '10px' }}>
                    {item.month}
                  </Typography>
                </Box>
              </Tooltip>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Transactions Card with Filtering */}
      <Card elevation={1}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule fontSize="small" color="primary" />
              Recent Transactions
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <TextField
                size="small"
                placeholder="Search transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  )
                }}
                sx={{ minWidth: 200 }}
              />
              <ToggleButtonGroup
                size="small"
                value={txFilter}
                exclusive
                onChange={(_, val) => val && setTxFilter(val)}
              >
                <ToggleButton value="all">All</ToggleButton>
                <ToggleButton value="deposits">Deposits</ToggleButton>
                <ToggleButton value="withdrawals">Withdrawals</ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>

          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Date</TableCell>
                  <TableCell>Description</TableCell>
                  <TableCell>Category</TableCell>
                  <TableCell align="right">Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTransactions.map((tx, idx) => (
                  <TableRow key={idx} hover>
                    <TableCell>{formatDate(tx.date)}</TableCell>
                    <TableCell>{tx.description}</TableCell>
                    <TableCell>
                      <Chip label={tx.category} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Typography
                        variant="body2"
                        sx={{
                          color: tx.amount >= 0 ? 'success.main' : 'text.primary',
                          fontWeight: tx.amount >= 0 ? 600 : 400,
                          fontFamily: 'Roboto Mono',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 0.5
                        }}
                      >
                        {tx.amount >= 0 && <TrendingUp fontSize="small" />}
                        {tx.amount < 0 && <TrendingDown fontSize="small" color="action" />}
                        {formatCurrency(Math.abs(tx.amount))}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button variant="text" size="small">View All Transactions</Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}
