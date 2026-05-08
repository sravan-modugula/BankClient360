import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { Customer, HouseholdMemberWithCustomer } from '@shared/schema';
import {
  Box,
  Container,
  Typography,
  ThemeProvider,
  createTheme,
  CssBaseline,
  Switch,
  FormControlLabel,
  Paper,
  Fab,
  Tabs,
  Tab,
  Chip,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Alert
} from '@mui/material';
import Grid from '@mui/material/Grid';
import {
  Person,
  DarkMode,
  LightMode,
  Add,
  FamilyRestroom,
  AccountBalance,
  Settings,
  ArrowBack,
  Lock as LockIcon,
  Login as LoginIcon,
  Summarize
} from '@mui/icons-material';

import clientIQLogo from '@assets/ClientIQ Gold Logo_1761713299490.png';
import CustomerSearch from './CustomerSearch';
import CustomerOverview from './CustomerOverview';
import AccountSummaryTableVersion from './AccountSummaryTableVersion';
import AccountDetailOption2 from './AccountDetailOption2';
import HouseholdRelationships from './HouseholdRelationships';
import ContactInformation from './ContactInformation';
import Officers from './Officers';
import AccountList from './AccountList';
import TransactionHistory from './TransactionHistory';
import Deposits from './Deposits';
import ClientEngagement from './ClientEngagement';
import TotalRelationshipSummary from './TotalRelationshipSummary';
import RecentContactHistoryVariantC from './RecentContactHistory_VariantC';
import NotesSection from './NotesSection';
import PermissionGuard from './PermissionGuard';
import BackButton from './BackButton';
import { Link, useLocation, useParams, useSearchParams } from 'wouter';
import { IconButton, Tooltip, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { AdminPanelSettings } from '@mui/icons-material';
import { usePermissions } from '@/hooks/usePermissions';
import { useSearchParam } from '@/hooks/useSearchParams';
import { navigateToCustomer, navigateToHousehold } from '@/lib/navigation';
import { useAuth } from '@/contexts/AuthContext';
import Middle from './Middle';
import SectionLabel from './SectionLabel';
import { navigateWithMergedSearch } from '@/lib/navigation';
import { navigate } from 'wouter/use-browser-location';
import NotFound from '@/pages/not-found';

type TabView = 'household' | 'client' | 'accounts' | 'accountSummary';

// Map server-side login_error reason codes (set in server/routes/auth.ts) to
// user-facing messages.
function loginErrorReasonText(reason: string): string {
  switch (reason) {
    case 'auth_error':
      return 'We could not verify your identity with the identity provider. Please try logging in again, or contact your administrator if the problem persists.';
    case 'no_user':
      return 'The identity provider did not return a user profile. Please contact your administrator.';
    case 'saml_login_failed':
      return 'Single sign-on initiation failed. Please try again or contact your administrator.';
    case 'session_error':
      return 'A session error occurred while logging you in. Please try again.';
    case 'login_error':
      return 'Login failed unexpectedly. Please try again.';
    default:
      return 'An authentication error occurred. Please try again or contact your administrator.';
  }
}

export default function CustomerDashboard() {


  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView | null>(null);
  const [selectedDetailAccountId, setSelectedDetailAccountId] = useState<number | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [selectedAccountLabel, setSelectedAccountLabel] = useState<string>('All Accounts');
  const [adminMenuAnchor, setAdminMenuAnchor] = useState<null | HTMLElement>(null);
  const [, setLocation] = useLocation();
  const [params,] = useSearchParams();
  const urlParams = useParams();
  const { data: permissions } = usePermissions();
  const maxPrivilegeLevel = permissions?.maxPrivilegeLevel || 0;

  const { isAuthenticated, isLinked, email: authEmail, isLoading: authLoading, login, logout } = useAuth();

  /* 
    We are changing the component structure so the URL controls the 
    state of the tab that is being viewed
  */
  let tabView = urlParams?.tabView;
  React.useEffect(() => {
    if (["client", "accounts", "household"].includes(tabView || "")) {

      // NOTE: we're remapping the account url to the accountSummary tab
      if (tabView === "accounts") {
        tabView = "accountSummary";
      }

      setActiveTab(tabView as TabView);
    } else {
      setActiveTab(null);
    }
  }, [tabView]);


  // Check if user has permissions for tabs
  const hasHouseholdPermission = permissions?.permissions.includes('household.view') || false;
  const hasAccountsPermission = permissions?.permissions.includes('accounts.view') || false;

  // Get customer ID from URL parameter - this is the source of truth
  const customerIdParam = params.get('customerId');
  const fromHouseholdId = params.get('fromHouseholdId');

  // Auto-load customer from URL parameter
  const { data: customerFromUrl, isLoading: customerFromUrlLoading } = useQuery({
    queryKey: [`/api/customers/${customerIdParam}`],
    enabled: !!customerIdParam,
  });

  // Derive selected customer from URL parameter - preserve original ID format (string or numeric)
  const selectedCustomer = customerIdParam && customerFromUrl ? {
    customerId: customerIdParam, // Keep as string to support both numeric and alphanumeric IDs
    id: customerIdParam,
    ...customerFromUrl
  } : null;

  const handleAccountSelect = (accountId: number | null, accountLabel: string) => {
    setSelectedAccountId(accountId);
    setSelectedAccountLabel(accountLabel);
  };

  // Reset account selection when customer changes
  useEffect(() => {
    setSelectedAccountId(null);
    setSelectedAccountLabel('All Accounts');
  }, [customerIdParam]);

  // Reset active tab if user loses permission for currently selected tab
  useEffect(() => {
    if (activeTab === 'household' && !hasHouseholdPermission) {
      navigateWithMergedSearch(navigate, "/ciq/client");
      // setActiveTab('client');
    } else if ((activeTab === 'accounts' || activeTab === 'accountSummary') && !hasAccountsPermission) {
      navigateWithMergedSearch(navigate, "/ciq/client");
      // setActiveTab('client');
    }

    if (activeTab === "client") {
       setSelectedDetailAccountId(null);
    }
  }, [activeTab, hasHouseholdPermission, hasAccountsPermission]);



  // todo: remove mock functionality
  const mockCustomer = {
    id: 'CID123456',
    name: 'John Smith',
    preferredName: 'Johnny',
    taxId: '123456789',
    dateOfBirth: 'March 15, 1985',
    customerSince: 'January 2018',
    customerType: 'individual',
    status: 'active',
    riskRating: 'low',
    primaryEmail: 'john.smith@email.com',
    primaryPhone: '(555) 123-4567',
    address: '123 Main Street, Anytown, ST 12345',
    relationshipManager: 'Sarah Wilson',
    isHeadOfHousehold: true,
    gender: 'Male',
    driverLicense: 'DL12345678',
    cifNumber: 'CIF123456'
  };

  const mockAccounts = [
    {
      id: 'ACC001',
      accountNumber: '1234567890',
      accountType: 'Checking',
      productName: 'Premier Checking',
      balance: 25430.50,
      availableBalance: 25430.50,
      status: 'active',
      openDate: '2020-03-15',
      interestRate: 0.05
    },
    {
      id: 'ACC002',
      accountNumber: '1234567891',
      accountType: 'Savings',
      productName: 'High Yield Savings',
      balance: 125000.00,
      availableBalance: 125000.00,
      status: 'active',
      openDate: '2018-06-20',
      interestRate: 2.25
    },
    {
      id: 'ACC003',
      accountNumber: '1234567892',
      accountType: 'Credit',
      productName: 'Platinum Credit Card',
      balance: -2350.75,
      availableBalance: 12649.25,
      status: 'active',
      openDate: '2019-11-10'
    }
  ];

  // Fetch customer's households to get the household ID
  const { data: customerHouseholds = [] } = useQuery<any[]>({
    queryKey: ['/api/customers', selectedCustomer?.customerId, 'households'],
    enabled: !!selectedCustomer?.customerId,
  });

  const primaryHouseholdId = customerHouseholds[0]?.householdId;

  // Redirect to full household page when household tab is selected
  useEffect(() => {
    if (activeTab === 'household' && hasHouseholdPermission && selectedCustomer?.customerId) {
      const customerQuery = `customerId=${encodeURIComponent(selectedCustomer.customerId)}`;
      if (primaryHouseholdId) {
        setLocation(`/ciq/household?householdId=${primaryHouseholdId}&${customerQuery}`);
      } else {
        setLocation(`/ciq/household?${customerQuery}`);
      }
    }
  }, [activeTab, primaryHouseholdId, hasHouseholdPermission, selectedCustomer?.customerId, setLocation]);

  // Fetch real household members data
  const { data: householdMembers = [], isLoading: membersLoading } = useQuery({
    queryKey: ['/api/households/customer', selectedCustomer?.customerId, 'members'],
    enabled: !!selectedCustomer?.customerId,
    select: (data: HouseholdMemberWithCustomer[]) => data.map((member: HouseholdMemberWithCustomer) => ({
      id: `MEM${member.customerId.toString().padStart(3, '0')}`,
      name: member.fullName || `${member.firstName || ''} ${member.lastName || ''}`.trim(),
      relationship: formatRelationshipRole(member.relationshipRole),
      customerSince: member.customerSince ? new Date(member.customerSince).getFullYear().toString() : '2022',
      totalAccounts: 1, // Default for now
      totalBalance: 2500.00, // Default for now  
      isPrimary: member.isPrimaryMember || false,
      age: calculateAge(member.dateOfBirth)
    }))
  });

  const formatRelationshipRole = (role: string) => {
    switch (role) {
      case 'head_of_household': return 'Head of Household';
      case 'spouse': return 'Spouse';
      case 'child': return 'Child';
      default: return role.charAt(0).toUpperCase() + role.slice(1);
    }
  };

  const calculateAge = (birthDate?: string | null) => {
    if (!birthDate) return undefined;
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  const mockContacts = [
    {
      id: 'CONT001',
      type: 'phone' as const,
      subtype: 'mobile',
      value: '(555) 123-4567',
      isPrimary: true,
      purpose: 'primary'
    },
    {
      id: 'CONT002',
      type: 'email' as const,
      subtype: 'personal',
      value: 'john.smith@email.com',
      isPrimary: true,
      purpose: 'primary'
    },
    {
      id: 'CONT003',
      type: 'address' as const,
      subtype: 'home',
      value: '123 Main Street\nAnytown, ST 12345',
      isPrimary: true,
      purpose: 'primary'
    }
  ];

  const mockOfficers = [
    {
      id: 'OFF001',
      name: 'Sarah Wilson',
      title: 'Senior Relationship Manager',
      department: 'Wealth',
      phone: '(555) 234-5678',
      email: 's.wilson@bank.com',
      isPrimary: true
    },
    {
      id: 'OFF002',
      name: 'Michael Chen',
      title: 'Lending Officer',
      department: 'Lending',
      phone: '(555) 345-6789',
      email: 'm.chen@bank.com',
      isPrimary: false
    },
    {
      id: 'OFF003',
      name: 'Lisa Rodriguez',
      title: 'Investment Advisor',
      department: 'Wealth',
      email: 'l.rodriguez@bank.com',
      isPrimary: false
    }
  ];

  const mockTransactions = [
    {
      id: 'TXN001',
      date: '2024-03-15',
      description: 'Direct Deposit - Payroll',
      type: 'credit' as const,
      amount: 4500.00,
      balance: 28930.50,
      accountNumber: '1234567890',
      status: 'completed' as const,
      category: 'Income'
    },
    {
      id: 'TXN002',
      date: '2024-03-14',
      description: 'Mortgage Payment',
      type: 'debit' as const,
      amount: 2200.00,
      balance: 24430.50,
      accountNumber: '1234567890',
      status: 'completed' as const,
      category: 'Housing'
    },
    {
      id: 'TXN003',
      date: '2024-03-13',
      description: 'Transfer to Savings',
      type: 'transfer' as const,
      amount: 1000.00,
      balance: 26630.50,
      accountNumber: '1234567890',
      status: 'completed' as const,
      category: 'Transfer'
    }
  ];

  const theme = createTheme({
    palette: {
      mode: darkMode ? 'dark' : 'light',
      primary: {
        main: '#1b4d20', // Dark green for buttons
      },
      secondary: {
        main: '#936b06', // Golden color for icons
      },
      success: {
        main: '#1b4d20', // Dark green - replaces default Material-UI green
        dark: '#1b4d20', // Same dark green
      },
      info: {
        main: '#1b4d20', // Dark green - replaces default Material-UI blue
        dark: '#1b4d20', // Same dark green
      },
      background: {
        default: darkMode ? 'hsl(220, 10%, 8%)' : '#ffffff',
        paper: darkMode ? 'hsl(220, 8%, 12%)' : '#ffffff',
      },
    },
    typography: {
      fontFamily: 'Roboto, sans-serif',
      fontWeightLight: 300,
      fontWeightRegular: 300,
      fontWeightMedium: 400,
      fontWeightBold: 400,
      h1: { fontWeight: 400 },
      h2: { fontWeight: 400 },
      h3: { fontWeight: 400 },
      h4: { fontWeight: 400 },
      h5: { fontWeight: 400 },
      h6: { fontWeight: 400 },
      subtitle1: { fontWeight: 400 },
      subtitle2: { fontWeight: 400 },
      body1: { fontWeight: 300 },
      body2: { fontWeight: 300 },
      button: { fontWeight: 400 },
    },
    components: {
      MuiCard: {
        styleOverrides: {
          root: {
            borderRadius: 8,
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          root: {
            borderLeft: 'none',
            borderRight: 'none',
          },
        },
      },
    },
  });

  // Fetch real customer data when a customer is selected
  const { data: customerDetails, isLoading: customerLoading } = useQuery({
    queryKey: [`/api/customers/${selectedCustomer?.id}`],
    enabled: !!selectedCustomer?.id,
  });

  // Fetch household members for selected customer
  const { data: realHouseholdMembers, isLoading: householdLoading } = useQuery({
    queryKey: [`/api/households/customer/${selectedCustomer?.id}/members`],
    enabled: !!selectedCustomer?.id,
  });

  // Fetch contacts for selected customer  
  const { data: realCustomerContacts, isLoading: contactsLoading } = useQuery({
    queryKey: [`/api/customers/${selectedCustomer?.id}/contacts`],
    enabled: !!selectedCustomer?.id,
  });

  // Fetch officers for selected customer
  const { data: realCustomerOfficers, isLoading: officersLoading } = useQuery({
    queryKey: [`/api/customers/${selectedCustomer?.id}/officers`],
    enabled: !!selectedCustomer?.id,
  });

  // Fetch accounts for selected customer
  const { data: realCustomerAccounts, isLoading: accountsLoading } = useQuery({
    queryKey: [`/api/customers/${selectedCustomer?.id}/accounts`],
    enabled: !!selectedCustomer?.id,
  });

  // ABAC restriction: Level 1 users cannot view accounts/transactions for employee customers
  const isEmployeeCustomer = customerDetails?.isEmployee === true;
  const isLevel1User = maxPrivilegeLevel < 2;
  const accountsRestrictedDueToEmployee = isEmployeeCustomer && isLevel1User;

  // Auto-switch from accounts tab if employee restriction applies
  useEffect(() => {
    if ((activeTab === 'accounts' || activeTab === 'accountSummary') && accountsRestrictedDueToEmployee) {
      // setActiveTab('client');
      navigateWithMergedSearch(navigate, "/ciq/client");
    }
  }, [activeTab, accountsRestrictedDueToEmployee]);

  const handleTabChange = (event: React.SyntheticEvent, newValue: 'household' | 'client' | 'accounts' | 'accountSummary') => {
    setActiveTab(newValue);
  };

  const handleViewAccountDetail = (accountId: number) => {
    setSelectedDetailAccountId(accountId);

    // with the new system, we want to change the url while also updating the component state
    navigateWithMergedSearch(navigate, "/ciq/accounts");

    // setActiveTab('accountSummary');
  };

  if (!activeTab) {
    return <NotFound />
  }

  if (authLoading) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{
          minHeight: '100%',
          bgcolor: 'background.default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <CircularProgress size={48} />
        </Box>
      </ThemeProvider>
    );
  }

  if (!isAuthenticated) {
    const loginError = params.get('login_error');
    const loginErrorMessage = loginError ? loginErrorReasonText(loginError) : null;
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{
          minHeight: '100%',
          bgcolor: 'background.default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Card sx={{ maxWidth: 400, textAlign: 'center', p: 3 }}>
            <CardContent>
              <LockIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 500 }}>
                Login Required
              </Typography>
              {loginErrorMessage && (
                <Alert severity="error" sx={{ mb: 2, textAlign: 'left' }} data-testid="login-error-banner">
                  {loginErrorMessage}
                </Alert>
              )}
              <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                Please log in to search and view customer information.
              </Typography>
              <Button
                variant="contained"
                color="primary"
                size="large"
                startIcon={<LoginIcon />}
                onClick={login}
                sx={{ textTransform: 'none' }}
                data-testid="button-login-required"
              >
                Login Now
              </Button>
            </CardContent>
          </Card>
        </Box>
      </ThemeProvider>
    );
  }

  if (isAuthenticated && !isLinked) {
    return (
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <Box sx={{
          minHeight: '100%',
          bgcolor: 'background.default',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <Card sx={{ maxWidth: 480, textAlign: 'center', p: 3 }}>
            <CardContent>
              <LockIcon sx={{ fontSize: 64, color: 'warning.main', mb: 2 }} />
              <Typography variant="h5" gutterBottom sx={{ fontWeight: 500 }}>
                Awaiting Role Assignment
              </Typography>
              <Alert severity="warning" sx={{ mb: 2, textAlign: 'left' }}>
                You signed in successfully{authEmail ? ` as ${authEmail}` : ''}.
                Your account exists, but no application roles have been assigned
                yet — please contact your administrator to grant access. Once a
                role is assigned, sign out and back in to refresh your permissions.
              </Alert>
              <Button
                variant="outlined"
                color="primary"
                size="large"
                onClick={logout}
                sx={{ textTransform: 'none' }}
                data-testid="button-logout-unlinked"
              >
                Sign out
              </Button>
            </CardContent>
          </Card>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ flex: 1, background: "#f0ece4" }}>
        {/* Customer Search */}
        {/* <CustomerSearch /> */}

        {/* Back button - show when navigated from household page */}
        {fromHouseholdId && (
          <Box sx={{ pt: 3, background: 'white', width: "100%", maxWidth: "none", display: "flex", justifyContent: "center", alignItems: "center" }}>
            <Box sx={{ mt: 2, mb: 1 }}>
              <BackButton
                fallback={() => navigateToHousehold(fromHouseholdId)}
                variant="outlined"
                testId="button-back-to-household"
              />
            </Box>
          </Box>
        )}

        {/* Navigation Tabs - only show when customer is selected */}
        {/* selectedCustomer && (
          <Paper elevation={1} sx={{ borderRadius: 0 }}>
            <Tabs
              value={activeTab}
              onChange={handleTabChange}
              variant="fullWidth"
              sx={{
                borderBottom: 1,
                borderColor: 'divider',
                '& .MuiTab-root': {
                  textTransform: 'none',
                  fontSize: '1rem',
                  fontWeight: 400
                }
              }}
            >
              {hasHouseholdPermission && (
                <Tab
                  icon={<FamilyRestroom />}
                  label="Household"
                  value="household"
                  data-testid="tab-household"
                  sx={{ color: 'secondary.main' }}
                />
              )}
              <Tab
                icon={<Person />}
                label="Client"
                value="client"
                data-testid="tab-client"
                sx={{ color: 'secondary.main' }}
              />
              {hasAccountsPermission && !accountsRestrictedDueToEmployee && (
                <Tab
                  icon={<AccountBalance />}
                  label="Accounts"
                  value="accounts"
                  data-testid="tab-accounts"
                  sx={{ color: 'secondary.main' }}
                />
              )}
              {hasAccountsPermission && !accountsRestrictedDueToEmployee && (
                <Tab
                  icon={<Summarize />}
                  label="Account Summary"
                  value="accountSummary"
                  data-testid="tab-account-summary"
                  sx={{ color: 'secondary.main' }}
                />
              )}
            </Tabs>
          </Paper>
        )*/}

        {/* Main Content */}
        <Container maxWidth="xl" sx={{ py: 3 }}>

          {/* Show message when no customer is selected */}
          {!selectedCustomer && (
            <Box sx={{ textAlign: 'center', py: 8 }}>
              <Person sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h5" color="text.secondary" gutterBottom sx={{ fontWeight: 300 }}>
                No Customer Selected
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{ fontWeight: 300 }}>
                Please search for and select a customer to view their details.
              </Typography>
            </Box>
          )}

          {/* Dashboard Content - only show when customer is selected */}
          {selectedCustomer && activeTab === 'household' && (
            <PermissionGuard
              permissionCode="household.view"
              fallback={
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <FamilyRestroom sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h5" color="text.secondary" gutterBottom>
                    Access Restricted
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    You do not have permission to view household relationships.
                  </Typography>
                </Box>
              }
            >
              {/* View Full Household Button */}
              {primaryHouseholdId && (
                <Box sx={{ mb: 3, display: 'flex', justifyContent: 'flex-end' }}>
                  <Link href={`/ciq/household?householdId=${primaryHouseholdId}${selectedCustomer?.customerId ? `&customerId=${encodeURIComponent(selectedCustomer.customerId)}` : ''}`}>
                    <Box
                      component="button"
                      data-testid="button-view-full-household"
                      sx={{
                        px: 3,
                        py: 1.5,
                        bgcolor: 'primary.main',
                        color: 'white',
                        border: 'none',
                        borderRadius: 1,
                        cursor: 'pointer',
                        fontSize: '1rem',
                        fontWeight: 500,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        transition: 'background-color 0.2s',
                        '&:hover': {
                          bgcolor: 'primary.dark'
                        }
                      }}
                    >
                      <FamilyRestroom />
                      View Full Household Page
                    </Box>
                  </Link>
                </Box>
              )}

              <Grid container spacing={3}>
                {/* Household View */}
                <Grid size={{ xs: 12 }}>
                  <HouseholdRelationships
                    householdName={`${selectedCustomer.name}'s Household`}
                    members={realHouseholdMembers || householdMembers || []}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <ContactInformation contacts={realCustomerContacts || []} />
                </Grid>
              </Grid>
            </PermissionGuard>
          )}

          {selectedCustomer && activeTab === 'client' && (
            <>
              <SectionLabel>Client Profile</SectionLabel>
              {/* Client profile cards with balanced container */}
              <Box sx={{ mb: 3, display: 'flex', gap: 3, '@media (max-width: 768px)': { flexDirection: 'column' } }}>
                <Box sx={{ flex: '1' }}>
                  <CustomerOverview customer={customerDetails || {
                    id: selectedCustomer.id,
                    name: selectedCustomer.name,
                    taxId: '***-**-****',
                    customerSince: new Date().toISOString(),
                    totalAssets: 0,
                    accountNumber: selectedCustomer.accountNumber,
                    riskRating: selectedCustomer.riskRating,
                    status: selectedCustomer.status,
                    cifNumber: null
                  }} />
                </Box>
                <Box sx={{ flex: '1' }}>
                  <ContactInformation contacts={realCustomerContacts || []} />
                </Box>
                <Box sx={{ flex: '1' }}>
                  <Officers officers={realCustomerOfficers?.map((officer: any) => ({
                    id: officer.id,
                    name: officer.displayName,
                    title: officer.title,
                    department: officer.department,
                    isPrimary: officer.isPrimary
                  })) || mockOfficers} />
                </Box>
              </Box>


              <PermissionGuard permissionCode="customer.view.relationship_summary" fallback={null}>
                <Box sx={{ mb: 3, display: 'flex', gap: 3, width: "100%" }}>
                  <Middle customerId={selectedCustomer?.id ? parseInt(selectedCustomer.id) : 0} />
                </Box>
              </PermissionGuard>

              {/* Client Analytics Section - 3 cards in balanced container */}
              <Box sx={{ mb: 3, display: 'flex', gap: 3, '@media (max-width: 768px)': { flexDirection: 'column' } }}>
                <Box sx={{ flex: '1' }}>
                  <ClientEngagement customerId={selectedCustomer?.id ? parseInt(selectedCustomer.id) : 0} />
                </Box>
                {/* 
                <PermissionGuard permissionCode="customer.view.relationship_summary" fallback={null}>
                  <Box sx={{ flex: '1' }}>
                    <TotalRelationshipSummary customerId={selectedCustomer?.id ? parseInt(selectedCustomer.id) : 0} />
                  </Box>
                </PermissionGuard>
                */}
                <PermissionGuard permissionCode="customer.view.recent_activity" fallback={null}>
                  <Box sx={{ flex: '1' }}>
                    <RecentContactHistoryVariantC customerId={selectedCustomer?.id ? parseInt(selectedCustomer.id) : 0} />
                  </Box>
                </PermissionGuard>
              </Box>

              {/* Customer Notes Section */}
              <Box sx={{ mb: 3 }}>
                <NotesSection
                  customerId={customerDetails?.customerId ?? selectedCustomer?.customerId ?? 0}
                  targetType="customer"
                />
              </Box>

              {/* Deposits with proper container */}
              <PermissionGuard permissionCode="customer.view.deposits" fallback={null}>
                <Box sx={{ mb: 3 }}>
                  <Deposits customerId={selectedCustomer?.id ? parseInt(selectedCustomer.id) : 0} />
                </Box>
              </PermissionGuard>

              {/* Account List */}
              <AccountList
                customerId={selectedCustomer?.id ? parseInt(selectedCustomer.id) : 0}
                onViewAccountDetail={handleViewAccountDetail}
              />
            </>
          )}

          {selectedCustomer && activeTab === 'accounts' && (
            <PermissionGuard
              permissionCode="accounts.view"
              fallback={
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <AccountBalance sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h5" color="text.secondary" gutterBottom>
                    Access Restricted
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    You do not have permission to view the accounts page.
                  </Typography>
                </Box>
              }
            >
              {/* Account Portfolio Table */}
              <Box sx={{ mb: 3 }}>
                <AccountSummaryTableVersion
                  accounts={realCustomerAccounts || mockAccounts || []}
                  selectedAccountId={selectedAccountId}
                  onAccountSelect={handleAccountSelect}
                />
              </Box>

              {/* Transaction History */}
              <Box sx={{ mb: 3 }}>
                <TransactionHistory
                  customerId={customerDetails?.customerId ?? selectedCustomer?.customerId ?? 0}
                  selectedAccountId={selectedAccountId}
                  selectedAccountLabel={selectedAccountLabel}
                />
              </Box>
            </PermissionGuard>
          )}

          {selectedCustomer && activeTab === 'accountSummary' && (
            <PermissionGuard
              permissionCode="accounts.view"
              fallback={
                <Box sx={{ textAlign: 'center', py: 8 }}>
                  <AccountBalance sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                  <Typography variant="h5" color="text.secondary" gutterBottom>
                    Access Restricted
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    You do not have permission to view account details.
                  </Typography>
                </Box>
              }
            >
              {selectedDetailAccountId ? (
                <>
                  {/* Client Info Bar */}
                  <Box sx={{ mb: 2, p: 2, bgcolor: 'action.hover', borderRadius: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Household: {customerHouseholds[0]?.householdName || 'N/A'} | Client: {customerDetails?.name || selectedCustomer?.name || '—'} | CIF: {customerDetails?.cifNumber || 'N/A'}
                    </Typography>
                  </Box>

                  {/* Account Detail inline */}
                  <AccountDetailOption2
                    accountId={String(selectedDetailAccountId)}
                    onBack={() =>
                      navigateWithMergedSearch(navigate, "/ciq/client")
                    }
                  />
                </>
              ) : (
                <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                  <Card variant="outlined" sx={{ maxWidth: 500, textAlign: 'center', p: 4 }}>
                    <CardContent>
                      <AccountBalance sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                      <Typography variant="h5" gutterBottom>
                        No Account Selected
                      </Typography>
                      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
                        Select an account from the Client tab's account list to view detailed account information.
                      </Typography>
                      <Button
                        variant="outlined"
                        startIcon={<ArrowBack />}
                        onClick={() => {
                          navigateWithMergedSearch(navigate, "/ciq/client");
                        }}
                      >
                        GO TO CLIENT TAB
                      </Button>
                    </CardContent>
                  </Card>
                </Box>
              )}
            </PermissionGuard>
          )}
        </Container>

      </Box>
    </ThemeProvider>
  );
}