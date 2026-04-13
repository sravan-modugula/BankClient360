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
  IconButton,
  Button,
  Tabs,
  Tab,
  Grid,
  Divider,
  Radio,
  RadioGroup,
  FormControlLabel,
  Link
} from '@mui/material';
import { 
  AccountBalance, 
  CreditCard, 
  TrendingUp, 
  Visibility,
  MoreVert,
  Home,
  Savings,
  CreditScore,
  Timeline,
  Assignment,
  AttachMoney
} from '@mui/icons-material';
import { useState, useEffect, useRef } from 'react';
import { useDateFormatter } from '@/lib/dateFormatters';
import DebitCardDetailModal from './DebitCardDetailModal';
import AccountCard from './AccountCard';
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

interface AccountSummaryProps {
  accounts: Account[];
  onViewAccount?: (accountId: string) => void;
  selectedAccountId?: number | null;
  onAccountSelect?: (accountId: number | null, accountLabel: string) => void;
}

export default function AccountSummary({ accounts, onViewAccount, selectedAccountId = null, onAccountSelect }: AccountSummaryProps) {
  const [activeTab, setActiveTab] = useState(0);
  const prevTabRef = useRef(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedCard, setSelectedCard] = useState<DebitCardWithLimitProfile | null>(null);
  const [selectedAccountForModal, setSelectedAccountForModal] = useState<Account | null>(null);
  
  // Use consistent PST date formatting
  const { formatCurrency, formatPercentage, formatDate } = useDateFormatter();

  // Reset account selection when tab changes (not on initial render)
  useEffect(() => {
    if (prevTabRef.current !== activeTab) {
      prevTabRef.current = activeTab;
      if (onAccountSelect) {
        onAccountSelect(null, 'All Accounts');
      }
    }
  }, [activeTab]);

  const getAccountIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'checking':
        return <Home />;
      case 'savings':
        return <Savings />;
      case 'mortgage':
        return <Home />;
      case 'heloc':
        return <Timeline />;
      case 'credit_card':
        return <CreditCard />;
      case 'cd':
        return <Assignment />;
      default:
        return <AccountBalance />;
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

  // Group accounts by type
  const accountTypes = [
    { key: 'checking', label: 'Checking', icon: <Home /> },
    { key: 'savings', label: 'Savings', icon: <Savings /> },
    { key: 'mortgage', label: 'Mortgage', icon: <Home /> },
    { key: 'heloc', label: 'HELOC', icon: <Timeline /> },
    { key: 'credit_card', label: 'Credit Cards', icon: <CreditCard /> },
    { key: 'cd', label: 'Certificates', icon: <Assignment /> }
  ];

  const getAccountsByType = (type: string) => {
    return accounts.filter(account => account.accountType === type);
  };

  const isDebtAccount = (type: string) => {
    return ['mortgage', 'heloc', 'credit_card'].includes(type);
  };

  const getTotalBalance = () => {
    return accounts.reduce((total, account) => {
      const balance = parseFloat(account.balance) || 0;
      // For debt accounts, don't add to total balance (mortgage, credit cards, HELOC)
      if (isDebtAccount(account.accountType)) {
        return total;
      }
      return total + balance;
    }, 0);
  };

  const getTermLength = (account: Account) => {
    if (account.accountSubtype?.includes('month')) {
      return account.accountSubtype.replace('_cd', '').replace('_', ' ').toUpperCase();
    }
    return 'Standard Term';
  };

  const renderAccountTypeSpecificDetails = (account: Account) => {
    switch (account.accountType) {
      case 'mortgage':
        return (
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Current Balance</Typography>
              <Typography variant="h6" fontWeight="400" color="primary.main">
                {formatCurrency(account.balance)}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Original Loan Amount</Typography>
              <Typography variant="h6">
                {account.creditLimit ? formatCurrency(account.creditLimit) : '—'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Interest Rate</Typography>
              <Typography variant="h6">
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
              <Typography variant="body2" color="text.secondary">Amount Drawn</Typography>
              <Typography variant="h6" fontWeight="400" color="secondary.main">
                {formatCurrency(account.balance)}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Available Credit</Typography>
              <Typography variant="h6" color="primary.main">
                {account.availableBalance ? formatCurrency(account.availableBalance) : '—'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Total Credit Limit</Typography>
              <Typography variant="h6">
                {account.creditLimit ? formatCurrency(account.creditLimit) : '—'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Interest Rate</Typography>
              <Typography variant="h6">
                {account.interestRate ? formatPercentage(account.interestRate) : '—'}
              </Typography>
            </Grid>
          </Grid>
        );

      case 'credit_card':
        return (
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Current Balance</Typography>
              <Typography variant="h6" fontWeight="400" color="primary.main">
                {formatCurrency(account.balance)}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Available Credit</Typography>
              <Typography variant="h6" color="primary.main">
                {account.availableBalance ? formatCurrency(account.availableBalance) : '—'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Credit Limit</Typography>
              <Typography variant="h6">
                {account.creditLimit ? formatCurrency(account.creditLimit) : '—'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">APR</Typography>
              <Typography variant="h6">
                {account.interestRate ? formatPercentage(account.interestRate) : '—'}
              </Typography>
            </Grid>
          </Grid>
        );

      case 'cd':
        return (
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Principal Amount</Typography>
              <Typography variant="h6" fontWeight="400" color="primary.main">
                {formatCurrency(account.balance)}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Interest Rate</Typography>
              <Typography variant="h6">
                {account.interestRate ? formatPercentage(account.interestRate) : '—'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Term Length</Typography>
              <Typography variant="body1">
                {getTermLength(account)}
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

      default: // checking, savings
        return (
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Current Balance</Typography>
              <Typography variant="h6" fontWeight="400" color="primary.main">
                {formatCurrency(account.balance)}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Available Balance</Typography>
              <Typography variant="h6" color="primary.main">
                {account.availableBalance ? formatCurrency(account.availableBalance) : '—'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Interest Rate</Typography>
              <Typography variant="h6">
                {account.interestRate ? formatPercentage(account.interestRate) : '—'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Account Type</Typography>
              <Typography variant="body1">
                {getProductName(account)}
              </Typography>
            </Grid>
          </Grid>
        );
    }
  };

  const handleRadioChange = (accountId: number) => {
    const account = accounts.find(a => a.accountId === accountId);
    if (account && onAccountSelect) {
      const accountLabel = `${getProductName(account)} ****${account.accountNumber.slice(-4)}`;
      onAccountSelect(accountId, accountLabel);
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

  const renderAccountCard = (account: Account) => {
    return (
      <AccountCard
        key={account.accountId}
        account={account}
        isSelected={selectedAccountId === account.accountId}
        onRadioChange={handleRadioChange}
        onCardClick={handleOpenCardModal}
        showRadio={!!onAccountSelect}
      />
    );
  };

  const availableTypes = accountTypes.filter(type => getAccountsByType(type.key).length > 0);

  return (
    <Card elevation={2}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h5" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountBalance color="secondary" />
            Account Portfolio
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" color="text.secondary" component="div">Total Portfolio Value</Typography>
              <Typography variant="h6" color="primary" data-testid="text-total-balance" component="div">
                {formatCurrency(getTotalBalance())}
              </Typography>
            </Box>
          </Box>
        </Box>

        {availableTypes.length > 0 && (
          <>
            <Tabs 
              value={activeTab} 
              onChange={(e, newValue) => setActiveTab(newValue)}
              variant="scrollable"
              scrollButtons="auto"
              sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
            >
              {availableTypes.map((type, index) => (
                <Tab 
                  key={type.key}
                  icon={type.icon}
                  label={`${type.label} (${getAccountsByType(type.key).length})`}
                  data-testid={`tab-${type.key}`}
                />
              ))}
            </Tabs>

            <Box sx={{ minHeight: 400 }}>
              {availableTypes.map((type, index) => (
                <Box
                  key={type.key}
                  role="tabpanel"
                  hidden={activeTab !== index}
                >
                  {activeTab === index && (
                    <Box>
                      <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                        {type.icon}
                        {type.label} Accounts
                      </Typography>
                      
                      {onAccountSelect && (
                        <Card variant="outlined" sx={{ mb: 2, bgcolor: selectedAccountId === null ? theme => `${theme.palette.primary.main}08` : 'transparent' }}>
                          <CardContent sx={{ py: 1.5 }}>
                            <FormControlLabel
                              value={null}
                              control={
                                <Radio
                                  checked={selectedAccountId === null}
                                  onChange={() => onAccountSelect(null, 'All Accounts')}
                                  inputProps={{ 'aria-label': 'View all accounts transactions' }}
                                  data-testid="radio-all-accounts"
                                />
                              }
                              label={
                                <Typography variant="body1" fontWeight="400">
                                  All Accounts - View All Transactions
                                </Typography>
                              }
                            />
                          </CardContent>
                        </Card>
                      )}
                      
                      <RadioGroup value={selectedAccountId}>
                        {getAccountsByType(type.key).map(renderAccountCard)}
                      </RadioGroup>
                    </Box>
                  )}
                </Box>
              ))}
            </Box>
          </>
        )}

        {availableTypes.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <AccountBalance sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary">
              No Accounts Found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This customer does not have any accounts on file.
            </Typography>
          </Box>
        )}
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