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
  Lock,
  TrendingUp,
  TrendingDown,
  CheckCircle,
  Autorenew,
  AccountBalance
} from '@mui/icons-material';
import { useDateFormatter } from '@/lib/dateFormatters';

interface AccountDetailCDProps {
  accountId?: string;
  onBack?: () => void;
  params?: Record<string, string>;
}

const mockAccount = {
  accountId: 33456,
  accountNumber: '****9103',
  accountType: 'cd',
  productName: '24-Month Certificate',
  productCode: 'CD-24M-001',
  jackHenryId: 'JH-556789',
  status: 'active',
  principalBalance: 50000.00,
  currentValue: 52125.00,
  interestRate: 0.0475,
  ytdInterest: 1856.25,
  openedDate: '2024-06-15',
  maturityDate: '2026-06-15',
  term: '24 Months',
  branch: 'Main Street #101',
  interestPayment: 'Monthly',
  renewalOption: 'Auto-Renew',
  earlyWithdrawalPenalty: '180 days of interest',
  productStatementDesc: '24-MONTH CERTIFICATE OF DEPOSIT',
  gracePeriod: '10 Days',
  lastRenewalDate: '2024-06-15',
  daysToMaturity: 522
};

const mockMaturityOptions = [
  { option: 'Auto-Renew at Current Rate', description: 'Automatically renew for another 24-month term at the prevailing rate', selected: true },
  { option: 'Transfer to Savings', description: 'Move principal and interest to linked savings account at maturity', selected: false },
  { option: 'Mail Check', description: 'Issue a check for the full balance at maturity', selected: false }
];

const mockOwnership = [
  { name: 'John Smith', role: 'Primary', percentage: 100, signingAuthority: true }
];

const mockTransactions = [
  { date: '2024-12-01', description: 'Monthly Interest Credit', type: 'Interest', amount: 197.92 },
  { date: '2024-11-01', description: 'Monthly Interest Credit', type: 'Interest', amount: 197.92 },
  { date: '2024-10-01', description: 'Monthly Interest Credit', type: 'Interest', amount: 197.92 },
  { date: '2024-09-01', description: 'Monthly Interest Credit', type: 'Interest', amount: 197.92 },
  { date: '2024-06-15', description: 'Initial Deposit', type: 'Deposit', amount: 50000.00 }
];

const mockInterestAccrual = [
  { month: 'Jul', accrued: 197 },
  { month: 'Aug', accrued: 395 },
  { month: 'Sep', accrued: 593 },
  { month: 'Oct', accrued: 791 },
  { month: 'Nov', accrued: 989 },
  { month: 'Dec', accrued: 1187 },
  { month: 'Jan', accrued: 1385 },
  { month: 'Feb', accrued: 1583 },
  { month: 'Mar', accrued: 1781 },
  { month: 'Apr', accrued: 1979 },
  { month: 'May', accrued: 2125 },
  { month: 'Jun', accrued: 2125 }
];

export default function AccountDetailCD({ accountId, onBack, params }: AccountDetailCDProps) {
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

  const maxAccrued = Math.max(...mockInterestAccrual.map(b => b.accrued));

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
              <Lock sx={{ fontSize: 48 }} />
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
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>PRINCIPAL BALANCE</Typography>
                <Typography variant="h4" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                  {formatCurrency(mockAccount.principalBalance)}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', p: 2, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>CURRENT VALUE</Typography>
                <Typography variant="h4" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                  {formatCurrency(mockAccount.currentValue)}
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
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>DAYS TO MATURITY</Typography>
                <Typography variant="h4" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                  {mockAccount.daysToMaturity}
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
                  <Typography variant="body2" color="text.secondary">Branch</Typography>
                  <Typography variant="body1">{mockAccount.branch}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Interest Payment</Typography>
                  <Typography variant="body1">{mockAccount.interestPayment}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Renewal Option</Typography>
                  <Typography variant="body1">{mockAccount.renewalOption}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Early Withdrawal Penalty</Typography>
                  <Typography variant="body1">{mockAccount.earlyWithdrawalPenalty}</Typography>
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
                  <Typography variant="body2" color="text.secondary">Grace Period</Typography>
                  <Typography variant="body1">{mockAccount.gracePeriod}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Last Renewal Date</Typography>
                  <Typography variant="body1">{formatDate(mockAccount.lastRenewalDate)}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={2} sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Interest Accrual (12 Months)
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 0.5, height: 180 }}>
                {mockInterestAccrual.map((item, index) => (
                  <Box key={item.month} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '9px', mb: 0.5, fontFamily: 'Roboto Mono' }}>
                      {formatCurrency(item.accrued)}
                    </Typography>
                    <Box
                      sx={{
                        width: '100%',
                        height: `${(item.accrued / maxAccrued) * 120}px`,
                        bgcolor: index === mockInterestAccrual.length - 1 ? 'primary.main' : 'primary.light',
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
                <Autorenew color="primary" />
                Maturity Options
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {mockMaturityOptions.map((opt, index) => (
                <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}>
                  <Box>
                    <Typography variant="body1" fontWeight={500}>
                      {opt.option}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {opt.description}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {opt.selected && <Chip label="SELECTED" color="success" size="small" />}
                    <Button size="small" variant="outlined">{opt.selected ? 'Change' : 'Select'}</Button>
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
          OPTION 1: Executive Summary Layout | Certificate of Deposit | A/B Testing Mockup
        </Typography>
      </Box>
    </Box>
  );
}
