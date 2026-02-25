import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Box, ThemeProvider } from "@mui/material";
import { lightTheme } from "@/lib/theme";
import { AuthProvider } from "@/contexts/AuthContext";
import TopBar from "@/components/TopBar";
import CustomerDashboard from "@/components/CustomerDashboard";
import UserManagement from "@/pages/UserManagement";
import HouseholdPage from "@/pages/HouseholdPage";
import HouseholdPageOption1 from "@/pages/HouseholdPageOption1";
import HouseholdPageOption2 from "@/pages/HouseholdPageOption2";
import AccountDetailOption1 from "@/components/AccountDetailOption1";
import AccountDetailOption2 from "@/components/AccountDetailOption2";
import AccountDetailOption3 from "@/components/AccountDetailOption3";
import AccountDetailSavings from "@/components/AccountDetailSavings";
import AccountDetailCD from "@/components/AccountDetailCD";
import AccountDetailCreditCard from "@/components/AccountDetailCreditCard";
import AccountDetailMortgage from "@/components/AccountDetailMortgage";
import AccountDetailHELOC from "@/components/AccountDetailHELOC";
import NotFound from "@/pages/not-found";

function Router() {
  return (
    <Switch>
      <Route path="/" component={CustomerDashboard} />
      <Route path="/admin/users" component={UserManagement} />
      <Route path="/household/customer/:customerId" component={HouseholdPage} />
      <Route path="/household/:id" component={HouseholdPage} />
      <Route path="/household/option1" component={HouseholdPageOption1} />
      <Route path="/household/option2" component={HouseholdPageOption2} />
      <Route path="/account/option1">{() => <AccountDetailOption1 />}</Route>
      <Route path="/account/option2">{() => <AccountDetailOption2 />}</Route>
      <Route path="/account/option3">{() => <AccountDetailOption3 />}</Route>
      <Route path="/account/savings">{() => <AccountDetailSavings />}</Route>
      <Route path="/account/cd">{() => <AccountDetailCD />}</Route>
      <Route path="/account/credit-card">{() => <AccountDetailCreditCard />}</Route>
      <Route path="/account/mortgage">{() => <AccountDetailMortgage />}</Route>
      <Route path="/account/heloc">{() => <AccountDetailHELOC />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider theme={lightTheme}>
          <TooltipProvider>
            <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
              <TopBar />
              <Box component="main" sx={{ flexGrow: 1, bgcolor: 'background.default' }}>
                <Router />
              </Box>
            </Box>
            <Toaster />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
