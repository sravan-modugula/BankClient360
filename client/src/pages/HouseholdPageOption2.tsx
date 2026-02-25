import {
  Container,
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  LinearProgress
} from '@mui/material';
import {
  FamilyRestroom,
  Business,
  AccountBalance,
  People,
  Person,
  ArrowForward,
  TrendingUp,
  AccountBalanceWallet,
  Note,
  Description
} from '@mui/icons-material';

export default function HouseholdPageOption2() {
  // Mock household data
  const householdData = {
    name: "Miller Holdings Corporation",
    type: "holding_company",
    totalMembers: 5,
    totalAssets: 12500000,
    totalLiabilities: 3200000,
    netWorth: 9300000,
    relationshipManager: "Sarah Johnson",
    establishedDate: "2018-03-15",
    totalAccounts: 7,
    activeDeposits: 3
  };

  const mockMembers = [
    {
      id: '1',
      name: 'Miller Holdings Corporation',
      role: 'Parent Company',
      customerType: 'business',
      totalAssets: 8500000,
      accountsCount: 3,
      ownershipPercentage: 100,
      contributionPercent: 68,
      isPrimary: true
    },
    {
      id: '2',
      name: 'Miller Manufacturing LLC',
      role: 'Subsidiary',
      customerType: 'business',
      totalAssets: 2100000,
      accountsCount: 2,
      ownershipPercentage: 75,
      contributionPercent: 17,
      isPrimary: false
    },
    {
      id: '3',
      name: 'Miller Distribution Inc',
      role: 'Subsidiary',
      customerType: 'business',
      totalAssets: 1900000,
      accountsCount: 2,
      ownershipPercentage: 60,
      contributionPercent: 15,
      isPrimary: false
    }
  ];

  const mockAccounts = [
    { id: 1, type: 'Business Checking', number: '****1234', balance: 450000, owner: 'Miller Holdings Corporation' },
    { id: 2, type: 'Savings', number: '****5678', balance: 2100000, owner: 'Miller Holdings Corporation' },
    { id: 3, type: 'Money Market', number: '****9101', balance: 6000000, owner: 'Miller Holdings Corporation' },
    { id: 4, type: 'Business Checking', number: '****9012', balance: 180000, owner: 'Miller Manufacturing LLC' },
    { id: 5, type: 'Savings', number: '****1121', balance: 1920000, owner: 'Miller Manufacturing LLC' },
    { id: 6, type: 'Business Checking', number: '****3145', balance: 150000, owner: 'Miller Distribution Inc' },
    { id: 7, type: 'Line of Credit', number: '****3456', balance: -500000, owner: 'Miller Holdings Corporation' }
  ];

  const mockDeposits = [
    { type: 'Checking', count: 3, totalBalance: 780000 },
    { type: 'Savings', count: 2, totalBalance: 4020000 },
    { type: 'Money Market', count: 1, totalBalance: 6000000 }
  ];

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getTypeIcon = (type: string) => {
    return type === 'family' ? <FamilyRestroom /> : <Business />;
  };

  return (
    <Box>
      {/* Sticky Header Bar */}
      <Box 
        sx={{ 
          position: 'sticky', 
          top: 0, 
          zIndex: 1100,
          bgcolor: 'background.paper',
          borderBottom: 1,
          borderColor: 'divider',
          py: 2,
          mb: 3
        }}
      >
        <Container maxWidth="xl">
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {getTypeIcon(householdData.type)}
              <Box>
                <Typography variant="h5" data-testid="text-household-name">
                  {householdData.name}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  RM: {householdData.relationshipManager} | Est. {householdData.establishedDate}
                </Typography>
              </Box>
              <Chip 
                label={householdData.type.replace('_', ' ').toUpperCase()} 
                size="small"
                color="primary"
                data-testid="chip-household-type"
              />
            </Box>
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Box sx={{ textAlign: 'right' }}>
                <Typography variant="caption" color="text.secondary">Net Worth</Typography>
                <Typography variant="h6" color="primary.main" data-testid="text-net-worth">
                  {formatCurrency(householdData.netWorth)}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Container>
      </Box>

      <Container maxWidth="xl" sx={{ pb: 4 }}>
        {/* Metrics Summary Bar */}
        <Box sx={{ mb: 3 }}>
          <Grid container spacing={2}>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Chip 
                icon={<People />} 
                label={`${householdData.totalMembers} Members`} 
                sx={{ width: '100%' }}
                data-testid="chip-member-count"
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Chip 
                icon={<AccountBalance />} 
                label={`${householdData.totalAccounts} Accounts`} 
                sx={{ width: '100%' }}
                data-testid="chip-account-count"
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Chip 
                icon={<AccountBalanceWallet />} 
                label={`${householdData.activeDeposits} Deposits`} 
                sx={{ width: '100%' }}
                data-testid="chip-deposit-count"
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Chip 
                icon={<Business />} 
                label="Holding Company" 
                sx={{ width: '100%' }}
                data-testid="chip-structure-type"
              />
            </Grid>
          </Grid>
        </Box>

        {/* Household Overview Metrics */}
        <Card sx={{ mb: 3 }} data-testid="card-overview">
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3 }}>Household Overview</Typography>
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 4 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Assets
                  </Typography>
                  <Typography variant="h5" color="primary" data-testid="text-total-assets">
                    {formatCurrency(householdData.totalAssets)}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Liabilities
                  </Typography>
                  <Typography variant="h5" color="primary.main" data-testid="text-total-liabilities">
                    {formatCurrency(householdData.totalLiabilities)}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Net Worth
                  </Typography>
                  <Typography variant="h5" color="primary.main" data-testid="text-overview-net-worth">
                    {formatCurrency(householdData.netWorth)}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Member Collection Card */}
        <Card sx={{ mb: 3 }} data-testid="card-members">
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3 }}>Household Members</Typography>
            <List>
              {mockMembers.map((member, index) => (
                <Box key={member.id}>
                  {index > 0 && <Divider sx={{ my: 1 }} />}
                  <ListItem
                    data-testid={`member-${member.id}`}
                    secondaryAction={
                      <IconButton edge="end" data-testid={`button-view-member-${member.id}`}>
                        <ArrowForward />
                      </IconButton>
                    }
                    sx={{ px: 0 }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: member.isPrimary ? 'primary.main' : 'secondary.main' }}>
                        {member.customerType === 'business' ? <Business /> : <Person />}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Typography variant="subtitle1">{member.name}</Typography>
                          {member.isPrimary && <Chip label="Primary" size="small" color="primary" />}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {member.role} • {member.accountsCount} accounts • {formatCurrency(member.totalAssets)}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 100 }}>
                              Ownership: {member.ownershipPercentage}%
                            </Typography>
                            <LinearProgress 
                              variant="determinate" 
                              value={member.ownershipPercentage} 
                              sx={{ flexGrow: 1, maxWidth: 150 }}
                            />
                          </Box>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                            <Typography variant="caption" color="text.secondary" sx={{ minWidth: 100 }}>
                              Contribution: {member.contributionPercent}%
                            </Typography>
                            <LinearProgress 
                              variant="determinate" 
                              value={member.contributionPercent} 
                              sx={{ flexGrow: 1, maxWidth: 150 }}
                              color="primary"
                            />
                          </Box>
                        </Box>
                      }
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          </CardContent>
        </Card>

        {/* Business Hierarchy Card */}
        <Card sx={{ mb: 3 }} data-testid="card-hierarchy">
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3 }}>Business Hierarchy</Typography>
            <Box sx={{ pl: 2 }}>
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                  <Avatar sx={{ bgcolor: 'primary.main' }}>
                    <Business />
                  </Avatar>
                  <Box>
                    <Typography variant="subtitle1" fontWeight="bold">
                      Miller Holdings Corporation
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Parent Company • 100% ownership
                    </Typography>
                  </Box>
                </Box>
                
                <Box sx={{ pl: 6, borderLeft: '2px solid', borderColor: 'divider' }}>
                  <Box sx={{ mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
                        <Business fontSize="small" />
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2">
                          Miller Manufacturing LLC
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Subsidiary • 75% ownership
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                  
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                      <Avatar sx={{ bgcolor: 'secondary.main', width: 32, height: 32 }}>
                        <Business fontSize="small" />
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2">
                          Miller Distribution Inc
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Subsidiary • 60% ownership
                        </Typography>
                      </Box>
                    </Box>
                  </Box>
                </Box>
              </Box>
            </Box>
          </CardContent>
        </Card>

        {/* Aggregated Accounts Card */}
        <Card sx={{ mb: 3 }} data-testid="card-accounts">
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3 }}>Aggregated Accounts</Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Account Type</TableCell>
                    <TableCell>Account Number</TableCell>
                    <TableCell>Owner</TableCell>
                    <TableCell align="right">Balance</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {mockAccounts.map((account) => (
                    <TableRow key={account.id} data-testid={`account-row-${account.id}`}>
                      <TableCell>{account.type}</TableCell>
                      <TableCell>{account.number}</TableCell>
                      <TableCell>
                        <Typography variant="body2" noWrap sx={{ maxWidth: 200 }}>
                          {account.owner}
                        </Typography>
                      </TableCell>
                      <TableCell align="right" sx={{ fontWeight: 500 }}>
                        {formatCurrency(account.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={3} align="right">
                      <Typography variant="subtitle2" fontWeight="bold">
                        Total Balance:
                      </Typography>
                    </TableCell>
                    <TableCell align="right">
                      <Typography variant="subtitle2" fontWeight="bold" color="primary">
                        {formatCurrency(mockAccounts.reduce((sum, acc) => sum + acc.balance, 0))}
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>

        {/* Deposits Overview Card */}
        <Card sx={{ mb: 3 }} data-testid="card-deposits">
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3 }}>Deposits Overview</Typography>
            <Grid container spacing={2}>
              {mockDeposits.map((deposit, index) => (
                <Grid size={{ xs: 12, sm: 4 }} key={index}>
                  <Paper variant="outlined" sx={{ p: 2 }}>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      {deposit.type}
                    </Typography>
                    <Typography variant="h6" color="primary">
                      {formatCurrency(deposit.totalBalance)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {deposit.count} account{deposit.count > 1 ? 's' : ''}
                    </Typography>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>

        {/* Household Notes Card */}
        <Card data-testid="card-notes">
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
              <Note />
              <Typography variant="h6">Household Notes</Typography>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 3, bgcolor: 'action.hover', borderRadius: 1 }}>
              <Description color="disabled" />
              <Typography variant="body2" color="text.secondary">
                No notes available for this household.
              </Typography>
            </Box>
          </CardContent>
        </Card>

        {/* Design Label */}
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Chip 
            label="OPTION 2: Unified Dashboard Design (Recommended)" 
            color="primary" 
            variant="outlined"
            data-testid="design-label"
          />
        </Box>
      </Container>
    </Box>
  );
}
