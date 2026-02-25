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
  HomeWork,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  CallMade
} from '@mui/icons-material';
import { useDateFormatter } from '@/lib/dateFormatters';

interface AccountDetailHELOCProps {
  accountId?: string;
  onBack?: () => void;
  params?: Record<string, string>;
}

const mockAccount = {
  accountId: 66789,
  accountNumber: '****3156',
  accountType: 'heloc',
  productName: 'Home Equity Line of Credit',
  productCode: 'HELOC-VAR-001',
  jackHenryId: 'JH-889012',
  status: 'active',
  outstandingBalance: 45000.00,
  availableCredit: 55000.00,
  creditLimit: 100000.00,
  interestRate: 0.0750,
  monthlyPayment: 375.00,
  openedDate: '2022-01-10',
  drawPeriodEnd: '2032-01-10',
  repaymentPeriodEnd: '2042-01-10',
  nextPaymentDue: '2025-01-01',
  ltvRatio: 0.72,
  collateralProperty: '123 Oak Street, Springfield, IL 62701',
  productStatementDesc: 'HOME EQUITY LINE OF CREDIT VARIABLE'
};

const mockDrawActivity = [
  { date: '2024-11-15', description: 'Draw - Kitchen Renovation', amount: 12000.00, method: 'Check' },
  { date: '2024-08-20', description: 'Draw - Roof Repair', amount: 8500.00, method: 'Wire Transfer' },
  { date: '2024-03-10', description: 'Draw - Landscaping', amount: 5000.00, method: 'Online Transfer' }
];

const mockOwnership = [
  { name: 'John Smith', role: 'Primary Borrower', percentage: 100, signingAuthority: true }
];

const mockTransactions = [
  { date: '2024-12-01', description: 'Monthly Interest Payment', type: 'Payment', amount: -375.00 },
  { date: '2024-11-15', description: 'Draw - Kitchen Renovation', type: 'Draw', amount: 12000.00 },
  { date: '2024-11-01', description: 'Monthly Interest Payment', type: 'Payment', amount: -340.00 },
  { date: '2024-10-01', description: 'Monthly Interest Payment', type: 'Payment', amount: -340.00 },
  { date: '2024-08-20', description: 'Draw - Roof Repair', type: 'Draw', amount: 8500.00 }
];

const mockBalanceHistory = [
  { month: 'Jan', balance: 20000 },
  { month: 'Feb', balance: 20000 },
  { month: 'Mar', balance: 25000 },
  { month: 'Apr', balance: 25000 },
  { month: 'May', balance: 25000 },
  { month: 'Jun', balance: 24500 },
  { month: 'Jul', balance: 24000 },
  { month: 'Aug', balance: 32500 },
  { month: 'Sep', balance: 32000 },
  { month: 'Oct', balance: 33000 },
  { month: 'Nov', balance: 45000 },
  { month: 'Dec', balance: 45000 }
];

export default function AccountDetailHELOC({ accountId, onBack, params }: AccountDetailHELOCProps) {
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
              <HomeWork sx={{ fontSize: 48 }} />
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
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>OUTSTANDING BALANCE</Typography>
                <Typography variant="h4" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                  {formatCurrency(mockAccount.outstandingBalance)}
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
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>INTEREST RATE</Typography>
                <Typography variant="h4" fontWeight={500}>
                  {formatPercentage(mockAccount.interestRate)}
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
                  <Typography variant="body2" color="text.secondary">Draw Period End</Typography>
                  <Typography variant="body1">{formatDate(mockAccount.drawPeriodEnd)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Repayment Period End</Typography>
                  <Typography variant="body1">{formatDate(mockAccount.repaymentPeriodEnd)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Opened</Typography>
                  <Typography variant="body1">{formatDate(mockAccount.openedDate)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Next Payment Due</Typography>
                  <Typography variant="body1">{formatDate(mockAccount.nextPaymentDue)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Monthly Payment</Typography>
                  <Typography variant="body1">{formatCurrency(mockAccount.monthlyPayment)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">LTV</Typography>
                  <Typography variant="body1">{formatPercentage(mockAccount.ltvRatio)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Collateral Property</Typography>
                  <Typography variant="body1">{mockAccount.collateralProperty}</Typography>
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
                Draw History (12 Months)
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
                <CallMade color="primary" />
                Draw Activity ({mockDrawActivity.length})
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {mockDrawActivity.map((draw, index) => (
                <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                  <Box>
                    <Typography variant="body1" fontWeight={500}>
                      {draw.description}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {formatDate(draw.date)} | Method: {draw.method}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="body1" fontWeight={500} color="primary">
                      {formatCurrency(draw.amount)}
                    </Typography>
                    <Button size="small" variant="outlined">Details</Button>
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
          OPTION 1: Executive Summary Layout | HELOC | A/B Testing Mockup
        </Typography>
      </Box>
    </Box>
  );
}
