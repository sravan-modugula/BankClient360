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
  useTheme,
  LinearProgress
} from '@mui/material';
import {
  ArrowBack,
  Print,
  Download,
  Home,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  AccountBalance
} from '@mui/icons-material';
import { useDateFormatter } from '@/lib/dateFormatters';

interface AccountDetailMortgageProps {
  accountId?: string;
  onBack?: () => void;
  params?: Record<string, string>;
}

const mockAccount = {
  accountId: 55678,
  accountNumber: '****2847',
  accountType: 'mortgage',
  productName: '30-Year Fixed Mortgage',
  productCode: 'MTG-30F-001',
  jackHenryId: 'JH-778901',
  status: 'active',
  originalAmount: 325000.00,
  outstandingBalance: 287432.15,
  interestRate: 0.0625,
  monthlyPayment: 2001.57,
  escrowBalance: 485.33,
  openedDate: '2021-09-01',
  maturityDate: '2051-09-01',
  nextPaymentDue: '2025-01-01',
  propertyAddress: '123 Oak Street, Springfield, IL 62701',
  ltvRatio: 0.82,
  pmiStatus: 'Active',
  term: '30 Year Fixed',
  productStatementDesc: '30-YEAR FIXED RATE MORTGAGE'
};

const mockEscrowDetails = [
  { item: 'Property Tax', annualAmount: 4200.00, monthlyAmount: 350.00, nextDue: '2025-06-01' },
  { item: 'Homeowners Insurance', annualAmount: 1620.00, monthlyAmount: 135.00, nextDue: '2025-09-01' }
];

const mockOwnership = [
  { name: 'John Smith', role: 'Primary Borrower', percentage: 100, signingAuthority: true }
];

const mockPayments = [
  { date: '2024-12-01', description: 'Monthly Payment', type: 'Payment', amount: -2001.57 },
  { date: '2024-11-01', description: 'Monthly Payment', type: 'Payment', amount: -2001.57 },
  { date: '2024-10-01', description: 'Monthly Payment', type: 'Payment', amount: -2001.57 },
  { date: '2024-09-01', description: 'Monthly Payment', type: 'Payment', amount: -2001.57 },
  { date: '2024-08-15', description: 'Additional Principal Payment', type: 'Extra Payment', amount: -5000.00 }
];

const mockAmortization = [
  { year: 'Yr 1', principal: 4800, interest: 19220 },
  { year: 'Yr 2', principal: 5100, interest: 18920 },
  { year: 'Yr 3', principal: 5420, interest: 18600 },
  { year: 'Yr 4', principal: 5760, interest: 18260 },
  { year: 'Yr 5', principal: 6120, interest: 17900 },
  { year: 'Yr 6', principal: 6500, interest: 17520 },
  { year: 'Yr 7', principal: 6900, interest: 17120 },
  { year: 'Yr 8', principal: 7330, interest: 16690 },
  { year: 'Yr 9', principal: 7780, interest: 16240 },
  { year: 'Yr 10', principal: 8260, interest: 15760 }
];

export default function AccountDetailMortgage({ accountId, onBack, params }: AccountDetailMortgageProps) {
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

  const principalPaid = mockAccount.originalAmount - mockAccount.outstandingBalance;
  const principalPaidPercent = (principalPaid / mockAccount.originalAmount) * 100;
  const maxAmortValue = Math.max(...mockAmortization.map(a => a.principal + a.interest));

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
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>OUTSTANDING BALANCE</Typography>
                <Typography variant="h4" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                  {formatCurrency(mockAccount.outstandingBalance)}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', p: 2, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>MONTHLY PAYMENT</Typography>
                <Typography variant="h4" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                  {formatCurrency(mockAccount.monthlyPayment)}
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
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', p: 2, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>ESCROW BALANCE</Typography>
                <Typography variant="h4" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                  {formatCurrency(mockAccount.escrowBalance)}
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
                  <Typography variant="body2" color="text.secondary">Loan Amount (Original)</Typography>
                  <Typography variant="body1">{formatCurrency(mockAccount.originalAmount)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Term</Typography>
                  <Typography variant="body1">{mockAccount.term}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Opened</Typography>
                  <Typography variant="body1">{formatDate(mockAccount.openedDate)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Maturity Date</Typography>
                  <Typography variant="body1">{formatDate(mockAccount.maturityDate)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Next Payment Due</Typography>
                  <Typography variant="body1">{formatDate(mockAccount.nextPaymentDue)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Property Address</Typography>
                  <Typography variant="body1">{mockAccount.propertyAddress}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">LTV Ratio</Typography>
                  <Typography variant="body1">{formatPercentage(mockAccount.ltvRatio)}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">PMI Status</Typography>
                  <Typography variant="body1">{mockAccount.pmiStatus}</Typography>
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
                Amortization Progress
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Principal Paid: {formatCurrency(principalPaid)}</Typography>
                  <Typography variant="body2" color="text.secondary">{principalPaidPercent.toFixed(1)}%</Typography>
                </Box>
                <LinearProgress variant="determinate" value={principalPaidPercent} sx={{ height: 10, borderRadius: 5 }} />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1 }}>
                  <Typography variant="caption" color="text.secondary">Remaining: {formatCurrency(mockAccount.outstandingBalance)}</Typography>
                  <Typography variant="caption" color="text.secondary">Original: {formatCurrency(mockAccount.originalAmount)}</Typography>
                </Box>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>Principal vs Interest by Year</Typography>
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 100 }}>
                {mockAmortization.map((item, index) => (
                  <Box key={item.year} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                      <Box
                        sx={{
                          width: '100%',
                          height: `${(item.interest / maxAmortValue) * 60}px`,
                          bgcolor: 'error.light',
                          borderRadius: '4px 4px 0 0',
                        }}
                      />
                      <Box
                        sx={{
                          width: '100%',
                          height: `${(item.principal / maxAmortValue) * 60}px`,
                          bgcolor: 'success.main',
                        }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, fontSize: '8px' }}>
                      {item.year}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 2, mt: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 12, height: 12, bgcolor: 'success.main', borderRadius: 1 }} />
                  <Typography variant="caption" color="text.secondary">Principal</Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                  <Box sx={{ width: 12, height: 12, bgcolor: 'error.light', borderRadius: 1 }} />
                  <Typography variant="caption" color="text.secondary">Interest</Typography>
                </Box>
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
                <AccountBalance color="primary" />
                Escrow Details
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ p: 2, bgcolor: 'action.hover', borderRadius: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="body1" fontWeight={500}>Current Escrow Balance</Typography>
                  <Typography variant="h6" fontWeight={500} color="primary">{formatCurrency(mockAccount.escrowBalance)}</Typography>
                </Box>
              </Box>
              {mockEscrowDetails.map((item, index) => (
                <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                  <Box>
                    <Typography variant="body1" fontWeight={500}>
                      {item.item}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      Annual: {formatCurrency(item.annualAmount)} | Monthly: {formatCurrency(item.monthlyAmount)}
                    </Typography>
                  </Box>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="body2" color="text.secondary">Next Due</Typography>
                    <Typography variant="body2">{formatDate(item.nextDue)}</Typography>
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
            <Typography variant="h6">Recent Payments</Typography>
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
                {mockPayments.map((tx, index) => (
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
          OPTION 1: Executive Summary Layout | Mortgage | A/B Testing Mockup
        </Typography>
      </Box>
    </Box>
  );
}
