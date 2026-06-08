import { useState } from "react";
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Skeleton,
  useTheme,
  alpha
} from "@mui/material";
import {
  TrendingUp,
  ArrowUpward,
  ArrowDownward
} from "@mui/icons-material";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Area,
  AreaChart
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { useDateFormatter } from "@/lib/dateFormatters";

interface BalanceHistoryData {
  trendData: Array<{
    month: string;
    date: string;
    balance: number;
  }>;
}

interface AccountBalanceTrendsProps {
  accountId: string;
  currentBalance?: number;
}

export default function AccountBalanceTrends({ accountId, currentBalance }: AccountBalanceTrendsProps) {
  const theme = useTheme();
  const [timeRange, setTimeRange] = useState<'monthly' | 'quarterly' | 'ytd'>('ytd');
  const { formatCurrency } = useDateFormatter();

  const { data, isLoading } = useQuery<BalanceHistoryData>({
    queryKey: [`/api/accounts/${accountId}/balance-history`],
    enabled: !!accountId
  });

  // Patch chart data: if all API balances are 0 but we know the current balance, use it
  const patchedTrendData = (() => {
    if (!data?.trendData || data.trendData.length === 0) return [];
    const trendData = data.trendData.map(d => ({ ...d }));
    if (currentBalance && currentBalance > 0 && trendData.every(d => d.balance === 0)) {
      trendData[trendData.length - 1].balance = currentBalance;
    }
    return trendData;
  })();

  const getTrendData = () => {
    switch (timeRange) {
      case 'monthly':
        return patchedTrendData.slice(-2);
      case 'quarterly':
        return patchedTrendData.slice(-3);
      case 'ytd':
      default:
        return patchedTrendData;
    }
  };

  const calculateGrowth = () => {
    const trendData = getTrendData();
    if (!trendData || trendData.length < 2) return 0;
    const start = trendData.at(0)?.balance;
    const end = trendData.at(-1)?.balance;

    // Guard against division by zero
    if (!end || end === 0 || !start || start === 0) {
      return 0;
    }

    return ((end - start) / start) * 100;
  };

  const growth = calculateGrowth();
  const trendData = getTrendData();

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Skeleton variant="text" width={200} height={32} />
        <Skeleton variant="rectangular" height={200} />
      </Box>
    );
  }

  if (!data?.trendData || data.trendData.length === 0) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
        <Typography variant="body2" color="text.secondary">
          No balance history available
        </Typography>
        {currentBalance !== undefined && (
          <Typography variant="body1" sx={{ fontFamily: 'Roboto Mono', mt: 1 }}>
            Current Balance: {formatCurrency(currentBalance)}
          </Typography>
        )}
      </Box>
    );
  }

  const displayBalance = currentBalance ?? (data.trendData.length > 0 ? data.trendData[data.trendData.length - 1].balance : 0);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <TrendingUp fontSize="small" color="secondary" />
        Balance History (12 Months)
      </Typography>

      <Typography variant="body2" color="text.secondary">Current Balance</Typography>
      <Typography variant="h5" fontWeight="400" sx={{ mb: 1.5 }}>
        {formatCurrency(displayBalance)}
      </Typography>

      <Box sx={{ flex: 1, minHeight: 180 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorAccountBalance" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={theme.palette.primary.main} stopOpacity={0.8} />
                <stop offset="95%" stopColor={theme.palette.primary.main} stopOpacity={0.1} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={alpha(theme.palette.divider, 0.3)} />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 10 }}
              stroke={theme.palette.text.secondary}
            />
            <YAxis
              tick={{ fontSize: 10 }}
              stroke={theme.palette.text.secondary}
              tickFormatter={(value) => value >= 1000 ? `${(value / 1000).toFixed(0)}k` : `$${value.toFixed(0)}`}
            />
            <Tooltip
              formatter={(value: number) => [formatCurrency(value), 'Balance']}
              contentStyle={{
                backgroundColor: theme.palette.background.paper,
                border: `1px solid ${theme.palette.divider}`
              }}
            />
            <Area
              type="monotone"
              dataKey="balance"
              stroke={theme.palette.primary.main}
              fillOpacity={1}
              fill="url(#colorAccountBalance)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>

      <ToggleButtonGroup
        value={timeRange}
        exclusive
        onChange={(_e, value) => value && setTimeRange(value)}
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
        <ToggleButton value="monthly">Month</ToggleButton>
        <ToggleButton value="quarterly">Quarter</ToggleButton>
        <ToggleButton value="ytd">Year</ToggleButton>
      </ToggleButtonGroup>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 1 }}>
        {growth > 0 && (
          <ArrowUpward fontSize="small" color="primary" />
        )}
        {growth < 0 && (
          <ArrowDownward fontSize="small" color="error" />
        )}
        <Typography variant="body2" color={ growth > 0 ? "primary.main" : growth === 0 ? "textPrimary" : "error" }>
          {/* Note: toFixed already adds a negative sign in front of the number */}
          {growth > 0 ? '+' : ''}{growth === 0 ? "No Change" : `${growth.toFixed(1)}%`}
        </Typography> 
      </Box>
    </Box>
  );
}
