import { useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Grid,
  Divider,
  useTheme,
  Skeleton,
  Alert,
  LinearProgress,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  Computer,
  AccountBalance,
  AccountBalanceWallet,
  LocalAtm,
  ReceiptLong,
  Description,
  CreditCard,
  Inbox,
  SwapHoriz,
  FlashOn,
  Send
} from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import type { ClientEngagementDTO } from '@shared/contracts';

interface ClientEngagementProps {
  customerId: number;
}

type ActivityWindow = 30 | 60 | 90;

export default function ClientEngagement({ customerId }: ClientEngagementProps) {
  const theme = useTheme();
  const [days, setDays] = useState<ActivityWindow>(30);

  const {
    data: engagement,
    isLoading,
    error
  } = useQuery<ClientEngagementDTO>({
    queryKey: [`/api/customers/${customerId}/client-engagement`, days],
    queryFn: async () => {
      const res = await fetch(
        `/api/customers/${customerId}/client-engagement?days=${days}`,
        { credentials: 'include' },
      );
      if (!res.ok) throw new Error(`Failed to load client engagement (${res.status})`);
      return res.json();
    },
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
            mb: 2,
            color: theme.palette.text.primary,
            fontWeight: 400
          }}>
            <Computer sx={{ color: theme.palette.primary.main }} />
            Client Engagement
          </Typography>
          <Skeleton variant="text" width="60%" height={24} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="40%" height={24} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" width="100%" height={120} />
        </CardContent>
      </Card>
    );
  }

  if (error || !engagement) {
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
            mb: 2,
            color: theme.palette.text.primary,
            fontWeight: 400
          }}>
            <Computer sx={{ color: theme.palette.primary.main }} />
            Client Engagement
          </Typography>
          <Alert severity="info" data-testid="alert-client-engagement-error">
            Client engagement data not available
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const hasOnlineBanking = !!engagement.loginId;

  const activityItems = [
    { label: 'ACH', count: engagement.activity.ach, icon: AccountBalanceWallet },
    { label: 'Cash Withdrawal', count: engagement.activity.cash_withdrawal, icon: LocalAtm },
    { label: 'Check Deposit', count: engagement.activity.check_deposit, icon: ReceiptLong },
    { label: 'Check Payment', count: engagement.activity.check_payment, icon: Description },
    { label: 'Debit Card Payment', count: engagement.activity.debit_card_payment, icon: CreditCard },
    { label: 'Deposit', count: engagement.activity.deposit, icon: AccountBalance },
    { label: 'Lockbox', count: engagement.activity.lockbox, icon: Inbox },
    { label: 'Transfer', count: engagement.activity.transfer, icon: SwapHoriz },
    { label: 'Wire', count: engagement.activity.wire, icon: FlashOn },
    { label: 'Zelle', count: engagement.activity.zelle, icon: Send }
  ];

  const totalActivity = activityItems.reduce((sum, item) => sum + item.count, 0);

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
          mb: 2,
          color: theme.palette.text.primary,
          fontWeight: 400
        }}>
          <Computer sx={{ color: theme.palette.primary.main }} />
          Client Engagement
        </Typography>

        {/* Login Information - Clean Stats Bar Style. Hidden when no online banking row. */}
        {/*hasOnlineBanking && (
          <Box sx={{
            display: 'flex',
            gap: 3,
            mb: 3,
            pb: 2,
            borderBottom: `1px solid ${theme.palette.divider}`,
            flexWrap: 'wrap'
          }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Computer sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
              <Typography variant="body2" color="text.secondary" data-testid="text-login-id">
                Login ID: <strong>{engagement.loginId}</strong>
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary" data-testid="text-last-login">
                Last Login: <strong>{engagement.lastLoginAt || 'Never'}</strong>
              </Typography>
            </Box>
          </Box>
        )*/}

        {/* Activity window toggle + metric bars */}
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400 }}>
              {engagement.days}-Day Activity Summary
            </Typography>
            <ToggleButtonGroup
              value={days}
              exclusive
              size="small"
              onChange={(_e, value) => {
                if (value !== null) setDays(value as ActivityWindow);
              }}
              aria-label="activity window"
            >
              <ToggleButton value={30} data-testid="toggle-days-30">30d</ToggleButton>
              <ToggleButton value={60} data-testid="toggle-days-60">60d</ToggleButton>
              <ToggleButton value={90} data-testid="toggle-days-90">90d</ToggleButton>
            </ToggleButtonGroup>
          </Box>
          {totalActivity === 0 ? (
            <Box
              sx={{ py: 4, textAlign: 'center' }}
              data-testid="text-engagement-empty"
            >
              <Typography variant="body2" color="text.secondary">
                No transactions in the last {engagement.days} days
              </Typography>
            </Box>
          ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {(() => {
              const maxCount = Math.max(...activityItems.map(i => i.count), 1);
              return activityItems.map((item, index) => {
                const IconComponent = item.icon;
                const isActive = item.count > 0;
                const percentage = (item.count / maxCount) * 100;
              
              return (
                <Box 
                  key={index}
                  sx={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 2,
                    pb: 1.5,
                    borderBottom: index < activityItems.length - 1 ? `1px solid ${theme.palette.divider}` : 'none'
                  }}
                  data-testid={`card-activity-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 160 }}>
                    <IconComponent sx={{ 
                      fontSize: 20, 
                      color: isActive ? theme.palette.primary.main : theme.palette.text.disabled
                    }} />
                    <Typography 
                      variant="body2" 
                      sx={{ 
                        fontWeight: 400,
                        color: theme.palette.text.primary
                      }}
                      data-testid={`text-activity-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                    >
                      {item.label}
                    </Typography>
                  </Box>
                  
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      fontWeight: 400,
                      minWidth: 40,
                      textAlign: 'right',
                      color: isActive ? theme.palette.primary.main : theme.palette.text.disabled
                    }}
                    data-testid={`text-activity-count-${item.label.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    {item.count}
                  </Typography>
                  
                  <Box sx={{ flex: 1, minWidth: 100 }}>
                    <LinearProgress 
                      variant="determinate" 
                      value={percentage}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: theme.palette.action.hover,
                        '& .MuiLinearProgress-bar': {
                          backgroundColor: isActive ? theme.palette.primary.main : theme.palette.action.disabled,
                          borderRadius: 4
                        }
                      }}
                    />
                  </Box>
                </Box>
              );
              });
            })()}
          </Box>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}