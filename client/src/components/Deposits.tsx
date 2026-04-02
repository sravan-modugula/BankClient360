import { useState } from "react";
import { 
  Card, 
  CardContent, 
  Box, 
  Typography, 
  Grid,
  ToggleButtonGroup,
  ToggleButton,
  List,
  ListItem,
  ListItemText,
  Chip,
  Divider,
  Skeleton,
  useTheme,
  alpha
} from "@mui/material";
import {
  TrendingUp,
  DonutLarge,
  Receipt,
  AccountBalance,
  Savings,
  AccountBalanceWallet,
  ArrowUpward,
  ArrowDownward
} from "@mui/icons-material";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  ComposedChart
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useDateFormatter } from '@/lib/dateFormatters';

interface DepositAnalytics {
  totalBalance: number;
  weightedAverageBalance: number;
  balanceByType: {
    checking: number;
    savings: number;
    cd: number;
  };
  trendData: {
    month: string;
    date: string;
    balance: number;
    checking: number;
    savings: number;
    cd: number;
    weightedAverage: number;
    weightedAvgChecking: number;
    weightedAvgSavings: number;
    weightedAvgCD: number;
  }[];
  recentTransactions: {
    accountType: string;
    date: string;
    type: string;
    description: string;
    amount: number;
    balance: number;
  }[];
}

interface DepositsProps {
  customerId: number;
}

export default function Deposits({ customerId }: DepositsProps) {
  const theme = useTheme();
  const [timeRange, setTimeRange] = useState<'monthly' | 'quarterly' | 'ytd'>('ytd');
  
  // Use consistent PST date formatting
  const { formatCurrency, formatDate } = useDateFormatter();

  const { data: analytics, isLoading } = useQuery<DepositAnalytics>({
    queryKey: [`/api/customers/${customerId}/deposit-analytics`],
    enabled: !!customerId && Number.isFinite(customerId)
  });

  // Filter trend data based on time range
  const getTrendData = () => {
    if (!analytics?.trendData) return [];
    
    const data = [...analytics.trendData];
    switch (timeRange) {
      case 'monthly':
        return data.slice(-1);
      case 'quarterly':
        return data.slice(-3);
      case 'ytd':
      default:
        return data;
    }
  };

  // Prepare pie chart data
  const getPieData = () => {
    if (!analytics?.balanceByType) return [];
    
    const { checking, savings, cd } = analytics.balanceByType;
    const total = checking + savings + cd;
    
    return [
      { 
        name: 'Checking', 
        value: checking, 
        percentage: total > 0 ? ((checking / total) * 100).toFixed(0) : '0'
      },
      { 
        name: 'Savings', 
        value: savings, 
        percentage: total > 0 ? ((savings / total) * 100).toFixed(0) : '0'
      },
      { 
        name: 'CD', 
        value: cd, 
        percentage: total > 0 ? ((cd / total) * 100).toFixed(0) : '0'
      }
    ].filter(item => item.value > 0);
  };

  const COLORS = {
    checking: theme.palette.primary.main,
    savings: theme.palette.secondary.main,
    cd: theme.palette.primary.main
  };

  const getAccountIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'checking':
        return <AccountBalance fontSize="small" />;
      case 'savings':
        return <Savings fontSize="small" />;
      case 'cd':
        return <AccountBalanceWallet fontSize="small" />;
      default:
        return <AccountBalance fontSize="small" />;
    }
  };

  const calculateGrowth = () => {
    if (!analytics?.trendData || analytics.trendData.length < 2) return 0;
    const current = analytics.trendData[analytics.trendData.length - 1].balance;
    const previous = analytics.trendData[analytics.trendData.length - 2].balance;
    
    // Guard against division by zero
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    
    return ((current - previous) / previous) * 100;
  };

  const growth = calculateGrowth();

  if (isLoading) {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountBalance color="primary" />
            Deposits Overview
          </Typography>
          <Skeleton variant="text" width={150} height={32} />
        </Box>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card elevation={2}>
              <CardContent>
                <Skeleton variant="rectangular" height={350} />
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card elevation={2}>
              <CardContent>
                <Skeleton variant="rectangular" height={350} />
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card elevation={2}>
              <CardContent>
                <Skeleton variant="rectangular" height={350} />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>
    );
  }

  // Check if user has no deposit accounts
  const hasDeposits = analytics && analytics.totalBalance > 0;

  if (!hasDeposits && !isLoading) {
    return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AccountBalance color="primary" />
            Deposits Overview
          </Typography>
        </Box>
        <Divider sx={{ mb: 3 }} />
        <Card elevation={2}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Deposit Accounts Found
            </Typography>
            <Typography variant="body2" color="text.secondary">
              This customer does not have any active checking, savings, or CD accounts.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AccountBalance color="primary" />
          Deposits Overview
        </Typography>
        <Typography variant="h5" fontWeight="400">
          Total: {formatCurrency(analytics?.totalBalance || 0)}
        </Typography>
      </Box>
      <Divider sx={{ mb: 3 }} />

      {/* Three Cards */}
      <Grid container spacing={3} sx={{ width: '100%', display: 'flex', alignItems: 'stretch' }}>
        {/* Card 1: Balance Trends */}
        <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', flex: '1 1 0' }}>
          <Card elevation={2} sx={{ height: 450, width: '100%', flex: 1 }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <TrendingUp color="secondary" />
                Balance Trends
              </Typography>
              
              <Typography variant="body2" color="text.secondary">Total Deposits</Typography>
              <Typography variant="h4" fontWeight="400" sx={{ mb: 2 }}>
                {formatCurrency(analytics?.totalBalance || 0)}
              </Typography>

              <Box sx={{ flex: 1, minHeight: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={getTrendData()} margin={{ top: 10, right: 30, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 10 }}
                      stroke={theme.palette.text.secondary}
                    />
                    <YAxis 
                      yAxisId="left"
                      tick={{ fontSize: 10 }}
                      stroke={theme.palette.text.secondary}
                      tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                    />
                    <YAxis 
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 10 }}
                      stroke={theme.palette.text.secondary}
                      tickFormatter={(value) => `${value.toFixed(1)}%`}
                    />
                    <Tooltip 
                      formatter={(value: number, name: string) => {
                        if (name === 'balance') {
                          return [formatCurrency(value), 'Total Balance'];
                        } else if (name === 'weightedAverage') {
                          return [`${value.toFixed(4)}%`, 'Overall Weighted Avg'];
                        }
                        return [value, name];
                      }}
                      contentStyle={{ 
                        backgroundColor: theme.palette.background.paper,
                        border: `1px solid ${theme.palette.divider}`
                      }}
                    />
                    <Legend 
                      wrapperStyle={{ fontSize: '9px' }}
                      formatter={(value) => {
                        if (value === 'balance') return 'Balance';
                        if (value === 'weightedAverage') return 'Overall %';
                        return value;
                      }}
                    />
                    <Area 
                      yAxisId="left"
                      type="monotone" 
                      dataKey="balance" 
                      name="balance"
                      stroke={theme.palette.primary.main} 
                      fillOpacity={1}
                      fill="url(#colorBalance)" 
                    />
                    <Line 
                      yAxisId="right"
                      type="monotone" 
                      dataKey="weightedAverage"
                      name="weightedAverage"
                      stroke="#00796b"
                      strokeWidth={2}
                      dot={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </Box>

              <ToggleButtonGroup
                value={timeRange}
                exclusive
                onChange={(e, value) => value && setTimeRange(value)}
                size="small"
                fullWidth
                sx={{ 
                  mt: 1.5,
                  '& .MuiToggleButton-root': {
                    py: 0.25,
                    fontSize: '0.75rem',
                    minHeight: '24px'
                  }
                }}
              >
                <ToggleButton value="monthly" data-testid="button-monthly">Monthly</ToggleButton>
                <ToggleButton value="quarterly" data-testid="button-quarterly">Quarterly</ToggleButton>
                <ToggleButton value="ytd" data-testid="button-ytd">YTD</ToggleButton>
              </ToggleButtonGroup>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
                {growth >= 0 ? (
                  <ArrowUpward fontSize="small" color="primary" />
                ) : (
                  <ArrowDownward fontSize="small" color="primary" />
                )}
                <Typography variant="body2" color="primary.main">
                  {growth >= 0 ? '+' : ''}{growth.toFixed(1)}% MoM
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 2: Product Mix */}
        <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', flex: '1 1 0' }}>
          <Card elevation={2} sx={{ height: 450, width: '100%', flex: 1 }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <DonutLarge color="secondary" />
                Product Mix
              </Typography>

              <Box sx={{ flex: 0, minHeight: 180, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={getPieData()}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={70}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {getPieData().map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[entry.name.toLowerCase() as keyof typeof COLORS]} 
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </Box>

              <Divider sx={{ mt: 1, mb: 1.5 }} />

              <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 0.75, justifyContent: 'center' }}>
                {getPieData().map((item) => (
                  <Box 
                    key={item.name}
                    sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      py: 0.25,
                      px: 0.5
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      <Box 
                        sx={{ 
                          width: 10, 
                          height: 10, 
                          borderRadius: '50%', 
                          backgroundColor: COLORS[item.name.toLowerCase() as keyof typeof COLORS],
                          flexShrink: 0
                        }} 
                      />
                      <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                        {item.name}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <Typography variant="body2" fontWeight="400" sx={{ fontSize: '0.875rem' }}>
                        {formatCurrency(item.value)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.75rem' }}>
                        ({item.percentage}%)
                      </Typography>
                    </Box>
                  </Box>
                ))}
              </Box>

              <Divider sx={{ mt: 'auto', mb: 1.5 }} />

              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', px: 0.5 }}>
                <Typography variant="body1" fontWeight="400" color="text.secondary">
                  Total:
                </Typography>
                <Typography variant="h6" fontWeight="400" color="primary">
                  {formatCurrency(analytics?.totalBalance || 0)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Card 3: Recent Activity */}
        <Grid size={{ xs: 12, md: 4 }} sx={{ display: 'flex', flex: '1 1 0' }}>
          <Card elevation={2} sx={{ height: 450, width: '100%', flex: 1 }}>
            <CardContent sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Receipt color="secondary" />
                Recent Activity
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Latest Transactions
              </Typography>

              <List sx={{ flex: 1, overflow: 'auto', py: 0 }}>
                {analytics?.recentTransactions.map((transaction, index) => (
                  <Box key={index}>
                    <ListItem 
                      sx={{ 
                        px: 0,
                        py: 1.5,
                        '&:hover': {
                          bgcolor: 'action.hover',
                          borderRadius: 1
                        }
                      }}
                      data-testid={`transaction-${index}`}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, width: '100%' }}>
                        <Box sx={{ color: 'action.active' }}>
                          {getAccountIcon(transaction.accountType)}
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 0 }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              <Typography variant="body2" fontWeight="400">
                                {transaction.accountType.charAt(0).toUpperCase() + transaction.accountType.slice(1)}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {transaction.description}
                              </Typography>
                            </Box>
                            <Box sx={{ textAlign: 'right' }}>
                              <Typography 
                                variant="body2" 
                                fontWeight="400"
                                color="primary.main"
                              >
                                {transaction.amount >= 0 ? '+' : ''}{formatCurrency(Math.abs(transaction.amount))}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(transaction.date)}
                              </Typography>
                            </Box>
                          </Box>
                        </Box>
                      </Box>
                    </ListItem>
                    {index < analytics.recentTransactions.length - 1 && <Divider />}
                  </Box>
                ))}
              </List>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}