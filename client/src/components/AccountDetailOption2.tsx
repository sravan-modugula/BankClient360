import { useState } from 'react';
import { useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
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
  Tooltip,
  CircularProgress,
  Link
} from '@mui/material';
import {
  ArrowBack,
  Home,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Search,
  Print,
  Download,
  CheckCircle,
  Cancel,
  Schedule,
  AccountBalanceWallet,
  Visibility,
  AccountBalance,
  Savings
} from '@mui/icons-material';
import { useDateFormatter } from '@/lib/dateFormatters';
import DebitCardDetailModal from './DebitCardDetailModal';
import { CARD_STATUS_COLORS, getCardStatusLabel, getCardBrandConfig, formatCardNumber } from '@/lib/debitCardConstants';
import type { DebitCardWithLimitProfile } from '@shared/schema';

interface AccountDetailOption2Props {
  accountId?: string;
  onBack?: () => void;
  params?: Record<string, string>;
}

export default function AccountDetailOption2({ accountId, onBack, params }: AccountDetailOption2Props) {
  const theme = useTheme();
  const [, setLocation] = useLocation();
  const { formatCurrency, formatDate, formatPercentage } = useDateFormatter();
  const [txFilter, setTxFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<DebitCardWithLimitProfile | null>(null);

  // Fetch real account data
  const { data: account, isLoading: accountLoading } = useQuery<any>({
    queryKey: [`/api/accounts/${accountId}`],
    enabled: !!accountId
  });

  // Fetch account owners
  const { data: owners = [] } = useQuery<any[]>({
    queryKey: [`/api/accounts/${accountId}/owners`],
    enabled: !!accountId
  });

  // Fetch debit cards
  const { data: cardsData } = useQuery<{ cards: any[] }>({
    queryKey: ['/api/accounts', accountId, 'debit-cards'],
    enabled: !!accountId
  });

  // Fetch transactions
  const { data: txData } = useQuery<{ transactions: any[] }>({
    queryKey: [`/api/accounts/${accountId}/transactions`],
    enabled: !!accountId
  });

  const debitCards = cardsData?.cards || [];
  const transactions = txData?.transactions || [];

  const primaryOwner = owners.find((o: any) => o.isPrimaryOwner) || owners[0];

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      setLocation('/');
    }
  };

  const filteredTransactions = transactions.filter((tx: any) => {
    const amount = parseFloat(tx.amount);
    if (txFilter === 'deposits' && amount < 0) return false;
    if (txFilter === 'withdrawals' && amount > 0) return false;
    if (searchQuery && !(tx.description || tx.merchantName || '').toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const getAccountIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'checking':
      case 'business_checking':
        return <Home sx={{ fontSize: 48 }} />;
      case 'savings':
        return <Savings sx={{ fontSize: 48 }} />;
      case 'credit_card':
        return <CreditCard sx={{ fontSize: 48 }} />;
      default:
        return <AccountBalance sx={{ fontSize: 48 }} />;
    }
  };

  const getProductName = (acct: any) => {
    if (acct?.accountSubtype) {
      return acct.accountSubtype.replace(/_/g, ' ').replace(/\b\w/g, (l: string) => l.toUpperCase());
    }
    if (acct?.accountType) {
      return acct.accountType.charAt(0).toUpperCase() + acct.accountType.slice(1).replace(/_/g, ' ');
    }
    return 'Account';
  };

  if (accountLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!account) {
    return (
      <Box sx={{ textAlign: 'center', py: 8 }}>
        <Typography variant="h6" color="text.secondary">Account not found</Typography>
      </Box>
    );
  }

  const balance = parseFloat(account.balance) || 0;
  const availableBalance = parseFloat(account.availableBalance) || 0;
  const pendingBalance = Math.abs(balance - availableBalance);

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
              {getAccountIcon(account.accountType)}
              <Box>
                <Typography variant="h4" fontWeight={500}>
                  {getProductName(account)}
                </Typography>
                <Typography variant="body1" sx={{ opacity: 0.9 }}>
                  Account: ****{account.accountNumber?.slice(-4)} | Product: {account.productCode || '—'} | JH ID: {account.jackHenryAccountId || '—'}
                </Typography>
              </Box>
            </Box>
            <Chip
              label={(account.accountStatus || 'unknown').toUpperCase()}
              sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white', fontWeight: 500 }}
              icon={<CheckCircle sx={{ color: 'white !important' }} />}
            />
          </Box>

          <Grid container spacing={3}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', p: 2, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>CURRENT BALANCE</Typography>
                <Typography variant="h4" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                  {formatCurrency(balance)}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', p: 2, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>AVAILABLE</Typography>
                <Typography variant="h4" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                  {formatCurrency(availableBalance)}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', p: 2, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>PENDING</Typography>
                <Typography variant="h4" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                  {formatCurrency(pendingBalance)}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', p: 2, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>INTEREST RATE</Typography>
                <Typography variant="h4" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                  {account.interestRate ? formatPercentage(account.interestRate) : '—'}
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
                  <Typography variant="body2" fontWeight={500}>
                    {account.accountType?.charAt(0).toUpperCase() + account.accountType?.slice(1).replace(/_/g, ' ')}
                  </Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Branch</Typography>
                  <Typography variant="body2" fontWeight={500}>{account.branchId ? `Branch #${account.branchId}` : '—'}</Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Opened</Typography>
                  <Typography variant="body2" fontWeight={500}>{account.openedDate ? formatDate(account.openedDate) : '—'}</Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Statement Cycle</Typography>
                  <Typography variant="body2" fontWeight={500}>{account.statementCycle || account.statementCodeDesc || '—'}</Typography>
                </Box>
                <Divider />
                <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Typography variant="body2" color="text.secondary">Interest Rate</Typography>
                  <Typography variant="body2" fontWeight={500}>{account.interestRate ? formatPercentage(account.interestRate) : '—'}</Typography>
                </Box>
                {account.averageBalance && (
                  <>
                    <Divider />
                    <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
                      <Typography variant="body2" color="text.secondary">Avg Balance</Typography>
                      <Typography variant="body2" fontWeight={500}>{formatCurrency(account.averageBalance)}</Typography>
                    </Box>
                  </>
                )}
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
              {primaryOwner ? (
                <>
                  <Box sx={{ bgcolor: 'action.hover', p: 2, borderRadius: 1, mb: 2 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                      <Typography variant="body1" fontWeight={500}>{primaryOwner.customerName || '—'}</Typography>
                      <Chip label={primaryOwner.ownershipType?.replace(/_/g, ' ') || 'Owner'} size="small" color="primary" />
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      {primaryOwner.ownershipPercentage ? `${parseFloat(primaryOwner.ownershipPercentage)}% Ownership` : '—'}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {primaryOwner.signingAuthority ? <CheckCircle fontSize="small" color="success" /> : <Cancel fontSize="small" color="disabled" />}
                      <Typography variant="body2">Signing Authority</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {primaryOwner.canViewStatements ? <CheckCircle fontSize="small" color="success" /> : <Cancel fontSize="small" color="disabled" />}
                      <Typography variant="body2">View Statements</Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {primaryOwner.canMakeTransactions ? <CheckCircle fontSize="small" color="success" /> : <Cancel fontSize="small" color="disabled" />}
                      <Typography variant="body2">Transact</Typography>
                    </Box>
                  </Box>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">No ownership data available</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Debit Cards Card */}
        <Grid size={{ xs: 12, md: 4 }}>
          <Card elevation={1} sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <CreditCard fontSize="small" color="primary" />
                Linked Cards ({debitCards.length})
              </Typography>
              {debitCards.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {debitCards.map((card: any) => {
                    const brandConfig = getCardBrandConfig(card.cardBrand);
                    const statusConfig = CARD_STATUS_COLORS[card.cardStatus as keyof typeof CARD_STATUS_COLORS] || CARD_STATUS_COLORS.active;
                    return (
                      <Box
                        key={card.cardId}
                        sx={{
                          bgcolor: 'action.hover',
                          p: 2,
                          borderRadius: 1,
                        }}
                      >
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Box>
                            <Typography variant="body2" fontWeight={500} sx={{ fontFamily: 'Roboto Mono', color: brandConfig.color }}>
                              {brandConfig.name} {formatCardNumber(card.lastFourDigits)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Exp: {card.expiryMonth}/{card.expiryYear}
                              {card.limitProfile ? ` | Limit: ${formatCurrency(card.limitProfile.dailyPurchaseLimit)}/day` : ''}
                            </Typography>
                          </Box>
                          <Chip
                            label={getCardStatusLabel(card.cardStatus)}
                            size="small"
                            color={statusConfig.chip}
                          />
                        </Box>
                        <Link
                          component="button"
                          variant="caption"
                          onClick={() => {
                            setSelectedCard(card);
                            setCardModalOpen(true);
                          }}
                          sx={{ mt: 0.5, display: 'inline-block' }}
                        >
                          View Limits & Details →
                        </Link>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">No linked cards</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Transactions Card with Filtering */}
      <Card elevation={1}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 2 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Schedule fontSize="small" color="primary" />
              Recent Transactions ({transactions.length})
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
                {filteredTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">No transactions found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredTransactions.slice(0, 20).map((tx: any, idx: number) => {
                    const amount = parseFloat(tx.amount);
                    return (
                      <TableRow key={tx.transactionId || idx} hover>
                        <TableCell>{formatDate(tx.transactionDate)}</TableCell>
                        <TableCell>{tx.description || tx.merchantName || '—'}</TableCell>
                        <TableCell>
                          {tx.transactionType ? (
                            <Chip label={tx.transactionType} size="small" variant="outlined" />
                          ) : '—'}
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            sx={{
                              color: amount >= 0 ? 'success.main' : 'text.primary',
                              fontWeight: amount >= 0 ? 600 : 400,
                              fontFamily: 'Roboto Mono',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'flex-end',
                              gap: 0.5
                            }}
                          >
                            {amount >= 0 && <TrendingUp fontSize="small" />}
                            {amount < 0 && <TrendingDown fontSize="small" color="action" />}
                            {formatCurrency(Math.abs(amount))}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      <DebitCardDetailModal
        open={cardModalOpen}
        onClose={() => { setCardModalOpen(false); setSelectedCard(null); }}
        card={selectedCard}
        accountNumber={account?.accountNumber}
      />
    </Box>
  );
}
