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
  CreditCard,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  PersonAdd,
  Stars
} from '@mui/icons-material';
import { useDateFormatter } from '@/lib/dateFormatters';

interface AccountDetailCreditCardProps {
  accountId?: string;
  onBack?: () => void;
  params?: Record<string, string>;
}

const mockAccount = {
  accountId: 44567,
  accountNumber: '****6289',
  accountType: 'credit_card',
  productName: 'Platinum Rewards Card',
  productCode: 'CC-PLAT-001',
  jackHenryId: 'JH-667890',
  status: 'active',
  currentBalance: 3245.67,
  availableCredit: 11754.33,
  creditLimit: 15000.00,
  minimumPayment: 65.00,
  aprPurchase: 0.1899,
  aprCashAdvance: 0.2499,
  annualFee: 95.00,
  paymentDueDate: '2025-01-15',
  lastPayment: '2024-12-10',
  lastPaymentAmount: 250.00,
  rewardPoints: 45230,
  openedDate: '2020-08-10',
  productStatementDesc: 'PLATINUM REWARDS VISA CARD'
};

const mockAuthorizedUsers = [
  { name: 'Jane Smith', cardNumber: '****8901', status: 'active', addedDate: '2021-03-15' },
  { name: 'Robert Smith', cardNumber: '****2345', status: 'active', addedDate: '2022-06-20' }
];

const mockRewardsSummary = [
  { category: 'Dining', multiplier: '3x', earned: 12500 },
  { category: 'Travel', multiplier: '2x', earned: 8700 },
  { category: 'Gas', multiplier: '2x', earned: 5400 },
  { category: 'Everything Else', multiplier: '1x', earned: 18630 }
];

const mockTransactions = [
  { date: '2024-12-10', description: 'Payment - Thank You', type: 'Payment', amount: 250.00 },
  { date: '2024-12-09', description: 'The Capital Grille', type: 'Dining', amount: -187.50 },
  { date: '2024-12-08', description: 'Delta Airlines', type: 'Travel', amount: -425.00 },
  { date: '2024-12-07', description: 'Shell Gas Station', type: 'Gas', amount: -52.30 },
  { date: '2024-12-05', description: 'Amazon.com', type: 'Purchase', amount: -89.99 }
];

const mockBalanceHistory = [
  { month: 'Jan', balance: 2800 },
  { month: 'Feb', balance: 3100 },
  { month: 'Mar', balance: 2500 },
  { month: 'Apr', balance: 3400 },
  { month: 'May', balance: 4200 },
  { month: 'Jun', balance: 3800 },
  { month: 'Jul', balance: 3200 },
  { month: 'Aug', balance: 2900 },
  { month: 'Sep', balance: 3600 },
  { month: 'Oct', balance: 3100 },
  { month: 'Nov', balance: 3500 },
  { month: 'Dec', balance: 3245 }
];

export default function AccountDetailCreditCard({ accountId, onBack, params }: AccountDetailCreditCardProps) {
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

      <Card elevation={3} sx={{ mb: 3, bgcolor: theme.palette.primary.main, color: 'white' }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', mb: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <CreditCard sx={{ fontSize: 48 }} />
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
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>AVAILABLE CREDIT</Typography>
                <Typography variant="h4" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                  {formatCurrency(mockAccount.availableCredit)}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', p: 2, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>CREDIT LIMIT</Typography>
                <Typography variant="h4" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                  {formatCurrency(mockAccount.creditLimit)}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', p: 2, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>MINIMUM PAYMENT DUE</Typography>
                <Typography variant="h4" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                  {formatCurrency(mockAccount.minimumPayment)}
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
                  <Typography variant="body2" color="text.secondary">APR (Purchase)</Typography>
                  <Typography variant="body1">{formatPercentage(mockAccount.aprPurchase)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">APR (Cash Advance)</Typography>
                  <Typography variant="body1">{formatPercentage(mockAccount.aprCashAdvance)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Annual Fee</Typography>
                  <Typography variant="body1">{formatCurrency(mockAccount.annualFee)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Payment Due Date</Typography>
                  <Typography variant="body1">{formatDate(mockAccount.paymentDueDate)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Last Payment</Typography>
                  <Typography variant="body1">{formatDate(mockAccount.lastPayment)} ({formatCurrency(mockAccount.lastPaymentAmount)})</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Reward Points</Typography>
                  <Typography variant="body1">{mockAccount.rewardPoints.toLocaleString()}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Product Code</Typography>
                  <Typography variant="body1">{mockAccount.productCode}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Product Statement Desc</Typography>
                  <Typography variant="body1">{mockAccount.productStatementDesc}</Typography>
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
                <PersonAdd color="primary" />
                Authorized Users ({mockAuthorizedUsers.length})
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {mockAuthorizedUsers.map((user, index) => (
                <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                  <Box>
                    <Typography variant="body1" fontWeight={500}>
                      {user.name} - Card {user.cardNumber}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Added: {formatDate(user.addedDate)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label={user.status.toUpperCase()} color="success" size="small" />
                    <Button size="small" variant="outlined">Manage</Button>
                  </Box>
                </Box>
              ))}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={2}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Stars color="primary" />
                Rewards Summary
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body1" fontWeight={500}>Total Reward Points</Typography>
                  <Typography variant="h5" fontWeight={500} color="primary">{mockAccount.rewardPoints.toLocaleString()}</Typography>
                </Box>
                <Typography variant="body2" color="text.secondary">
                  Estimated Value: {formatCurrency(mockAccount.rewardPoints * 0.01)}
                </Typography>
              </Box>
              {mockRewardsSummary.map((reward, index) => (
                <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 1 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1">{reward.category}</Typography>
                    <Chip label={reward.multiplier} size="small" variant="outlined" />
                  </Box>
                  <Typography variant="body2" fontWeight={500}>{reward.earned.toLocaleString()} pts</Typography>
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
          OPTION 1: Executive Summary Layout | Credit Card | A/B Testing Mockup
        </Typography>
      </Box>
    </Box>
  );
}
