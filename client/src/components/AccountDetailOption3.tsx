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
  useTheme
} from '@mui/material';
import {
  ArrowBack,
  Home,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Search,
  FilterList,
  Business
} from '@mui/icons-material';
import { useDateFormatter } from '@/lib/dateFormatters';

interface AccountDetailOption3Props {
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
  jackHenryId: '789456123',
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
  statementCycle: '15th Monthly',
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

const mockSicCodes = [
  { code: '5411', description: 'Grocery Stores', effective: 'Mar 2020' },
  { code: '5812', description: 'Eating Places', effective: 'Jan 2022' }
];

const mockTransactions = [
  { date: '2024-12-10', description: 'Amazon.com', category: 'Shopping', amount: -45.99 },
  { date: '2024-12-09', description: 'ACME Corp', category: 'Payroll', amount: 2500.00 },
  { date: '2024-12-08', description: 'City Electric Co', category: 'Utilities', amount: -125.00 },
  { date: '2024-12-07', description: 'ATM Withdrawal #4521', category: 'Cash', amount: -200.00 },
  { date: '2024-12-05', description: 'Transfer from Savings', category: 'Transfer', amount: 500.00 },
  { date: '2024-12-04', description: 'Netflix Subscription', category: 'Entertainment', amount: -15.99 },
  { date: '2024-12-03', description: 'Gas Station', category: 'Auto', amount: -52.30 },
  { date: '2024-12-02', description: 'Grocery Mart', category: 'Groceries', amount: -127.45 }
];

export default function AccountDetailOption3({ accountId, onBack, params }: AccountDetailOption3Props) {
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

  return (
    <Box sx={{ p: 3, maxWidth: 1400, margin: '0 auto' }}>
      <Button
        startIcon={<ArrowBack />}
        onClick={handleBack}
        variant="text"
        sx={{ mb: 2 }}
        data-testid="btn-back"
      >
        Back to Customer
      </Button>

      <Card elevation={1} sx={{ mb: 3, bgcolor: 'background.paper' }}>
        <CardContent sx={{ py: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Home sx={{ fontSize: 32, color: 'primary.main' }} />
            <Box sx={{ flex: 1 }}>
              <Typography variant="h5" fontWeight={500}>
                {mockAccount.productName}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {mockAccount.accountNumber} | {mockAccount.status.charAt(0).toUpperCase() + mockAccount.status.slice(1)} | 
                Opened {formatDate(mockAccount.openedDate)} | {mockAccount.branch}
              </Typography>
            </Box>
            <Chip 
              label={mockAccount.status.toUpperCase()} 
              color="success"
            />
          </Box>
        </CardContent>
      </Card>

      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="overline" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
            BALANCES
          </Typography>
          <Grid container spacing={4}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Current Balance</Typography>
              <Typography variant="h4" color="primary" sx={{ fontFamily: 'Roboto Mono', fontWeight: 500 }}>
                {formatCurrency(mockAccount.currentBalance)}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Available Balance</Typography>
              <Typography variant="h4" sx={{ fontFamily: 'Roboto Mono', fontWeight: 500 }}>
                {formatCurrency(mockAccount.availableBalance)}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Pending</Typography>
              <Typography variant="h4" sx={{ fontFamily: 'Roboto Mono', fontWeight: 500 }}>
                {formatCurrency(mockAccount.pendingBalance)}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box>
                <Typography variant="body2" color="text.secondary">Interest Rate</Typography>
                <Typography variant="h4" sx={{ fontWeight: 500 }}>
                  {formatPercentage(mockAccount.interestRate)} <Typography component="span" variant="body2" color="text.secondary">APY</Typography>
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                YTD Interest Earned: {formatCurrency(mockAccount.ytdInterest)}
              </Typography>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={2} sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
                DEBIT CARDS
              </Typography>
              {mockDebitCards.map((card, index) => (
                <Box key={index} sx={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  p: 2, 
                  mb: 1,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 2
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    <CreditCard color="primary" />
                    <Box>
                      <Typography variant="body1" fontWeight={500}>
                        {card.brand} {card.cardNumber}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Exp: {card.expiry} | Limit: {formatCurrency(card.dailyLimit)}/day
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label={card.status.toUpperCase()} color="success" size="small" />
                    <Button size="small" variant="text">Manage</Button>
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={2} sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="overline" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
                ACCOUNT DETAILS
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Product</Typography>
                  <Typography variant="body1">{mockAccount.productCode}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">JH ID</Typography>
                  <Typography variant="body1">{mockAccount.jackHenryId}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Opened</Typography>
                  <Typography variant="body1">{formatDate(mockAccount.openedDate)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Statement</Typography>
                  <Typography variant="body1">{mockAccount.statementCycle}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Avg Balance</Typography>
                  <Typography variant="body1">{formatCurrency(mockAccount.averageBalance)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Last Active</Typography>
                  <Typography variant="body1">{formatDate(mockAccount.lastActivity)}</Typography>
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Divider sx={{ my: 1 }} />
                  <Typography variant="body2" color="text.secondary">Branch</Typography>
                  <Typography variant="body1">{mockAccount.branch}</Typography>
                  <Typography variant="body2" color="primary">{mockAccount.branchPhone}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card elevation={2} sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="overline" color="text.secondary">
              TRANSACTIONS
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <ToggleButtonGroup
                value={txFilter}
                exclusive
                onChange={(e, val) => val && setTxFilter(val)}
                size="small"
              >
                <ToggleButton value="all">All</ToggleButton>
                <ToggleButton value="deposits">Deposits</ToggleButton>
                <ToggleButton value="withdrawals">Withdrawals</ToggleButton>
                <ToggleButton value="transfers">Transfers</ToggleButton>
              </ToggleButtonGroup>
              <TextField
                placeholder="Search..."
                size="small"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  )
                }}
                sx={{ width: 200 }}
              />
              <Button startIcon={<FilterList />} variant="outlined" size="small">
                Filter
              </Button>
            </Box>
          </Box>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 500 }}>DATE</TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>DESCRIPTION</TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>CATEGORY</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 500 }}>AMOUNT</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredTransactions.map((tx, index) => (
                  <TableRow key={index} hover>
                    <TableCell>{formatDate(tx.date)}</TableCell>
                    <TableCell>{tx.description}</TableCell>
                    <TableCell>
                      <Chip label={tx.category} size="small" variant="outlined" />
                    </TableCell>
                    <TableCell align="right">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 0.5 }}>
                        {tx.amount > 0 ? (
                          <TrendingUp sx={{ fontSize: 16, color: 'success.main' }} />
                        ) : (
                          <TrendingDown sx={{ fontSize: 16, color: 'error.main' }} />
                        )}
                        <Typography
                          variant="body2"
                          sx={{
                            fontFamily: 'Roboto Mono',
                            color: tx.amount > 0 ? 'success.main' : 'error.main',
                            fontWeight: 500
                          }}
                        >
                          {tx.amount > 0 ? '+' : ''}{formatCurrency(tx.amount)}
                        </Typography>
                      </Box>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button variant="outlined">Load More Transactions</Button>
          </Box>
        </CardContent>
      </Card>

      <Grid container spacing={3}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="overline" color="text.secondary" gutterBottom sx={{ display: 'block' }}>
                OWNERSHIP
              </Typography>
              <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                <Typography variant="subtitle1" fontWeight={500}>
                  Primary Owner
                </Typography>
                <Typography variant="h6">{mockOwnership.name}</Typography>
                <Divider sx={{ my: 1 }} />
                <Grid container spacing={1}>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="body2" color="text.secondary">Ownership</Typography>
                    <Typography variant="body1">{mockOwnership.percentage}%</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="body2" color="text.secondary">Signing Authority</Typography>
                    <Typography variant="body1">{mockOwnership.signingAuthority ? 'Yes' : 'No'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="body2" color="text.secondary">Can View Statements</Typography>
                    <Typography variant="body1">{mockOwnership.canViewStatements ? 'Yes' : 'No'}</Typography>
                  </Grid>
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="body2" color="text.secondary">Can Transact</Typography>
                    <Typography variant="body1">{mockOwnership.canTransact ? 'Yes' : 'No'}</Typography>
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="overline" color="text.secondary" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Business fontSize="small" />
                SIC CODES (Business)
              </Typography>
              {mockSicCodes.map((sic, index) => (
                <Box key={index} sx={{ p: 2, mb: 1, border: 1, borderColor: 'divider', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box>
                      <Typography variant="body1" fontWeight={500}>
                        {sic.code} - {sic.description}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Effective: {sic.effective}
                      </Typography>
                    </Box>
                    <Chip label="Active" size="small" color="success" variant="outlined" />
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          OPTION 3: Card-Based Modular Layout | A/B Testing Mockup
        </Typography>
      </Box>
    </Box>
  );
}
