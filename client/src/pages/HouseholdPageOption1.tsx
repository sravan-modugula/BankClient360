import { useState } from 'react';
import {
  Container,
  Box,
  Typography,
  Tabs,
  Tab,
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
  IconButton
} from '@mui/material';
import {
  FamilyRestroom,
  Business,
  AccountBalance,
  People,
  Assessment,
  Note,
  Person,
  ArrowForward,
  TrendingUp,
  AccountBalanceWallet
} from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;

  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`household-tabpanel-${index}`}
      aria-labelledby={`household-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

export default function HouseholdPageOption1() {
  const [activeTab, setActiveTab] = useState(0);

  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setActiveTab(newValue);
  };

  // Mock household data
  const householdData = {
    name: "Miller Holdings Corporation",
    type: "holding_company",
    totalMembers: 5,
    totalAssets: 12500000,
    totalLiabilities: 3200000,
    relationshipManager: "Sarah Johnson",
    establishedDate: "2018-03-15"
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
      isPrimary: false
    }
  ];

  const mockAccounts = [
    { id: 1, type: 'Business Checking', number: '****1234', balance: 450000, owner: 'Miller Holdings Corporation' },
    { id: 2, type: 'Savings', number: '****5678', balance: 2100000, owner: 'Miller Holdings Corporation' },
    { id: 3, type: 'Business Checking', number: '****9012', balance: 180000, owner: 'Miller Manufacturing LLC' },
    { id: 4, type: 'Line of Credit', number: '****3456', balance: -500000, owner: 'Miller Holdings Corporation' }
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
    <Container maxWidth="xl" sx={{ py: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
          {getTypeIcon(householdData.type)}
          <Typography variant="h4" data-testid="text-household-name">
            {householdData.name}
          </Typography>
          <Chip 
            label={householdData.type.replace('_', ' ').toUpperCase()} 
            color="primary" 
            size="small"
            data-testid="chip-household-type"
          />
        </Box>
        <Typography variant="body2" color="text.secondary">
          Relationship Manager: {householdData.relationshipManager} | Established: {householdData.establishedDate}
        </Typography>
      </Box>

      {/* Tabs Navigation */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs value={activeTab} onChange={handleTabChange} aria-label="household tabs">
          <Tab label="Overview" data-testid="tab-overview" />
          <Tab label="Members" data-testid="tab-members" />
          <Tab label="Accounts" data-testid="tab-accounts" />
          <Tab label="Hierarchy" data-testid="tab-hierarchy" />
          <Tab label="Notes" data-testid="tab-notes" />
        </Tabs>
      </Box>

      {/* Overview Tab */}
      <TabPanel value={activeTab} index={0}>
        <Grid container spacing={3}>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card data-testid="card-total-assets">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <AccountBalanceWallet color="primary" />
                  <Typography variant="h6">Total Assets</Typography>
                </Box>
                <Typography variant="h4" color="primary">
                  {formatCurrency(householdData.totalAssets)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Across {householdData.totalMembers} entities
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card data-testid="card-total-liabilities">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <TrendingUp color="secondary" />
                  <Typography variant="h6">Total Liabilities</Typography>
                </Box>
                <Typography variant="h4" color="primary">
                  {formatCurrency(householdData.totalLiabilities)}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Net worth: {formatCurrency(householdData.totalAssets - householdData.totalLiabilities)}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card data-testid="card-member-count">
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <People color="primary" />
                  <Typography variant="h6">Household Members</Typography>
                </Box>
                <Typography variant="h4">
                  {householdData.totalMembers}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Business entities
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Members Tab */}
      <TabPanel value={activeTab} index={1}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Household Members
            </Typography>
            <List>
              {mockMembers.map((member, index) => (
                <Box key={member.id}>
                  {index > 0 && <Divider />}
                  <ListItem
                    data-testid={`member-${member.id}`}
                    secondaryAction={
                      <IconButton edge="end" data-testid={`button-view-member-${member.id}`}>
                        <ArrowForward />
                      </IconButton>
                    }
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: member.isPrimary ? 'primary.main' : 'secondary.main' }}>
                        {member.customerType === 'business' ? <Business /> : <Person />}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Typography variant="subtitle1">{member.name}</Typography>
                          {member.isPrimary && <Chip label="Primary" size="small" color="primary" />}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" color="text.secondary">
                            {member.role} • {member.accountsCount} accounts • {formatCurrency(member.totalAssets)}
                          </Typography>
                          {member.ownershipPercentage < 100 && (
                            <Typography variant="caption" color="text.secondary">
                              Ownership: {member.ownershipPercentage}%
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                </Box>
              ))}
            </List>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Accounts Tab */}
      <TabPanel value={activeTab} index={2}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Aggregated Accounts
            </Typography>
            <TableContainer component={Paper} variant="outlined">
              <Table data-testid="table-accounts">
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
                      <TableCell>{account.owner}</TableCell>
                      <TableCell align="right" sx={{ color: account.balance < 0 ? 'primary.main' : 'inherit' }}>
                        {formatCurrency(account.balance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Hierarchy Tab */}
      <TabPanel value={activeTab} index={3}>
        <Card>
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3 }}>
              Business Hierarchy
            </Typography>
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
                      <Avatar sx={{ bgcolor: 'secondary.main' }}>
                        <Business />
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
                      <Avatar sx={{ bgcolor: 'secondary.main' }}>
                        <Business />
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
      </TabPanel>

      {/* Notes Tab */}
      <TabPanel value={activeTab} index={4}>
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <Note />
              <Typography variant="h6">Household Notes</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary">
              No notes available for this household.
            </Typography>
          </CardContent>
        </Card>
      </TabPanel>

      {/* Design Label */}
      <Box sx={{ mt: 4, textAlign: 'center' }}>
        <Chip 
          label="OPTION 1: Tabbed Workspace Design" 
          color="secondary" 
          variant="outlined"
          data-testid="design-label"
        />
      </Box>
    </Container>
  );
}
