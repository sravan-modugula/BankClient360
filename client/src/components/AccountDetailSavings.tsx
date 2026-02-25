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
  useTheme
} from '@mui/material';
import {
  ArrowBack,
  Print,
  Download,
  Savings,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  SwapHoriz
} from '@mui/icons-material';
import { useDateFormatter } from '@/lib/dateFormatters';

interface AccountDetailSavingsProps {
  accountId?: string;
  onBack?: () => void;
  params?: Record<string, string>;
}

const mockAccount = {
  accountId: 22345,
  accountNumber: '****7832',
  accountType: 'savings',
  productName: 'High Yield Savings',
  productCode: 'SAV-HY-001',
  jackHenryId: 'JH-334567',
  status: 'active',
  currentBalance: 28450.00,
  availableBalance: 28450.00,
  interestRate: 0.0425,
  ytdInterest: 845.12,
  openedDate: '2019-03-22',
  lastActivity: '2024-12-08',
  branch: 'Main Street #101',
  statementCycle: 'Monthly - 1st',
  averageBalance: 26800.00,
  productStatementDesc: 'HIGH YIELD SAVINGS PLUS',
  withdrawalLimit: '6/month'
};

const mockLinkedTransfers = [
  { from: 'Premium Checking ****4521', amount: 500, frequency: 'Bi-Weekly', nextDate: '2024-12-20', status: 'active' },
  { from: 'Payroll Direct Deposit', amount: 200, frequency: 'Monthly', nextDate: '2025-01-01', status: 'active' }
];

const mockOwnership = [
  { name: 'John Smith', role: 'Primary', percentage: 100, signingAuthority: true }
];

const mockTransactions = [
  { date: '2024-12-08', description: 'Transfer from Checking', type: 'Transfer', amount: 500.00 },
  { date: '2024-12-01', description: 'Interest Payment', type: 'Interest', amount: 98.45 },
  { date: '2024-11-22', description: 'Transfer from Checking', type: 'Transfer', amount: 500.00 },
  { date: '2024-11-15', description: 'ATM Withdrawal', type: 'ATM', amount: -200.00 },
  { date: '2024-11-01', description: 'Interest Payment', type: 'Interest', amount: 95.30 }
];

const mockBalanceHistory = [
  { month: 'Jan', balance: 22000 },
  { month: 'Feb', balance: 23100 },
  { month: 'Mar', balance: 23800 },
  { month: 'Apr', balance: 24500 },
  { month: 'May', balance: 25200 },
  { month: 'Jun', balance: 25800 },
  { month: 'Jul', balance: 26300 },
  { month: 'Aug', balance: 26900 },
  { month: 'Sep', balance: 27200 },
  { month: 'Oct', balance: 27600 },
  { month: 'Nov', balance: 28000 },
  { month: 'Dec', balance: 28450 }
];

export default function AccountDetailSavings({ accountId, onBack, params }: AccountDetailSavingsProps) {
  const theme = useTheme();
  const [, setLocation] = useLocation();
  const { formatCurrency, formatDate, formatPercentage } = useDateFormatter();

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      setLocation('/');
    }
  };

  const maxBalance = Math.max(...mockBalanceHistory.map(b => b.balance));

  return (
    <Box sx={{ p: 3, maxWidth: 1400, margin: '0 auto' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={handleBack}
          variant="text"
          data-testid="btn-back"
        >
          Back to Customer Dashboard
        </Button>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<Print />} variant="outlined" size="small">Print</Button>
          <Button startIcon={<Download />} variant="outlined" size="small">Export</Button>
        </Box>
      </Box>

      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: 2, 
        mb: 2, 
        px: 2, 
        py: 1.5, 
        bgcolor: theme.palette.grey[100], 
        borderLeft: `4px solid ${theme.palette.primary.main}`,
        borderRadius: 1
      }}>
        <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', gap: 0.5 }}>
          <strong>Client:</strong> Margaret Thompson
        </Typography>
        <Divider orientation="vertical" flexItem />
        <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', gap: 0.5 }}>
          <strong>CIF:</strong> 100234
        </Typography>
        <Divider orientation="vertical" flexItem />
        <Typography variant="body2" color="text.secondary" sx={{ display: 'flex', gap: 0.5 }}>
          <strong>Household:</strong> Thompson Family Trust
        </Typography>
      </Box>

      <Card elevation={3} sx={{ mb: 3, bgcolor: theme.palette.primary.main, color: 'white' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Savings sx={{ fontSize: 48 }} />
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
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>CURRENT LEDGER BALANCE</Typography>
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
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>APY</Typography>
                <Typography variant="h4" fontWeight={500}>
                  {formatPercentage(mockAccount.interestRate)}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', p: 2, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>YTD INTEREST EARNED</Typography>
                <Typography variant="h4" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                  {formatCurrency(mockAccount.ytdInterest)}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={2} sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                Account Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Opened</Typography>
                  <Typography variant="body1">{formatDate(mockAccount.openedDate)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Branch</Typography>
                  <Typography variant="body1">{mockAccount.branch}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Statement Cycle</Typography>
                  <Typography variant="body1">{mockAccount.statementCycle}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Last Activity</Typography>
                  <Typography variant="body1">{formatDate(mockAccount.lastActivity)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Average Balance</Typography>
                  <Typography variant="body1">{formatCurrency(mockAccount.averageBalance)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">YTD Interest</Typography>
                  <Typography variant="body1">{formatCurrency(mockAccount.ytdInterest)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Product Code</Typography>
                  <Typography variant="body1">{mockAccount.productCode}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Product Statement Desc</Typography>
                  <Typography variant="body1">{mockAccount.productStatementDesc}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Withdrawal Limit</Typography>
                  <Typography variant="body1">{mockAccount.withdrawalLimit}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={2} sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Balance History (12 Months)
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 180 }}>
                {mockBalanceHistory.map((item, index) => (
                  <Box key={item.month} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '9px', mb: 0.5, fontFamily: 'Roboto Mono' }}>
                      {formatCurrency(item.balance)}
                    </Typography>
                    <Box
                      sx={{
                        width: '100%',
                        height: `${(item.balance / maxBalance) * 120}px`,
                        bgcolor: index === mockBalanceHistory.length - 1 ? 'primary.main' : 'primary.light',
                        borderRadius: '4px 4px 0 0',
                        transition: 'all 0.3s'
                      }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
                      {item.month}
                    </Typography>
                  </Box>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <SwapHoriz color="primary" />
                Linked Transfers ({mockLinkedTransfers.length})
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {mockLinkedTransfers.map((transfer, index) => (
                <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                  <Box>
                    <Typography variant="body1" fontWeight={500}>
                      {transfer.from}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatCurrency(transfer.amount)} | {transfer.frequency} | Next: {formatDate(transfer.nextDate)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label={transfer.status.toUpperCase()} color="success" size="small" />
                    <Button size="small" variant="outlined">Edit</Button>
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Account Ownership
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {mockOwnership.map((owner, index) => (
                <Box key={index} sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Typography variant="body1" fontWeight={500}>{owner.name}</Typography>
                    <Chip label={owner.role} color="primary" size="small" />
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Ownership: {owner.percentage}% | Signing Authority: {owner.signingAuthority ? 'Yes' : 'No'}
                  </Typography>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card elevation={2}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6">Recent Transactions</Typography>
            <Button variant="text" endIcon={<ArrowBack sx={{ transform: 'rotate(180deg)' }} />}>
              View All
            </Button>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 500 }}>Date</TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>Description</TableCell>
                  <TableCell sx={{ fontWeight: 500 }}>Type</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 500 }}>Amount</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {mockTransactions.map((tx, index) => (
                  <TableRow key={index} hover>
                    <TableCell>{formatDate(tx.date)}</TableCell>
                    <TableCell>{tx.description}</TableCell>
                    <TableCell>
                      <Chip label={tx.type} size="small" variant="outlined" />
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
                            color: tx.amount > 0 ? 'success.main' : 'error.main'
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
        </CardContent>
      </Card>

      <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2, textAlign: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          OPTION 1: Executive Summary Layout | Savings Account | A/B Testing Mockup
        </Typography>
      </Box>
    </Box>
  );
}
