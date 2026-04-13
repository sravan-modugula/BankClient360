import { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Radio,
  ToggleButtonGroup,
  ToggleButton,
  TextField,
  InputAdornment,
  IconButton,
  Collapse,
  Grid,
  Link,
  Divider
} from '@mui/material';
import {
  Search,
  ExpandMore,
  ExpandLess,
  AccountBalance,
  Home,
  Savings,
  CreditCard,
  Timeline,
  Assignment,
  Business,
  CreditScore,
  TrendingUp,
  AttachMoney
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useDateFormatter } from '@/lib/dateFormatters';
import DebitCardDetailModal from './DebitCardDetailModal';
import {
  CARD_STATUS_COLORS,
  formatCardNumber,
  getCardStatusLabel,
  getCardBrandConfig
} from '@/lib/debitCardConstants';
import type { DebitCardWithLimitProfile } from '@shared/schema';

interface Account {
  accountId: number;
  accountNumber: string;
  accountType: string;
  accountSubtype?: string;
  accountStatus: string;
  balance: string;
  availableBalance?: string;
  currency: string;
  interestRate?: string;
  creditLimit?: string;
  branchId?: number;
  productCode?: string;
  openedDate: string;
  closedDate?: string;
  maturityDate?: string;
  jackHenryAccountId?: string;
  silverlakeAccountStructure?: string;
}

interface AccountSummaryTableVersionProps {
  accounts: Account[];
  onViewAccount?: (accountId: string) => void;
  selectedAccountId?: number | null;
  onAccountSelect?: (accountId: number | null, accountLabel: string) => void;
}

export default function AccountSummaryTableVersion({
  accounts,
  onViewAccount,
  selectedAccountId = null,
  onAccountSelect
}: AccountSummaryTableVersionProps) {
  const [accountTypeFilter, setAccountTypeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<DebitCardWithLimitProfile | null>(null);
  const [selectedAccountForModal, setSelectedAccountForModal] = useState<Account | null>(null);

  const { formatCurrency, formatPercentage, formatDate } = useDateFormatter();

  // Account type options
  const accountTypes = [
    { key: 'all', label: 'All' },
    { key: 'checking', label: 'Checking' },
    { key: 'savings', label: 'Savings' },
    { key: 'loan', label: 'Loans' },
    { key: 'mortgage', label: 'Mortgage' },
    { key: 'heloc', label: 'HELOC' },
    { key: 'credit_card', label: 'Credit Cards' },
    { key: 'cd', label: 'CDs' }
  ];

  // Filter accounts (case-insensitive to handle SQL Server data casing)
  const filteredAccounts = accounts.filter(account => {
    let matchesType = false;
    const type = account.accountType?.toLowerCase() || '';

    if (accountTypeFilter === 'all') {
      matchesType = true;
    } else if (accountTypeFilter === 'checking') {
      matchesType = type.includes('checking');
    } else if (accountTypeFilter === 'savings') {
      matchesType = type.includes('savings') || type.includes('money market') || type.includes('christmas club');
    } else if (accountTypeFilter === 'mortgage') {
      matchesType = type.includes('mortgage');
    } else if (accountTypeFilter === 'heloc') {
      matchesType = type.includes('heloc') || type.includes('line of credit');
    } else if (accountTypeFilter === 'credit_card') {
      matchesType = type.includes('credit');
    } else if (accountTypeFilter === 'cd') {
      matchesType = type.includes('cd') || type.includes('time deposit');
    } else if (accountTypeFilter === 'loan') {
      matchesType = type === 'loan' || type.includes('loan');
    } else {
      matchesType = type === accountTypeFilter;
    }

    const matchesSearch = !searchQuery ||
      account.accountNumber.includes(searchQuery) ||
      type.includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  // Calculate totals
  const getTotalBalance = () => {
    return accounts.reduce((total, account) => {
      const balance = parseFloat(account.balance) || 0;
      if (['mortgage', 'heloc', 'credit_card'].includes(account.accountType?.toLowerCase())) {
        return total;
      }
      return total + balance;
    }, 0);
  };

  const activeAccountsCount = accounts.filter(a => a.accountStatus?.toLowerCase() === 'active').length;

  const getAccountIcon = (type: string) => {
    const iconProps = { fontSize: 'small' as const };
    switch (type.toLowerCase()) {
      case 'checking':
      case 'business_checking':
        return <Home {...iconProps} />;
      case 'savings':
        return <Savings {...iconProps} />;
      case 'mortgage':
        return <Home {...iconProps} />;
      case 'heloc':
        return <Timeline {...iconProps} />;
      case 'credit_card':
        return <CreditCard {...iconProps} />;
      case 'cd':
        return <Assignment {...iconProps} />;
      default:
        return <AccountBalance {...iconProps} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'success';
      case 'inactive': return 'warning';
      case 'closed': return 'error';
      case 'paid_off': return 'info';
      case 'frozen': return 'warning';
      case 'suspended': return 'error';
      case 'matured': return 'success';
      default: return 'default';
    }
  };

  const getProductName = (account: Account) => {
    if (account.accountSubtype) {
      return account.accountSubtype.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
    return account.accountType.charAt(0).toUpperCase() + account.accountType.slice(1);
  };

  const toggleRowExpanded = (accountId: number) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(accountId)) {
      newExpanded.delete(accountId);
    } else {
      newExpanded.add(accountId);
    }
    setExpandedRows(newExpanded);
  };

  const handleRadioChange = (accountId: number | null) => {
    if (onAccountSelect) {
      if (accountId === null) {
        onAccountSelect(null, 'All Accounts');
      } else {
        const account = accounts.find(a => a.accountId === accountId);
        if (account) {
          const accountLabel = `${getProductName(account)} ****${account.accountNumber.slice(-4)}`;
          onAccountSelect(accountId, accountLabel);
        }
      }
    }
  };

  const handleOpenCardModal = (card: DebitCardWithLimitProfile, account: Account) => {
    setSelectedCard(card);
    setSelectedAccountForModal(account);
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setSelectedCard(null);
    setSelectedAccountForModal(null);
  };

  return (
    <Card elevation={2}>
      <CardContent>
        {/* Header with Title and Totals */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h5" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountBalance color="secondary" />
            Account Portfolio
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" color="text.secondary">Total Portfolio Value</Typography>
              <Typography variant="h6" color="primary" sx={{ fontFamily: 'Roboto Mono, monospace' }} data-testid="text-total-balance">
                {formatCurrency(getTotalBalance())}
              </Typography>
            </Box>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" color="text.secondary">Active Accounts</Typography>
              <Typography variant="h6" sx={{ fontFamily: 'Roboto Mono, monospace' }}>
                {activeAccountsCount}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Filter Bar */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
          <ToggleButtonGroup
            value={accountTypeFilter}
            exclusive
            onChange={(e, value) => value && setAccountTypeFilter(value)}
            size="small"
          >
            {accountTypes.map(type => (
              <ToggleButton key={type.key} value={type.key} data-testid={`filter-${type.key}`}>
                {type.label}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <TextField
            placeholder="Search accounts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            size="small"
            sx={{ width: 250 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <Search fontSize="small" />
                </InputAdornment>
              )
            }}
            data-testid="input-search-accounts"
          />
        </Box>

        {/* All Accounts Radio Option */}
        {onAccountSelect && (
          <Card variant="outlined" sx={{ mb: 2, bgcolor: selectedAccountId === null ? theme => `${theme.palette.primary.main}08` : 'transparent' }}>
            <CardContent sx={{ py: 1.5 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Radio
                  checked={selectedAccountId === null}
                  onChange={() => handleRadioChange(null)}
                  inputProps={{ 'aria-label': 'View all accounts transactions' }}
                  data-testid="radio-all-accounts"
                />
                <Typography variant="body1" fontWeight="400">
                  All Accounts - View All Transactions
                </Typography>
              </Box>
            </CardContent>
          </Card>
        )}

        {/* Table */}
        <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 600 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                {onAccountSelect && <TableCell padding="checkbox" sx={{ width: 48 }}></TableCell>}
                <TableCell sx={{ fontWeight: 500 }}>Account</TableCell>
                <TableCell align="right" sx={{ fontWeight: 500 }}>Balance</TableCell>
                <TableCell align="right" sx={{ fontWeight: 500 }}>Available</TableCell>
                <TableCell align="right" sx={{ fontWeight: 500 }}>Rate</TableCell>
                <TableCell sx={{ fontWeight: 500 }}>Status</TableCell>
                <TableCell align="center" sx={{ width: 60, fontWeight: 500 }}>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAccounts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={onAccountSelect ? 7 : 6} align="center" sx={{ py: 4 }}>
                    <AccountBalance sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
                    <Typography variant="body1" color="text.secondary">
                      No accounts found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredAccounts.flatMap((account) => {
                  const isExpanded = expandedRows.has(account.accountId);
                  const isCheckingAccount = account.accountType === 'checking' || account.accountType === 'business_checking';

                  return [
                    <TableRow
                      key={`account-${account.accountId}`}
                      hover
                      onClick={() => onAccountSelect && handleRadioChange(account.accountId)}
                      sx={{
                        bgcolor: selectedAccountId === account.accountId ? theme => `${theme.palette.primary.main}08` : 'transparent',
                        cursor: onAccountSelect ? 'pointer' : 'default'
                      }}
                      data-testid={`row-account-${account.accountId}`}
                    >
                        {onAccountSelect && (
                          <TableCell padding="checkbox">
                            <Radio
                              checked={selectedAccountId === account.accountId}
                              onChange={() => handleRadioChange(account.accountId)}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleRadioChange(account.accountId);
                              }}
                              value={account.accountId}
                              inputProps={{ 'aria-label': `Select ${getProductName(account)}` }}
                              data-testid={`radio-account-${account.accountId}`}
                            />
                          </TableCell>
                        )}
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            {getAccountIcon(account.accountType)}
                            <Box>
                              <Typography variant="body2" fontWeight="400">
                                {getProductName(account)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                ****{account.accountNumber.slice(-4)} • {formatDate(account.openedDate)}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontFamily: 'Roboto Mono, monospace' }}>
                            {formatCurrency(account.balance)}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontFamily: 'Roboto Mono, monospace' }}>
                            {account.availableBalance ? formatCurrency(account.availableBalance) : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2">
                            {account.interestRate ? formatPercentage(account.interestRate) : '—'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={account.accountStatus.toUpperCase()}
                            color={getStatusColor(account.accountStatus) as any}
                            size="small"
                          />
                        </TableCell>
                        <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                          <IconButton
                            size="small"
                            onClick={() => toggleRowExpanded(account.accountId)}
                            data-testid={`button-expand-${account.accountId}`}
                          >
                            {isExpanded ? <ExpandLess /> : <ExpandMore />}
                          </IconButton>
                        </TableCell>
                      </TableRow>,
                    // Expandable Details Row
                    <TableRow key={`expanded-${account.accountId}`}>
                      <TableCell
                        colSpan={onAccountSelect ? 7 : 6}
                        sx={{ py: 0, borderBottom: isExpanded ? undefined : 0 }}
                      >
                        <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                          <Box sx={{ py: 2, px: 3, bgcolor: 'action.hover' }}>
                            <ExpandedAccountDetails
                              account={account}
                              formatCurrency={formatCurrency}
                              formatPercentage={formatPercentage}
                              formatDate={formatDate}
                              getProductName={getProductName}
                              onOpenCardModal={handleOpenCardModal}
                            />
                          </Box>
                        </Collapse>
                      </TableCell>
                    </TableRow>
                  ];
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </CardContent>

      {/* Debit Card Detail Modal */}
      <DebitCardDetailModal
        open={modalOpen}
        onClose={handleCloseModal}
        card={selectedCard}
        accountNumber={selectedAccountForModal?.accountNumber}
      />
    </Card>
  );
}

// Separate component for expanded account details
function ExpandedAccountDetails({
  account,
  formatCurrency,
  formatPercentage,
  formatDate,
  getProductName,
  onOpenCardModal
}: {
  account: Account;
  formatCurrency: (v: string | number) => string;
  formatPercentage: (v: string) => string;
  formatDate: (v: string) => string;
  getProductName: (a: Account) => string;
  onOpenCardModal: (card: DebitCardWithLimitProfile, account: Account) => void;
}) {
  const isCheckingAccount = account.accountType === 'checking' || account.accountType === 'business_checking';

  // Fetch debit cards
  const { data: cardsData } = useQuery<{ cards: DebitCardWithLimitProfile[] }>({
    queryKey: ['/api/accounts', account.accountId, 'debit-cards'],
    enabled: isCheckingAccount
  });

  const debitCards = cardsData?.cards || [];

  // Fetch SIC codes
  const { data: sicCodesData } = useQuery<{
    sicCodes: Array<{
      sicCode: number;
      description: string;
      effectiveDate: string | null;
      endDate: string | null;
    }>;
  }>({
    queryKey: ['/api/accounts', account.accountId, 'sic-codes'],
    enabled: isCheckingAccount
  });

  const sicCodes = sicCodesData?.sicCodes || [];

  const renderTypeSpecificDetails = () => {
    switch (account.accountType) {
      case 'mortgage':
        return (
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Original Loan Amount</Typography>
              <Typography variant="body1" fontWeight="500">
                {account.creditLimit ? formatCurrency(account.creditLimit) : '—'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Interest Rate</Typography>
              <Typography variant="body1" fontWeight="500">
                {account.interestRate ? formatPercentage(account.interestRate) : '—'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Loan Type</Typography>
              <Typography variant="body1">
                {getProductName(account)}
              </Typography>
            </Grid>
          </Grid>
        );

      case 'heloc':
        return (
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Total Credit Limit</Typography>
              <Typography variant="body1" fontWeight="500">
                {account.creditLimit ? formatCurrency(account.creditLimit) : '—'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Available Credit</Typography>
              <Typography variant="body1" fontWeight="500" color="primary.main">
                {account.availableBalance ? formatCurrency(account.availableBalance) : '—'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Interest Rate</Typography>
              <Typography variant="body1" fontWeight="500">
                {account.interestRate ? formatPercentage(account.interestRate) : '—'}
              </Typography>
            </Grid>
          </Grid>
        );

      case 'credit_card':
        return (
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Credit Limit</Typography>
              <Typography variant="body1" fontWeight="500">
                {account.creditLimit ? formatCurrency(account.creditLimit) : '—'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Available Credit</Typography>
              <Typography variant="body1" fontWeight="500" color="primary.main">
                {account.availableBalance ? formatCurrency(account.availableBalance) : '—'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">APR</Typography>
              <Typography variant="body1" fontWeight="500">
                {account.interestRate ? formatPercentage(account.interestRate) : '—'}
              </Typography>
            </Grid>
          </Grid>
        );

      case 'cd':
        return (
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Interest Rate</Typography>
              <Typography variant="body1" fontWeight="500">
                {account.interestRate ? formatPercentage(account.interestRate) : '—'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Maturity Date</Typography>
              <Typography variant="body1">
                {account.maturityDate ? formatDate(account.maturityDate) : '—'}
              </Typography>
            </Grid>
          </Grid>
        );

      default:
        return null;
    }
  };

  return (
    <Box>
      {/* Type-Specific Details */}
      {renderTypeSpecificDetails()}

      {/* Debit Cards */}
      {isCheckingAccount && debitCards.length > 0 && (
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="primary.main" fontWeight="600" sx={{ mb: 1 }}>
            Debit Cards ({debitCards.length})
          </Typography>
          {debitCards.map((card) => {
            const cardBrand = getCardBrandConfig(card.cardBrand);
            const statusConfig = CARD_STATUS_COLORS[card.cardStatus as keyof typeof CARD_STATUS_COLORS] || CARD_STATUS_COLORS.active;

            return (
              <Box key={card.cardId} sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1 }}>
                <Typography variant="body2" sx={{ color: cardBrand.color, fontWeight: 500 }}>
                  {cardBrand.name}
                </Typography>
                <Typography variant="body2" fontFamily="Roboto Mono">
                  {formatCardNumber(card.lastFourDigits)}
                </Typography>
                <Chip
                  label={getCardStatusLabel(card.cardStatus)}
                  size="small"
                  color={statusConfig.chip}
                  sx={{ height: 20 }}
                />
                <Link
                  component="button"
                  variant="body2"
                  onClick={() => onOpenCardModal(card, account)}
                  sx={{ ml: 'auto' }}
                >
                  View Limits →
                </Link>
              </Box>
            );
          })}
        </Box>
      )}

      {/* SIC Codes */}
      {isCheckingAccount && sicCodes.length > 0 && (
        <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="body2" color="primary.main" fontWeight="600" sx={{ mb: 1 }}>
            Account Services ({sicCodes.length})
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {sicCodes.map((sic) => (
              <Chip
                key={sic.sicCode}
                label={sic.description}
                size="small"
                variant="outlined"
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
