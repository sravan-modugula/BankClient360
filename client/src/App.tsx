import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Box, ThemeProvider } from "@mui/material";
import { lightTheme } from "@/lib/theme";
import { AuthProvider } from "@/contexts/AuthContext";
import { EventTrackingProvider } from "@/contexts/EventTrackingContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useNavigationTracking } from "@/hooks/useNavigationTracking";
import TopBar from "@/components/TopBar";
import CustomerDashboard from "@/components/CustomerDashboard";
import UserManagement from "@/pages/UserManagement";
import HouseholdPage from "@/pages/HouseholdPage";
import HouseholdPageOption1 from "@/pages/HouseholdPageOption1";
import HouseholdPageOption2 from "@/pages/HouseholdPageOption2";
import AccountDetailOption2 from "@/components/AccountDetailOption2";
import NotFound from "@/pages/not-found";

function Router() {
  useNavigationTracking();

  return (
    <Switch>
      <Route path="/" component={CustomerDashboard} />
      <Route path="/admin/users" component={UserManagement} />
      <Route path="/household/customer/:customerId" component={HouseholdPage} />
      <Route path="/household/:id" component={HouseholdPage} />
      <Route path="/household/option1" component={HouseholdPageOption1} />
      <Route path="/household/option2" component={HouseholdPageOption2} />
      <Route path="/account/:accountId">{(params) => <AccountDetailOption2 accountId={params.accountId} />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <EventTrackingProvider>
          <ThemeProvider theme={lightTheme}>
            <TooltipProvider>
              <ErrorBoundary module="app-root">
                <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
                  <TopBar />
                  <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default' }}>
                    <Router />
                  </Box>
                </Box>
              </ErrorBoundary>
              <Toaster />
            </TooltipProvider>
          </ThemeProvider>
        </EventTrackingProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
