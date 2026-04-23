import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Grid,
  Radio,
  Link
} from '@mui/material';
import {
  CreditCard,
  Home,
  Savings,
  CreditScore,
  Timeline,
  Assignment,
  AttachMoney,
  TrendingUp,
  PhoneAndroid,
  Payment,
  CameraAlt,
  Inventory,
  LocalAtm,
  Business,
  Lock
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import { useDateFormatter } from '@/lib/dateFormatters';
import {
  formatCardNumber,
  getCardStatusLabel,
  getCardBrandConfig,
  getCardStatusConfig,
  isCardActive
} from '@/lib/debitCardConstants';
import type { DebitCardWithLimitProfile } from '@shared/schema';

interface Account {
  accountId: number;
  accountNumber: string;
  accountType: string;
  accountStatus: string;
  balance: string;
  availableBalance?: string | null;
  interestRate?: string | null;
  openedDate: string;
  maturityDate?: string | null;
  productName?: string | null;
  jackHenryAccountId?: string | null;
}

interface AccountCardProps {
  account: Account;
  isSelected: boolean;
  onRadioChange: (accountId: number) => void;
  onCardClick: (card: DebitCardWithLimitProfile, account: Account) => void;
  showRadio: boolean;
}

export default function AccountCard({
  account,
  isSelected,
  onRadioChange,
  onCardClick,
  showRadio
}: AccountCardProps) {
  const { formatCurrency, formatPercentage, formatDate } = useDateFormatter();

  // Fetch debit cards for checking accounts (at top level to comply with Hook rules)
  const isCheckingAccount = account.accountType === 'checking' || account.accountType === 'deposit checking' || account.accountType === 'business_checking';
  const { data: cardsData } = useQuery<{ cards: DebitCardWithLimitProfile[] }>({
    queryKey: ['/api/accounts', account.accountId, 'debit-cards'],
    enabled: isCheckingAccount
  });

  const debitCards = cardsData?.cards || [];

  // Fetch SIC codes for checking accounts
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

  const getProductName = (acc: Account): string => {
    if (acc.productName) return acc.productName;
    
    const typeNames: Record<string, string> = {
      checking: 'Checking Account',
      savings: 'Savings Account',
      money_market: 'Money Market Account',
      cd: 'Certificate of Deposit',
      loan: 'Loan Account',
      credit_card: 'Credit Card',
      business_checking: 'Business Checking'
    };
    return typeNames[acc.accountType] || acc.accountType;
  };

  const getAccountIcon = (accountType: string) => {
    const iconProps = { sx: { fontSize: 32, color: 'primary.main' } };
    switch (accountType) {
      case 'checking':
      case 'business_checking':
        return <Home {...iconProps} />;
      case 'savings':
        return <Savings {...iconProps} />;
      case 'money_market':
        return <TrendingUp {...iconProps} />;
      case 'cd':
        return <Timeline {...iconProps} />;
      case 'loan':
        return <Assignment {...iconProps} />;
      case 'credit_card':
        return <CreditScore {...iconProps} />;
      default:
        return <AttachMoney {...iconProps} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'primary';
      case 'inactive':
        return 'default';
      case 'closed':
        return 'primary';
      case 'frozen':
        return 'secondary';
      default:
        return 'default';
    }
  };

  const renderAccountTypeSpecificDetails = () => {
    switch (account.accountType) {
      case 'cd':
        return (
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Principal Balance</Typography>
              <Typography variant="h6" fontWeight="400" color="primary.main">
                {formatCurrency(account.balance)}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Interest Rate</Typography>
              <Typography variant="h6" color="primary.main">
                {account.interestRate ? formatPercentage(account.interestRate) : '—'}
              </Typography>
            </Grid>
            <Grid size={{ xs: 6, md: 3 }}>
              <Typography variant="body2" color="text.secondary">Maturity Date</Typography>
              <Typography variant="h6">
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

  const getSicIcon = (description: string) => {
    const iconProps = { sx: { fontSize: 20, color: 'primary.main' } };
    
    const desc = description.toLowerCase();
    if (desc.includes('online banking')) return <PhoneAndroid {...iconProps} />;
    if (desc.includes('bill pay')) return <Payment {...iconProps} />;
    if (desc.includes('remote capture') || desc.includes('rdc')) return <CameraAlt {...iconProps} />;
    if (desc.includes('smart safe')) return <Inventory {...iconProps} />;
    if (desc.includes('merchant')) return <Business {...iconProps} />;
    if (desc.includes('lock box')) return <Lock {...iconProps} />;
    if (desc.includes('cash')) return <LocalAtm {...iconProps} />;
    
    return <AttachMoney {...iconProps} />;
  };

  const renderSicCodesSummary = () => {
    if (!isCheckingAccount || sicCodes.length === 0) {
      return null;
    }

    // Adaptive grid sizing based on number of services
    const getGridSize = () => {
      const count = sicCodes.length;
      if (count === 1) {
        return { xs: 6, sm: 4, md: 3 }; // Single service: compact
      } else if (count === 2) {
        return { xs: 6, sm: 4, md: 3 }; // Two services: compact
      } else if (count <= 4) {
        return { xs: 6, sm: 4, md: 3 }; // 3-4 services: 4 columns on desktop
      } else {
        return { xs: 4, sm: 3, md: 2 }; // 5+ services: 6 columns on desktop for max density
      }
    };

    const gridSize = getGridSize();

    return (
      <Box 
        sx={{ 
          mt: 2, 
          pt: 2, 
          pb: 2,
          px: 2,
          mx: -2,
          borderTop: 1, 
          borderColor: 'divider',
          bgcolor: theme => `${theme.palette.primary.main}06`,
          borderRadius: 1
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <Business sx={{ fontSize: 20, color: 'primary.main' }} />
          <Typography variant="body2" color="primary.main" fontWeight="600">
            Account Services ({sicCodes.length})
          </Typography>
        </Box>
        <Grid 
          container 
          spacing={1}
        >
          {sicCodes.map((sic) => (
            <Grid 
              key={sic.sicCode} 
              size={gridSize}
              data-testid={`grid-sic-${sic.sicCode}-${account.accountId}`}
            >
              <Box
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  py: 1,
                  px: 0.75,
                  border: 1,
                  borderColor: 'divider',
                  borderRadius: 0.75,
                  bgcolor: 'background.paper',
                  height: '100%',
                  minHeight: 56,
                  transition: 'all 0.15s ease-in-out',
                  '&:hover': {
                    borderColor: 'primary.main',
                    bgcolor: theme => `${theme.palette.primary.main}04`,
                    boxShadow: '0 1px 3px rgba(0,0,0,0.08)'
                  }
                }}
              >
                {getSicIcon(sic.description)}
                <Typography 
                  variant="caption"
                  align="center" 
                  sx={{ 
                    mt: 0.5, 
                    fontWeight: 400, 
                    lineHeight: 1.2,
                    fontSize: '0.6875rem',
                    letterSpacing: '0.01em'
                  }}
                >
                  {sic.description}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>
    );
  };

  const renderDebitCardSummary = () => {
    if (!isCheckingAccount || debitCards.length === 0) {
      return null;
    }

    const activeCards = debitCards.filter((c: any) => isCardActive(c.cardStatus));
    const primaryCard = activeCards[0] || debitCards[0];
    const cardBrand = getCardBrandConfig(primaryCard.cardBrand);
    const statusConfig = getCardStatusConfig(primaryCard.cardStatus);

    return (
      <Box 
        sx={{ 
          mt: 2, 
          pt: 2, 
          pb: 2,
          px: 2,
          mx: -2,
          borderTop: 1, 
          borderColor: 'divider',
          bgcolor: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
          borderRadius: 1
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
          <CreditCard sx={{ fontSize: 20, color: 'text.primary' }} />
          <Typography variant="body2" color="text.primary" fontWeight="600">
            Debit Cards ({debitCards.length})
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
          <Typography
            variant="body2"
            component="span"
            fontWeight="400"
            sx={{ color: cardBrand.color }}
          >
            {cardBrand.name}
          </Typography>
          <Typography variant="body2" component="span" fontFamily="Roboto Mono">
            {formatCardNumber(primaryCard.lastFourDigits)}
          </Typography>
          <Chip
            label={getCardStatusLabel(primaryCard.cardStatus)}
            size="small"
            color={statusConfig.chip}
            sx={{ height: 20 }}
          />
          {primaryCard.limitProfile?.profileName && (
            <Chip
              label={primaryCard.limitProfile.profileName}
              size="small"
              variant="outlined"
              sx={{ height: 20 }}
            />
          )}
          <Link
            component="button"
            variant="body2"
            onClick={() => onCardClick(primaryCard, account)}
            sx={{ ml: 'auto', textDecoration: 'none' }}
            data-testid={`link-view-card-${account.accountId}`}
          >
            View Limits & Details →
          </Link>
        </Box>
        {debitCards.length > 1 && (
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            +{debitCards.length - 1} additional {debitCards.length === 2 ? 'card' : 'cards'} on this account
          </Typography>
        )}
      </Box>
    );
  };

  return (
    <Card 
      variant="outlined" 
      sx={{ 
        mb: 2,
        ...(isSelected && {
          elevation: 4,
          bgcolor: theme => `${theme.palette.primary.main}08`,
          borderColor: 'primary.main'
        })
      }}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {showRadio && (
              <Radio
                checked={isSelected}
                onChange={() => onRadioChange(account.accountId)}
                value={account.accountId}
                name="account-selection"
                inputProps={{ 
                  'aria-label': `Select ${getProductName(account)} account ${account.accountNumber.slice(-4)}`
                }}
                data-testid={`radio-account-${account.accountId}`}
              />
            )}
            {getAccountIcon(account.accountType)}
            <Box>
              <Typography variant="h6" fontWeight="400">
                {getProductName(account)}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                ****{account.accountNumber.slice(-4)} • Opened {formatDate(account.openedDate)}
              </Typography>
            </Box>
          </Box>
          <Chip 
            label={account.accountStatus.toUpperCase()}
            color={getStatusColor(account.accountStatus) as any}
            size="small"
          />
        </Box>

        {renderAccountTypeSpecificDetails()}

        {/* SIC Codes - Only for checking accounts */}
        {renderSicCodesSummary()}

        {/* Debit Card Summary - Only for checking accounts */}
        {renderDebitCardSummary()}
      </CardContent>
    </Card>
  );
}
