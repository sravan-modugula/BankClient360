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
  useTheme,
  Link
} from '@mui/material';
import {
  ArrowBack,
  Home,
  CreditCard,
  TrendingUp,
  TrendingDown,
  Print,
  Download,
  CheckCircle,
  Info
} from '@mui/icons-material';
import { useDateFormatter } from '@/lib/dateFormatters';
import DebitCardDetailModal from './DebitCardDetailModal';
import AccountBalanceTrends from './AccountBalanceTrends';
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

  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      setLocation('/');
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
        <Typography color="text.secondary">Loading...</Typography>
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
  const collectedBalance = Math.abs(balance - availableBalance);

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
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>CURRENT LEDGER BALANCE</Typography>
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
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>COLLECTED</Typography>
                <Typography variant="h4" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                  {formatCurrency(collectedBalance)}
                </Typography>
              </Box>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', p: 2, borderRadius: 2, textAlign: 'center' }}>
                <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>RATE</Typography>
                <Typography variant="h4" fontWeight={500}>
                  {account.interestRate ? formatPercentage(account.interestRate) : '—'}
                </Typography>
              </Box>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Row 1: Account Information + Balance History */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Account Information */}
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
                  <Typography variant="body1">{account.openedDate ? formatDate(account.openedDate) : '—'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Branch</Typography>
                  <Typography variant="body1">{account.branchId ? `Branch #${account.branchId}` : 'N/A'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Statement Cycle</Typography>
                  <Typography variant="body1">{account.statementCycle || account.statementCodeDesc || 'N/A'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Last Activity</Typography>
                  <Typography variant="body1">{account.lastTransactionDate ? formatDate(account.lastTransactionDate) : 'N/A'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Average Balance</Typography>
                  <Typography variant="body1">{account.averageBalance ? formatCurrency(account.averageBalance) : 'N/A'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">YTD Interest</Typography>
                  <Typography variant="body1">N/A</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Product Code</Typography>
                  <Typography variant="body1">{account.productCode || 'N/A'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Product Statement Desc</Typography>
                  <Typography variant="body1">{account.statementCodeDesc || 'N/A'}</Typography>
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Balance History */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={2} sx={{ height: '100%' }}>
            <CardContent>
              {['checking', 'savings', 'money_market', 'cd', 'business_checking'].includes(account.accountType) ? (
                <AccountBalanceTrends accountId={accountId!} currentBalance={balance} />
              ) : (
                <>
                  <Typography variant="h6" gutterBottom>
                    Balance History (12 Months)
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 4 }}>
                    <Info sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Balance history not available
                    </Typography>
                    <Typography variant="body1" sx={{ fontFamily: 'Roboto Mono' }}>
                      Current Balance: {formatCurrency(balance)}
                    </Typography>
                  </Box>
                </>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Row 2: Debit Cards + Account Ownership */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* Debit Cards */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={2} sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CreditCard fontSize="small" color="primary" />
                Debit Cards ({debitCards.length})
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {debitCards.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {debitCards.map((card: any) => {
                    const brandConfig = getCardBrandConfig(card.cardBrand);
                    const statusConfig = CARD_STATUS_COLORS[card.cardStatus as keyof typeof CARD_STATUS_COLORS] || CARD_STATUS_COLORS.active;
                    return (
                      <Box key={card.cardId}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                          <Typography
                            variant="body2"
                            component="span"
                            fontWeight="400"
                            sx={{ color: brandConfig.color }}
                          >
                            {brandConfig.name}
                          </Typography>
                          <Typography variant="body2" component="span" fontFamily="Roboto Mono">
                            {formatCardNumber(card.lastFourDigits)}
                          </Typography>
                          <Chip
                            label={getCardStatusLabel(card.cardStatus)}
                            size="small"
                            color={statusConfig.chip}
                            sx={{ height: 20 }}
                          />
                          {card.limitProfile?.profileName && (
                            <Chip
                              label={card.limitProfile.profileName}
                              size="small"
                              variant="outlined"
                              sx={{ height: 20 }}
                            />
                          )}
                          <Link
                            component="button"
                            variant="body2"
                            onClick={() => {
                              setSelectedCard(card);
                              setCardModalOpen(true);
                            }}
                            sx={{ ml: 'auto', textDecoration: 'none' }}
                          >
                            View Limits & Details →
                          </Link>
                        </Box>
                        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                          {card.cardholderName || '—'} | Expires {card.expiryMonth}/{card.expiryYear}
                        </Typography>
                      </Box>
                    );
                  })}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">No debit cards linked to this account</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Account Ownership */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={2} sx={{ height: '100%' }}>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Account Ownership
              </Typography>
              <Divider sx={{ mb: 2 }} />
              {owners.length > 0 ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {owners.map((owner: any, idx: number) => (
                    <Box key={owner.ownerId || idx}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body1" fontWeight={500}>
                          {owner.customerName || '—'}
                        </Typography>
                        {owner.isPrimaryOwner && (
                          <Chip label="Primary" size="small" color="primary" sx={{ height: 20 }} />
                        )}
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Ownership: {owner.ownershipPercentage ? `${parseFloat(owner.ownershipPercentage)}%` : 'N/A'} | Signing Authority: {owner.signingAuthority ? 'Yes' : 'No'}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              ) : (
                <Typography variant="body2" color="text.secondary">No ownership data available</Typography>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Recent Transactions */}
      <Card elevation={2}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="h6">Recent Transactions</Typography>
            <Button variant="text" size="small">View All</Button>
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
                {transactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">No transactions found</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  transactions.slice(0, 20).map((tx: any, idx: number) => {
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
