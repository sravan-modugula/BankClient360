import { useState } from 'react';
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
  TableSortLabel,
  Paper,
  Divider,
  Grid,
  useTheme,
  Link,
  Pagination,
  TextField,
  InputAdornment
} from '@mui/material';
import {
  Home,
  CreditCard,
  Print,
  Download,
  CheckCircle,
  Info,
  Search
} from '@mui/icons-material';
import { useDateFormatter } from '@/lib/dateFormatters';
import DebitCardDetailModal from './DebitCardDetailModal';
import AccountBalanceTrends from './AccountBalanceTrends';
import { getCardStatusConfig, getCardStatusLabel, getCardBrandConfig, formatCardNumber, isCardActive } from '@/lib/debitCardConstants';
import type { DebitCardWithLimitProfile } from '@shared/schema';
import { FormatTransactionAmount } from './FormatTransactionAmount';
import BackButton from './BackButton';
import { formatFlatDate } from '@/helpers';
import { useHasPermission } from '@/hooks/usePermissions';

interface AccountDetailOption2Props {
  accountId?: string;
  isEmployee: boolean;
  onBack?: () => void;
  params?: Record<string, string>;
}

export default function AccountDetailOption2({ accountId, isEmployee, onBack, params }: AccountDetailOption2Props) {
  const theme = useTheme();
  const { formatCurrency, formatDate, formatPercentage } = useDateFormatter();
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<DebitCardWithLimitProfile | null>(null);
  const [showAllCards, setShowAllCards] = useState(false);
  const [txSortField, setTxSortField] = useState<'transactionDate' | 'amount' | 'description' | 'transactionType'>('transactionDate');
  const [txSortOrder, setTxSortOrder] = useState<'asc' | 'desc'>('desc');
  const [txPage, setTxPage] = useState(1);
  const [txSearch, setTxSearch] = useState('');
  const txPerPage = 10;

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

  const handlePrint = () => {
    window.print();
  };

  const handleExportCsv = () => {
    if (!account) return;

    // Account summary section
    const lines: string[] = [];
    lines.push('Account Summary');
    lines.push(`Account Number,${account.accountNumber || ''}`);
    lines.push(`Account Type,${account.accountType || ''}`);
    lines.push(`Product,${account.accountSubtype || account.accountType || ''}`);
    lines.push(`Status,${account.accountStatus || ''}`);
    lines.push(`Branch,${account.branchName || account.branchId || ''}`);
    lines.push(`Opened Date,${account.openedDate || ''}`);
    lines.push(`Current Balance,${account.balance || 0}`);
    lines.push(`Available Balance,${account.availableBalance || 0}`);
    lines.push(`Average Balance,${account.averageBalance || ''}`);
    lines.push(`Interest Rate,${account.interestRate || ''}`);
    lines.push('');

    // Transactions section
    if (transactions.length > 0) {
      lines.push('Transactions');
      lines.push('Date,Description,Type,Amount');
      transactions.forEach((tx: any) => {
        const desc = (tx.description || tx.merchantName || '').replace(/,/g, ' ');
        const type = (tx.transactionType || '').replace(/,/g, ' ');
        lines.push(`${tx.transactionDate || ''},${desc},${type},${tx.amount || 0}`);
      });
      lines.push('');
    }

    // Debit cards section
    if (debitCards.length > 0) {
      lines.push('Debit Cards');
      lines.push('Card Number,Brand,Status,Cardholder,Expiry');
      debitCards.forEach((card: any) => {
        lines.push(`****${card.lastFourDigits},${card.cardBrand || ''},${card.cardStatus || ''},${(card.cardholderName || '').replace(/,/g, ' ')},${card.expiryMonth}/${card.expiryYear}`);
      });
    }

    const csvContent = lines.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `account_${account.accountNumber || accountId}_summary.csv`;
    link.click();
    URL.revokeObjectURL(url);
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

  const canViewBalances = useHasPermission('account.view.balances');

  if (!canViewBalances && isEmployee) {
    return <div>Access Denied</div>
  }

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

  // COLLECTED balance is hidden until the upstream data issue is resolved (the
  // source figure is unreliable). Set back to true to restore the card.
  const SHOW_COLLECTED_CARD = false;

  return (
    <Box sx={{ p: 3, maxWidth: 1400, margin: '0 auto' }}>
      {/* Top Navigation Bar */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <BackButton fallback={onBack ?? '/ciq/client'} testId="btn-back" />
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button startIcon={<Print />} variant="outlined" size="small" onClick={handlePrint}>Print</Button>
          <Button startIcon={<Download />} variant="outlined" size="small" onClick={handleExportCsv}>Export CSV</Button>
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
                  Account: ****{account.accountNumber?.slice(-4)} | Product: {getProductName(account)} | CIF: {owners[0]?.cifNumber || '—'}
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
            {SHOW_COLLECTED_CARD && (
              <Grid size={{ xs: 6, md: 3 }}>
                <Box sx={{ bgcolor: 'rgba(255,255,255,0.1)', p: 2, borderRadius: 2, textAlign: 'center' }}>
                  <Typography variant="body2" sx={{ opacity: 0.8, mb: 1 }}>COLLECTED</Typography>
                  <Typography variant="h4" fontWeight={500} sx={{ fontFamily: 'Roboto Mono' }}>
                    {formatCurrency(collectedBalance)}
                  </Typography>
                </Box>
              </Grid>
            )}
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
                  <Typography variant="body1">{account.openedDate ? formatFlatDate(account.openedDate) : '—'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Branch</Typography>
                  <Typography variant="body1">{account.branchName || (account.branchId ? `Branch #${account.branchId}` : 'N/A')}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Statement Cycle</Typography>
                  <Typography variant="body1">
                    {account.statementCycle && account.statementCodeDesc
                      ? `${account.statementCycle}: ${account.statementCodeDesc}`
                      : account.statementCycle || account.statementCodeDesc || "N/A"}
                  </Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Last Activity</Typography>
                  <Typography variant="body1">{account.lastTransactionDate ? formatFlatDate(account.lastTransactionDate) : 'N/A'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Average Balance</Typography>
                  <Typography variant="body1">{account.averageBalance ? formatCurrency(account.averageBalance) : 'N/A'}</Typography>
                </Grid>
                <Grid size={{ xs: 6 }}>
                  <Typography variant="body2" color="text.secondary">Product</Typography>
                  <Typography variant="body1">{getProductName(account)}</Typography>
                </Grid>
                {account.maturityDate && account.maturityDate !== "1900-01-01T00:00:00.000Z" && (
                  <Grid size={{ xs: 6 }}>
                    <Typography variant="body2" color="text.secondary">Maturity Date</Typography>
                    <Typography variant="body1">{account.maturityDate ? formatFlatDate(account.maturityDate) : '—'}</Typography>
                  </Grid>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Balance History */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={2} sx={{ height: '100%' }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <AccountBalanceTrends accountId={accountId!} currentBalance={balance} accountType={account.accountType}/> 
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
              {(() => {
                const activeCards = debitCards.filter((c: any) => isCardActive(c.cardStatus));
                const displayCards = showAllCards ? debitCards : activeCards;
                const activeCount = activeCards.length;
                const totalCount = debitCards.length;
                return (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CreditCard fontSize="small" color="primary" />
                        Debit Cards ({showAllCards ? totalCount : activeCount}{!showAllCards && totalCount > activeCount ? ` of ${totalCount}` : ''})
                      </Typography>
                      {totalCount > activeCount && (
                        <Link
                          component="button"
                          variant="body2"
                          onClick={() => setShowAllCards(!showAllCards)}
                          sx={{ textDecoration: 'none', whiteSpace: 'nowrap' }}
                        >
                          {showAllCards ? 'Show Active Only' : 'Show All'}
                        </Link>
                      )}
                    </Box>
                    <Divider sx={{ mb: 2 }} />
                    {displayCards.length > 0 ? (
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {displayCards.map((card: any) => {
                          const brandConfig = getCardBrandConfig(card.cardBrand);
                          const statusConfig = getCardStatusConfig(card.cardStatus);
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
                  </>
                );
              })()}
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
                        <Link href={`/ciq/client?customerId=${owner.customerId}`} variant="body1" fontWeight={500}>
                          {owner.customerName || '—'}
                        </Link>
                        {owner.ownershipType && (
                          <Chip
                            label={owner.ownershipType.charAt(0).toUpperCase() + owner.ownershipType.slice(1)}
                            size="small"
                            color={owner.ownershipType.toLowerCase() === 'primary' ? 'primary' : 'default'}
                            sx={{ height: 20 }}
                          />
                        )}
                      </Box>
                      <Typography variant="body2" color="text.secondary">
                        Signing Authority: {owner.signingAuthority ? 'Yes' : 'No'}
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
            <Typography variant="h6">Recent Transactions {transactions.length > 0 ? `(As Of: ${formatFlatDate(account.createdAt, 1)})` : "" } </Typography>
            <TextField
              size="small"
              placeholder="Search transactions..."
              value={txSearch}
              onChange={(e) => { setTxSearch(e.target.value); setTxPage(1); }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Search color="action" fontSize="small" />
                  </InputAdornment>
                )
              }}
              sx={{ width: 250 }}
            />
          </Box>
          <Divider sx={{ mb: 2 }} />
          {(() => {
            const filteredTx = transactions.filter((tx: any) =>
              !txSearch ||
              (tx.description || '').toLowerCase().includes(txSearch.toLowerCase()) ||
              (tx.merchantName || '').toLowerCase().includes(txSearch.toLowerCase()) ||
              (tx.transactionType || '').toLowerCase().includes(txSearch.toLowerCase())
            );
            const sortedTx = [...filteredTx].sort((a: any, b: any) => {
              let cmp = 0;
              if (txSortField === 'transactionDate') {
                cmp = new Date(a.transactionDate).getTime() - new Date(b.transactionDate).getTime();
              } else if (txSortField === 'amount') {
                cmp = (parseFloat(a.amount) || 0) - (parseFloat(b.amount) || 0);
              } else if (txSortField === 'description') {
                cmp = (a.description || '').localeCompare(b.description || '');
              } else if (txSortField === 'transactionType') {
                cmp = (a.transactionType || '').localeCompare(b.transactionType || '');
              }
              return txSortOrder === 'asc' ? cmp : -cmp;
            });
            const txTotalPages = Math.ceil(sortedTx.length / txPerPage);
            const paginatedTx = sortedTx.slice((txPage - 1) * txPerPage, txPage * txPerPage);

            const handleSort = (field: typeof txSortField) => {
              if (txSortField === field) {
                setTxSortOrder(txSortOrder === 'asc' ? 'desc' : 'asc');
              } else {
                setTxSortField(field);
                setTxSortOrder(field === 'transactionDate' ? 'desc' : 'asc');
              }
              setTxPage(1);
            };

            return (
              <>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell sx={{ fontWeight: 500 }}>
                          <TableSortLabel
                            active={txSortField === 'transactionDate'}
                            direction={txSortField === 'transactionDate' ? txSortOrder : 'desc'}
                            onClick={() => handleSort('transactionDate')}
                          >
                            Date
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>
                          <TableSortLabel
                            active={txSortField === 'description'}
                            direction={txSortField === 'description' ? txSortOrder : 'asc'}
                            onClick={() => handleSort('description')}
                          >
                            Description
                          </TableSortLabel>
                        </TableCell>
                        <TableCell sx={{ fontWeight: 500 }}>
                          <TableSortLabel
                            active={txSortField === 'transactionType'}
                            direction={txSortField === 'transactionType' ? txSortOrder : 'asc'}
                            onClick={() => handleSort('transactionType')}
                          >
                            Type
                          </TableSortLabel>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 500 }}>
                          <TableSortLabel
                            active={txSortField === 'amount'}
                            direction={txSortField === 'amount' ? txSortOrder : 'desc'}
                            onClick={() => handleSort('amount')}
                          >
                            Amount
                          </TableSortLabel>
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {paginatedTx.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                            <Typography variant="body2" color="text.secondary">
                              {txSearch ? 'No matching transactions' : 'No transactions found'}
                            </Typography>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedTx.map((tx: any, idx: number) => {
                          const amount = parseFloat(tx.amount) || 0;
                          return (
                            <TableRow key={tx.transactionId || idx} hover>
                              <TableCell>{tx.postingDate ? formatFlatDate(tx.postingDate) : "N/A"}</TableCell>
                              <TableCell>{tx.description || tx.merchantName || '—'}</TableCell>
                              <TableCell>
                                {tx.transactionType ? (
                                  <Chip label={tx.transactionType} size="small" variant="outlined" />
                                ) : '—'}
                              </TableCell>
                              <TableCell align="right">
                                <FormatTransactionAmount amount={amount} />
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2 }}>
                  <Typography variant="caption" color="text.secondary">
                    Showing {paginatedTx.length} of {filteredTx.length} transactions
                  </Typography>
                  {txTotalPages > 1 && (
                    <Pagination
                      count={txTotalPages}
                      page={txPage}
                      onChange={(_, page) => setTxPage(page)}
                      size="small"
                      color="primary"
                    />
                  )}
                </Box>
              </>
            );
          })()}
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
