import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Grid,
  Chip,
  useTheme,
  Skeleton,
  Alert
} from '@mui/material';
import { 
  TrendingUp, 
  TrendingDown,
  AccountBalance,
  CreditScore
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import type { RelationshipSummaryDTO } from '@shared/contracts';

interface TotalRelationshipSummaryProps {
  customerId: number;
}

export default function TotalRelationshipSummary({ customerId }: TotalRelationshipSummaryProps) {
  const theme = useTheme();
  
  const { 
    data: summary, 
    isLoading, 
    error 
  } = useQuery<RelationshipSummaryDTO>({
    queryKey: [`/api/customers/${customerId}/relationship-summary`],
    enabled: !!customerId
  });

  if (isLoading) {
    return (
      <Card elevation={2} sx={{ 
        width: '100%', 
        flex: 1, 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column'
      }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" gutterBottom sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            mb: 3,
            color: theme.palette.text.primary,
            fontWeight: 400
          }}>
            <AccountBalance sx={{ color: theme.palette.primary.main }} />
            Total Relationship Summary
          </Typography>
          <Skeleton variant="rectangular" width="100%" height={120} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" width="100%" height={120} />
        </CardContent>
      </Card>
    );
  }

  if (error || !summary) {
    return (
      <Card elevation={2} sx={{ 
        width: '100%', 
        flex: 1, 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column'
      }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Typography variant="h6" gutterBottom sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: 1, 
            mb: 3,
            color: theme.palette.text.primary,
            fontWeight: 400
          }}>
            <AccountBalance sx={{ color: theme.palette.primary.main }} />
            Total Relationship Summary
          </Typography>
          <Alert severity="info" data-testid="alert-relationship-summary-error">
            Relationship summary data not available
          </Alert>
        </CardContent>
      </Card>
    );
  }
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatChange = (amount: number, percent: number) => {
    const isPositive = amount >= 0;
    const TrendIcon = isPositive ? TrendingUp : TrendingDown;
    const color = isPositive ? theme.palette.primary.main : theme.palette.primary.main;
    
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <TrendIcon sx={{ fontSize: 16, color }} />
        <Typography variant="caption" sx={{ color }} data-testid="text-quarter-change">
          {isPositive ? '+' : ''}{formatCurrency(amount)} ({isPositive ? '+' : ''}{percent.toFixed(1)}%)
        </Typography>
      </Box>
    );
  };

  return (
    <Card elevation={2} sx={{ 
      width: '100%', 
      flex: 1, 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column'
    }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" gutterBottom sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1, 
          mb: 3,
          color: theme.palette.text.primary,
          fontWeight: 400
        }}>
          <AccountBalance sx={{ color: theme.palette.primary.main }} />
          Total Relationship Summary
        </Typography>

        <Grid container spacing={3} sx={{ flex: 1 }}>
          {/* Total Deposits */}
          <Grid size={{ xs: 12 }}>
            <Box sx={{ 
              p: 2.5, 
              backgroundColor: theme.palette.background.default, 
              borderRadius: 1, 
              border: `1px solid ${theme.palette.divider}`,
              textAlign: 'center'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                <AccountBalance sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary, fontWeight: 400 }}>
                  Total Deposits
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ 
                color: theme.palette.primary.main, 
                fontWeight: 400,
                mb: 1
              }} data-testid="text-total-deposits">
                {formatCurrency(summary.totalDeposits)}
              </Typography>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mb: 1, display: 'block' }}>
                Quarter over Quarter Change
              </Typography>
              {formatChange(summary.depositsQoQ.amountChange, summary.depositsQoQ.percentChange)}
            </Box>
          </Grid>

          {/* Total Loans */}
          <Grid size={{ xs: 12 }}>
            <Box sx={{ 
              p: 2.5, 
              backgroundColor: theme.palette.background.default, 
              borderRadius: 1, 
              border: `1px solid ${theme.palette.divider}`,
              textAlign: 'center'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1, mb: 1 }}>
                <CreditScore sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
                <Typography variant="subtitle2" sx={{ color: theme.palette.text.secondary, fontWeight: 400 }}>
                  Total Loans
                </Typography>
              </Box>
              <Typography variant="h4" sx={{ 
                color: theme.palette.primary.main, 
                fontWeight: 400,
                mb: 1
              }} data-testid="text-total-loans">
                {formatCurrency(summary.totalLoans)}
              </Typography>
              <Typography variant="caption" sx={{ color: theme.palette.text.secondary, mb: 1, display: 'block' }}>
                Quarter over Quarter Change
              </Typography>
              {formatChange(summary.loansQoQ.amountChange, summary.loansQoQ.percentChange)}
            </Box>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}