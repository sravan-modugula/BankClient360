import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useSearchParams } from 'wouter';
import { navigateToCustomer, navigateToHousehold } from '@/lib/navigation';
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
  LinearProgress,
  Skeleton,
  Alert,
  Stack,
  TextField,
  InputAdornment,
  Tooltip,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Drawer,
  Button
} from '@mui/material';
import {
  FamilyRestroom,
  Business,
  AccountBalance,
  People,
  Person,
  ArrowForward,
  AccountBalanceWallet,
  Note,
  Description,
  ArrowBack,
  PushPin,
  Add,
  Search,
  FilterList,
  Circle,
  Gavel,
  Close,
  NoteAdd
} from '@mui/icons-material';
import { useDateFormatter } from '@/lib/dateFormatters';
import NoteEditorModal from '@/components/NoteEditorModal';

interface Household {
  householdId: number;
  householdName: string;
  householdType: string;
  totalAssets: string;
  totalLiabilities: string;
  householdStatus: string;
  riskRating: string | null;
  relationshipManagerId: number | null;
  establishedDate: string;
  taxFilingStatus: string | null;
  parentHouseholdId: number | null;
  consolidationMethod: string;
}

interface HouseholdMember {
  membershipId: number;
  householdId: number;
  customerId: number;
  relationshipRole: string;
  isPrimaryMember: boolean;
  isHeadOfHousehold: boolean;
  ownershipPercentage: string;
  controlType: string;
  firstName: string | null;
  lastName: string | null;
  fullName: string | null;
  dateOfBirth: string | null;
  customerSince: string;
  membershipStartDate: string;
  membershipEndDate: string | null;
}

interface Account {
  accountId: number;
  accountNumber: string;
  accountType: string;
  accountSubtype: string | null;
  balance: string;
  accountStatus: string;
  currency: string;
  openedDate: string;
  interestRate: string | number | null;
  averageBalance: string | number | null;
  creditLimit: string | number | null;
  productCode: string | null;
  branchId: number | null;
}

const isLoanType = (t: string) => {
  const s = (t || '').toLowerCase();
  return s.includes('loan') || s.includes('mortgage') || s.includes('heloc') || s.includes('credit');
};

const titleCase = (s: string | null | undefined) => {
  if (!s) return '';
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
};

const toNumber = (v: string | number | null | undefined): number => {
  if (v === null || v === undefined || v === '') return 0;
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
};

// Weighted average interest rate, weighted by balance.
const weightedAvgRate = (accounts: Account[]): number | null => {
  let weighted = 0;
  let totalWeight = 0;
  for (const a of accounts) {
    const bal = toNumber(a.balance);
    const rate = a.interestRate;
    if (rate === null || rate === undefined || rate === '') continue;
    const r = typeof rate === 'string' ? parseFloat(rate) : rate;
    if (isNaN(r) || bal <= 0) continue;
    weighted += r * bal;
    totalWeight += bal;
  }
  return totalWeight > 0 ? weighted / totalWeight : null;
};

export default function HouseholdPage() {
  const [searchParams] = useSearchParams();
  const [, setLocation] = useLocation();
  const { formatDateTime } = useDateFormatter();
  const householdIdParam = searchParams.get('householdId');
  const householdId = householdIdParam ? parseInt(householdIdParam) : null;
  const customerId = searchParams.get('customerId'); // Keep as string to support alphanumeric IDs
  const [noteEditorOpen, setNoteEditorOpen] = useState(false);
  const [editNoteId, setEditNoteId] = useState<number | null>(null);
  const [noteTargetType, setNoteTargetType] = useState<'customer' | 'account'>('customer');
  const [noteTargetId, setNoteTargetId] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterImportance, setFilterImportance] = useState('');
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<any | null>(null);
  const [accountTab, setAccountTab] = useState<'all' | 'deposits' | 'loans'>('all');

  const handleBack = () => {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    if (customerId) {
      navigateToCustomer(customerId);
    } else {
      setLocation('/ciq/client');
    }
  };

  // If accessing via customerId, fetch their household first
  const { data: customerHouseholds = [] } = useQuery<any[]>({
    queryKey: ['/api/customers', customerId, 'households'],
    enabled: !!customerId,
  });

  // Determine the actual household ID to use
  const actualHouseholdId = householdId || customerHouseholds[0]?.householdId;
  const noHousehold = customerId && !actualHouseholdId;

  // Fetch household data
  const { data: household, isLoading: householdLoading, error: householdError } = useQuery<Household>({
    queryKey: ['/api/households', actualHouseholdId],
    enabled: !!actualHouseholdId,
  });

  // Fetch household members
  const { data: members = [], isLoading: membersLoading } = useQuery<HouseholdMember[]>({
    queryKey: ['/api/households', actualHouseholdId, 'members'],
    enabled: !!actualHouseholdId,
  });

  // Fetch household accounts (aggregated)
  const { data: allAccounts = [], isLoading: accountsLoading } = useQuery<Account[]>({
    queryKey: ['/api/households', actualHouseholdId, 'accounts'],
    enabled: !!actualHouseholdId,
  });

  // Fetch parent household information for B2B relationships
  const { data: parentHousehold } = useQuery<Household>({
    queryKey: ['/api/households', household?.parentHouseholdId],
    enabled: !!household?.parentHouseholdId,
  });

  // Fetch notes from all household members
  const { data: householdNotes, isLoading: notesLoading, refetch: refetchNotes } = useQuery({
    queryKey: [`/api/households/${actualHouseholdId}/notes`],
    queryFn: async () => {
      if (!members || members.length === 0) return [];
      
      // Fetch notes from all members
      const notesPromises = members.map(async (member) => {
        try {
          const res = await fetch(`/api/customers/${member.customerId}/notes`, {
            credentials: 'include'
          });
          if (!res.ok) return [];
          const data = await res.json();
          return (data.notes || []).map((note: any) => ({
            ...note,
            memberName: member.fullName,
            memberCustomerId: member.customerId
          }));
        } catch {
          return [];
        }
      });
      
      const allNotes = await Promise.all(notesPromises);
      return allNotes.flat().sort((a: any, b: any) => {
        // Sort by pinned first, then by updated date
        if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
        return new Date(b.currentVersion?.modifiedAt || b.updatedAt).getTime() - 
               new Date(a.currentVersion?.modifiedAt || a.updatedAt).getTime();
      });
    },
    enabled: !!actualHouseholdId && members.length > 0
  });

  // Fetch subsidiary households (children)
  const { data: subsidiaryHouseholds = [] } = useQuery<Household[]>({
    queryKey: ['/api/households', actualHouseholdId, 'subsidiaries'],
    enabled: !!actualHouseholdId && household?.householdType?.includes('business'),
  });

  const formatCurrency = (amount: string | number) => {
    const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(numAmount);
  };

  // Helper functions for notes
  const safeString = (value: string | null | undefined, fallback: string = ''): string => {
    return value ?? fallback;
  };

  const safeBoolean = (value: boolean | null | undefined, fallback: boolean = false): boolean => {
    return value ?? fallback;
  };

  const truncateText = (text: string | null | undefined, maxLength: number): string => {
    const safeText = safeString(text);
    return safeText.length > maxLength ? `${safeText.substring(0, maxLength)}...` : safeText;
  };

  const getImportanceColor = (importance: string | null | undefined): string => {
    const safeImportance = safeString(importance).toLowerCase();
    switch (safeImportance) {
      case 'urgent': return '#1b4d20';
      case 'high': return '#7a5604';
      case 'medium': return '#616161';
      case 'low': return '#757575';
      default: return '#757575';
    }
  };

  // Filter notes
  const filteredNotes = (householdNotes || []).filter((note: any) => {
    const title = safeString(note.currentVersion?.title).toLowerCase();
    const body = safeString(note.currentVersion?.body).toLowerCase();
    const searchLower = searchQuery.toLowerCase();
    
    const matchesSearch = !searchQuery || 
      title.includes(searchLower) ||
      body.includes(searchLower);
    
    const matchesImportance = !filterImportance || safeString(note.importance) === filterImportance;
    
    return matchesSearch && matchesImportance;
  });

  const getTypeIcon = (type: string) => {
    return type === 'family' ? <FamilyRestroom /> : <Business />;
  };

  const getCustomerTypeIcon = (member: HouseholdMember) => {
    // Business members typically have businessName, families have firstName/lastName
    return member.firstName ? <Person /> : <Business />;
  };

  // Show message for customers without a household
  if (noHousehold) {
    return (
      <Box>
        <Box 
          sx={{ 
            bgcolor: 'background.paper',
            borderBottom: 1,
            borderColor: 'divider',
            py: 2,
            mb: 3
          }}
        >
          <Container maxWidth="xl">
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <IconButton 
                onClick={() => navigateToCustomer(customerId)} 
                data-testid="button-back"
                sx={{ color: 'text.secondary' }}
              >
                <ArrowBack />
              </IconButton>
              <FamilyRestroom />
              <Typography variant="h5">Household Information</Typography>
            </Box>
          </Container>
        </Box>
        <Container maxWidth="xl" sx={{ py: 4 }}>
          <Card>
            <CardContent sx={{ py: 8, textAlign: 'center' }}>
              <FamilyRestroom sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h5" color="text.secondary" gutterBottom>
                No Household Found
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                This customer is not currently associated with a household.
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Contact your administrator to create a household for this customer.
              </Typography>
            </CardContent>
          </Card>
        </Container>
      </Box>
    );
  }

  if (!householdId && !customerId) {
    return (
      <Container maxWidth="xl" sx={{ py: 3 }}>
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <FamilyRestroom sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h5" color="text.secondary" gutterBottom sx={{ fontWeight: 300 }}>
            No Household Selected
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 300 }}>
            Please search for and select a customer to view their household details.
          </Typography>
        </Box>
      </Container>
    );
  }

  if (householdError) {
    // Check if it's a 404 error (household not found)
    const is404 = (householdError as any)?.status === 404 || 
                  (householdError as any)?.response?.status === 404 ||
                  String(householdError).includes('404');
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Card>
          <CardContent sx={{ py: 8, textAlign: 'center' }}>
            <FamilyRestroom sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h5" color="text.secondary" gutterBottom>
              {is404 ? 'Household Not Found' : 'Error Loading Household'}
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
              {is404 
                ? `The household with ID "${householdId}" could not be found.`
                : 'An error occurred while loading household data.'
              }
            </Typography>
            <Button
              variant="outlined"
              onClick={handleBack}
              startIcon={<ArrowBack />}
            >
              Go Back
            </Button>
          </CardContent>
        </Card>
      </Container>
    );
  }

  if (householdLoading) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Skeleton variant="rectangular" height={200} />
        <Box sx={{ mt: 3 }}>
          <Skeleton variant="rectangular" height={400} />
        </Box>
      </Container>
    );
  }

  if (!household) {
    return (
      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Alert severity="warning">Household not found</Alert>
      </Container>
    );
  }

  const depositAccounts = allAccounts.filter(a => !isLoanType(a.accountType));
  const loanAccounts = allAccounts.filter(a => isLoanType(a.accountType));

  const totalDeposits = depositAccounts.reduce((sum, a) => sum + toNumber(a.balance), 0);
  const totalLoanBalances = loanAccounts.reduce((sum, a) => sum + toNumber(a.balance), 0);
  const totalAccountBalance = totalDeposits + totalLoanBalances;
  const depositWair = weightedAvgRate(depositAccounts);
  const loanWair = weightedAvgRate(loanAccounts);

  const filteredAccounts =
    accountTab === 'deposits' ? depositAccounts :
    accountTab === 'loans' ? loanAccounts :
    allAccounts;
  const filteredAccountsTotal = filteredAccounts.reduce((sum, a) => sum + toNumber(a.balance), 0);

  // Group deposits by type (deposits only — loan widgets removed per spec)
  const depositsByType = depositAccounts.reduce((acc, account) => {
    const type = account.accountType;
    if (!acc[type]) {
      acc[type] = { count: 0, totalBalance: 0 };
    }
    acc[type].count++;
    acc[type].totalBalance += toNumber(account.balance);
    return acc;
  }, {} as Record<string, { count: number; totalBalance: number }>);

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
              <IconButton
                onClick={handleBack}
                data-testid="button-back"
                sx={{ color: 'text.secondary' }}
              >
                <ArrowBack />
              </IconButton>
              {getTypeIcon(household.householdType)}
              <Box>
                <Typography variant="h5" data-testid="text-household-name">
                  {household.householdName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Est. {new Date(household.establishedDate).toLocaleDateString()}
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
                label={`${members.length} Member${members.length !== 1 ? 's' : ''}`}
                sx={{ width: '100%' }}
                data-testid="chip-member-count"
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Chip
                icon={<AccountBalance />}
                label={`${depositAccounts.length} Deposit${depositAccounts.length !== 1 ? 's' : ''}`}
                sx={{ width: '100%' }}
                data-testid="chip-deposit-count"
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Chip
                icon={<AccountBalanceWallet />}
                label={`${loanAccounts.length} Loan${loanAccounts.length !== 1 ? 's' : ''}`}
                sx={{ width: '100%' }}
                data-testid="chip-loan-count"
              />
            </Grid>
            <Grid size={{ xs: 6, sm: 3 }}>
              <Chip
                icon={household.householdType === 'family' ? <FamilyRestroom /> : <Business />}
                label={household.householdType.replace('_', ' ')}
                sx={{ width: '100%', textTransform: 'capitalize' }}
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
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Deposits
                  </Typography>
                  <Typography variant="h5" color="primary" data-testid="text-total-deposits">
                    {formatCurrency(totalDeposits)}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Deposit WAIR
                  </Typography>
                  <Typography variant="h5" color="primary.main" data-testid="text-deposit-wair">
                    {depositWair !== null ? `${depositWair.toFixed(2)}%` : '—'}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Total Loan Balances
                  </Typography>
                  <Typography variant="h5" color="primary.main" data-testid="text-total-loan-balances">
                    {formatCurrency(totalLoanBalances)}
                  </Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 12, sm: 6, md: 3 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Loan WAIR
                  </Typography>
                  <Typography variant="h5" color="primary.main" data-testid="text-loan-wair">
                    {loanWair !== null ? `${loanWair.toFixed(2)}%` : '—'}
                  </Typography>
                </Box>
              </Grid>
            </Grid>
          </CardContent>
        </Card>

        {/* Household Members Card */}
        <Card sx={{ mb: 3 }} data-testid="card-members">
          <CardContent>
            <Typography variant="h6" sx={{ mb: 3 }}>Household Members</Typography>
            {membersLoading ? (
              <Skeleton variant="rectangular" height={300} />
            ) : members.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No members found in this household.
              </Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Member</TableCell>
                      <TableCell>Open Date</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {members.map((member, index) => {
                      const isHead = member.isHeadOfHousehold || member.isPrimaryMember;
                      const since = member.customerSince ? new Date(member.customerSince) : null;
                      const sinceValid = since && !isNaN(since.getTime());
                      return (
                        <TableRow
                          key={member.membershipId || `member-${member.customerId}-${index}`}
                          data-testid={`row-member-${member.customerId}`}
                          onClick={() => navigateToCustomer(member.customerId, householdId || undefined)}
                          sx={{
                            cursor: 'pointer',
                            '&:hover': { bgcolor: 'action.hover' }
                          }}
                        >
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2">{member.fullName}</Typography>
                              {isHead && <Chip label="Head of Household" size="small" color="primary" />}
                            </Box>
                          </TableCell>
                          <TableCell>
                            {sinceValid ? since!.toLocaleDateString() : '—'}
                          </TableCell>
                          <TableCell align="right">
                            <ArrowForward fontSize="small" color="action" />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* Business Relationships Card */}
        {(household.parentHouseholdId || subsidiaryHouseholds.length > 0) && (
          <Card sx={{ mb: 3 }} data-testid="card-business-relationships">
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3 }}>Business Relationships</Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Company</TableCell>
                      <TableCell>Type</TableCell>
                      <TableCell>Consolidation</TableCell>
                      <TableCell align="right">Total Assets</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {/* Parent Company Row */}
                    {household.parentHouseholdId && parentHousehold && (
                      <TableRow 
                        data-testid={`row-relationship-parent-${parentHousehold.householdId}`}
                        onClick={() => navigateToHousehold(parentHousehold.householdId)}
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' } 
                        }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2">{parentHousehold.householdName}</Typography>
                            <Chip label="Parent" size="small" color="primary" />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {parentHousehold.householdType.replace('_', ' ')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {household.consolidationMethod?.replace('_', ' ').toUpperCase() || '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 500 }}>
                          {formatCurrency(parentHousehold.totalAssets)}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={parentHousehold.householdStatus} 
                            size="small" 
                            color={parentHousehold.householdStatus === 'active' ? 'primary' : 'default'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <ArrowForward fontSize="small" color="action" />
                        </TableCell>
                      </TableRow>
                    )}
                    
                    {/* Subsidiary Rows */}
                    {subsidiaryHouseholds.map((subsidiary) => (
                      <TableRow 
                        key={subsidiary.householdId} 
                        data-testid={`row-relationship-subsidiary-${subsidiary.householdId}`}
                        onClick={() => navigateToHousehold(subsidiary.householdId)}
                        sx={{ 
                          cursor: 'pointer',
                          '&:hover': { bgcolor: 'action.hover' } 
                        }}
                      >
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Typography variant="body2">{subsidiary.householdName}</Typography>
                            <Chip label="Subsidiary" size="small" color="secondary" />
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {subsidiary.householdType.replace('_', ' ')}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          {subsidiary.consolidationMethod?.replace('_', ' ').toUpperCase() || '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 500 }}>
                          {formatCurrency(subsidiary.totalAssets)}
                        </TableCell>
                        <TableCell>
                          <Chip 
                            label={subsidiary.householdStatus} 
                            size="small" 
                            color={subsidiary.householdStatus === 'active' ? 'primary' : 'default'}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <ArrowForward fontSize="small" color="action" />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </CardContent>
          </Card>
        )}

        {/* Aggregated Accounts Card */}
        <Card sx={{ mb: 3 }} data-testid="card-accounts">
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 2 }}>
              <Typography variant="h6">Aggregated Accounts</Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                {(['all', 'deposits', 'loans'] as const).map(key => (
                  <Chip
                    key={key}
                    label={key === 'all' ? 'All' : key === 'deposits' ? 'Deposits' : 'Loans'}
                    size="small"
                    onClick={() => setAccountTab(key)}
                    color={accountTab === key ? 'primary' : 'default'}
                    variant={accountTab === key ? 'filled' : 'outlined'}
                    data-testid={`tab-accounts-${key}`}
                  />
                ))}
              </Box>
            </Box>
            {accountsLoading ? (
              <Skeleton variant="rectangular" height={300} />
            ) : filteredAccounts.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No {accountTab === 'all' ? '' : accountTab} accounts found for household members.
              </Typography>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Account Number</TableCell>
                      <TableCell>Product</TableCell>
                      <TableCell>Open Date</TableCell>
                      <TableCell align="right">Balance</TableCell>
                      {accountTab === 'loans' ? (
                        <TableCell align="right">Commitment</TableCell>
                      ) : (
                        <TableCell align="right">MTD Avg Balance</TableCell>
                      )}
                      <TableCell align="right">Interest Rate</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredAccounts.map((account) => {
                      const openDate = account.openedDate ? new Date(account.openedDate) : null;
                      const openValid = openDate && !isNaN(openDate.getTime());
                      const product = titleCase(account.accountSubtype) || titleCase(account.accountType);
                      const rate = account.interestRate;
                      const rateNum = rate === null || rate === undefined || rate === '' ? null
                        : (typeof rate === 'string' ? parseFloat(rate) : rate);
                      return (
                        <TableRow
                          key={account.accountId}
                          hover
                          onClick={() => setLocation(`/account/${account.accountId}`)}
                          sx={{ cursor: 'pointer' }}
                          data-testid={`account-row-${account.accountId}`}
                        >
                          <TableCell>{account.accountNumber}</TableCell>
                          <TableCell>{product || '—'}</TableCell>
                          <TableCell>{openValid ? openDate!.toLocaleDateString() : '—'}</TableCell>
                          <TableCell align="right" sx={{ fontWeight: 500 }}>
                            {formatCurrency(account.balance)}
                          </TableCell>
                          <TableCell align="right">
                            {accountTab === 'loans'
                              ? (toNumber(account.creditLimit) > 0 ? formatCurrency(account.creditLimit as any) : '—')
                              : (toNumber(account.averageBalance) > 0 ? formatCurrency(account.averageBalance as any) : '—')}
                          </TableCell>
                          <TableCell align="right">
                            {rateNum !== null && !isNaN(rateNum) ? `${rateNum.toFixed(2)}%` : '—'}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                    <TableRow key="total-row">
                      <TableCell colSpan={3} align="right">
                        <Typography variant="subtitle2" fontWeight="bold">
                          Total Balance:
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Typography variant="subtitle2" fontWeight="bold" color="primary">
                          {formatCurrency(filteredAccountsTotal)}
                        </Typography>
                      </TableCell>
                      <TableCell />
                      <TableCell />
                    </TableRow>
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </CardContent>
        </Card>

        {/* Deposits Overview Card */}
        {Object.keys(depositsByType).length > 0 && (
          <Card sx={{ mb: 3 }} data-testid="card-deposits">
            <CardContent>
              <Typography variant="h6" sx={{ mb: 3 }}>Deposits Overview</Typography>
              <Grid container spacing={2}>
                {Object.entries(depositsByType).map(([type, data], index) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                    <Paper variant="outlined" sx={{ p: 2 }}>
                      <Typography variant="body2" color="text.secondary" gutterBottom>
                        {titleCase(type)}
                      </Typography>
                      <Typography variant="h6" color="primary">
                        {formatCurrency(data.totalBalance)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {data.count} account{data.count > 1 ? 's' : ''}
                      </Typography>
                    </Paper>
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        )}

        {/* Household Member Notes - Table Design matching Customer Notes */}
        {notesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <LinearProgress />
          </Box>
        ) : (
          <TableContainer component={Paper} elevation={2} sx={{ borderLeft: 'none', borderRight: 'none' }}>
            {/* Toolbar inside table container */}
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              {/* Top Row: Title + Controls */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Description color="primary" />
                  Member Notes
                  <Chip label={filteredNotes.length} size="small" />
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                  <Tooltip title="Filters">
                    <IconButton
                      size="small"
                      onClick={() => setShowFilters(!showFilters)}
                      data-testid="button-toggle-filters"
                      color={showFilters ? 'primary' : 'default'}
                    >
                      <FilterList fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>

              {/* Search Row */}
              <TextField
                placeholder="Search member notes..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value || '')}
                size="small"
                fullWidth
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search fontSize="small" />
                    </InputAdornment>
                  )
                }}
                data-testid="input-search-notes"
              />

              {/* Filter Controls Row (Conditional) */}
              {showFilters && (
                <Box sx={{ mt: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  <FormControl size="small" sx={{ minWidth: 200 }}>
                    <InputLabel>Importance</InputLabel>
                    <Select
                      value={filterImportance}
                      onChange={(e) => setFilterImportance(e.target.value || '')}
                      label="Importance"
                      data-testid="select-filter-importance"
                    >
                      <MenuItem value="">All Levels</MenuItem>
                      <MenuItem value="urgent">Urgent</MenuItem>
                      <MenuItem value="high">High</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="low">Low</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              )}
            </Box>

            {/* Notes Table or Empty State */}
            {filteredNotes.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <Description sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary" gutterBottom>
                  No Notes Found
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  {searchQuery || filterImportance
                    ? 'Try adjusting your filters'
                    : 'No notes found for household members'}
                </Typography>
              </Box>
            ) : (
              <Table sx={{ minWidth: 650 }} size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 400, width: '40%' }}>Title</TableCell>
                    <TableCell sx={{ fontWeight: 400, width: '20%' }}>Member</TableCell>
                    <TableCell sx={{ fontWeight: 400, width: '20%' }}>Updated</TableCell>
                    <TableCell sx={{ fontWeight: 400, width: '20%' }}>Author</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredNotes.map((note: any) => {
                    const cv = note.currentVersion || {};
                    const isPinned = safeBoolean(note.isPinned);
                    const legalHold = safeBoolean(note.legalHold);
                    const isDeleted = safeBoolean(cv.isSoftDeleted);
                    const importance = safeString(note.importance, 'medium');
                    const title = safeString(cv.title, 'Untitled');
                    const body = safeString(cv.body);
                    const lastModifiedBy = safeString(cv.authorEmployeeName || note.lastModifiedByName);
                    
                    return (
                      <TableRow 
                        key={note.noteId}
                        hover
                        onClick={() => {
                          setSelectedNote(note);
                          setDetailDrawerOpen(true);
                        }}
                        sx={{ 
                          cursor: 'pointer',
                          opacity: isDeleted ? 0.6 : 1,
                          '&:hover': {
                            backgroundColor: 'action.hover'
                          }
                        }}
                        data-testid={`row-note-${note.noteId}`}
                      >
                        {/* Title Column with Importance Dot and Pin */}
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Circle 
                              sx={{ 
                                fontSize: 12, 
                                color: getImportanceColor(importance)
                              }} 
                            />
                            {isPinned && (
                              <PushPin 
                                sx={{ fontSize: 16, color: 'primary.main' }} 
                              />
                            )}
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Tooltip title={title} placement="top-start">
                                <Typography 
                                  variant="body2" 
                                  sx={{ 
                                    fontWeight: 400,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {title}
                                </Typography>
                              </Tooltip>
                              {body && (
                                <Typography 
                                  variant="caption" 
                                  color="text.secondary"
                                  sx={{
                                    display: 'block',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap'
                                  }}
                                >
                                  {truncateText(body, 60)}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        </TableCell>

                        {/* Member Column */}
                        <TableCell>
                          <Chip
                            label={note.memberName}
                            size="small"
                            variant="outlined"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigateToCustomer(note.memberCustomerId);
                            }}
                            sx={{ cursor: 'pointer' }}
                          />
                        </TableCell>

                        {/* Updated Column */}
                        <TableCell>
                          <Typography variant="body2">
                            {formatDateTime(cv.modifiedAt || note.updatedAt)}
                          </Typography>
                        </TableCell>

                        {/* Author Column */}
                        <TableCell>
                          <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {lastModifiedBy || '—'}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TableContainer>
        )}

        {/* Detail Drawer */}
        <Drawer
          anchor="right"
          open={detailDrawerOpen}
          onClose={() => {
            setDetailDrawerOpen(false);
            setSelectedNote(null);
          }}
          PaperProps={{
            sx: { width: { xs: '100%', sm: 500 } }
          }}
        >
          {selectedNote && (
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Drawer Header */}
              <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', mb: 2 }}>
                  <Typography variant="h6" sx={{ flex: 1, pr: 2 }}>
                    {safeString(selectedNote.currentVersion?.title, 'Untitled')}
                  </Typography>
                  <IconButton 
                    onClick={() => {
                      setDetailDrawerOpen(false);
                      setSelectedNote(null);
                    }} 
                    size="small" 
                    data-testid="button-close-drawer"
                  >
                    <Close />
                  </IconButton>
                </Box>

                {/* Metadata Chips */}
                <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                  <Chip
                    label={safeString(selectedNote.importance, 'medium').toUpperCase()}
                    size="small"
                    sx={{ 
                      bgcolor: getImportanceColor(selectedNote.importance),
                      color: '#fff',
                      fontWeight: 400
                    }}
                  />
                  <Chip
                    label={selectedNote.memberName}
                    size="small"
                    variant="outlined"
                    onClick={() => {
                      setDetailDrawerOpen(false);
                      navigateToCustomer(selectedNote.memberCustomerId);
                    }}
                    sx={{ cursor: 'pointer' }}
                  />
                  {selectedNote.categoryName && (
                    <Chip
                      label={safeString(selectedNote.categoryName)}
                      size="small"
                      variant="outlined"
                    />
                  )}
                  <Chip
                    label={`v${selectedNote.currentVersion?.versionNumber || 1}`}
                    size="small"
                    variant="outlined"
                  />
                </Box>

                {/* Indicators */}
                <Stack spacing={1}>
                  {safeBoolean(selectedNote.isPinned) && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PushPin fontSize="small" color="primary" />
                      <Typography variant="body2" color="primary.main" fontWeight={500}>
                        Pinned Note
                      </Typography>
                    </Box>
                  )}
                  {safeBoolean(selectedNote.legalHold) && (
                    <Alert 
                      severity="info" 
                      icon={<Gavel sx={{ color: 'primary.main' }} />} 
                      sx={{ 
                        py: 0.5,
                        bgcolor: 'primary.light',
                        '& .MuiAlert-icon': {
                          color: 'primary.main'
                        }
                      }}
                    >
                      <Typography variant="body2" fontWeight={600}>Legal Hold Active</Typography>
                    </Alert>
                  )}
                </Stack>
              </Box>

              {/* Drawer Body */}
              <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
                <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', mb: 3 }}>
                  {safeString(selectedNote.currentVersion?.body) || 'No content'}
                </Typography>

                <Divider sx={{ mb: 2 }} />

                {/* Additional Info */}
                <Stack spacing={1.5}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 400 }}>
                      Created
                    </Typography>
                    <Typography variant="body2">
                      {formatDateTime(selectedNote.createdAt)}
                      {safeString(selectedNote.createdByName) && ` by ${selectedNote.createdByName}`}
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 400 }}>
                      Last Updated
                    </Typography>
                    <Typography variant="body2">
                      {formatDateTime(selectedNote.currentVersion?.modifiedAt || selectedNote.updatedAt)}
                      {safeString(selectedNote.currentVersion?.authorEmployeeName || selectedNote.lastModifiedByName) && 
                        ` by ${selectedNote.currentVersion?.authorEmployeeName || selectedNote.lastModifiedByName}`}
                    </Typography>
                  </Box>
                  {selectedNote.retentionYears && (
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 400 }}>
                        Retention Period
                      </Typography>
                      <Typography variant="body2">
                        {selectedNote.retentionYears} {selectedNote.retentionYears === 1 ? 'year' : 'years'}
                      </Typography>
                    </Box>
                  )}
                </Stack>
              </Box>

              {/* Drawer Footer */}
              <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider', display: 'flex', gap: 1 }}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => {
                    setDetailDrawerOpen(false);
                    navigateToCustomer(selectedNote.memberCustomerId);
                  }}
                  data-testid="button-view-customer"
                >
                  View Customer
                </Button>
              </Box>
            </Box>
          )}
        </Drawer>

        {/* Note Editor Modal */}
        <NoteEditorModal
          open={noteEditorOpen}
          onClose={() => {
            setNoteEditorOpen(false);
            setEditNoteId(null);
          }}
          noteId={editNoteId}
          targetType={noteTargetType}
          targetId={noteTargetId}
        />
      </Container>
    </Box>
  );
}
