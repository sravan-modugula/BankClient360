import React from "react";
import { Switch, Route, Redirect } from "wouter";
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
import { createTheme } from "@mui/material";
import CustomerDashboard from "@/components/CustomerDashboard";
import UserManagement from "@/pages/UserManagement";
import HouseholdPage from "@/pages/HouseholdPage";
import HouseholdPageOption1 from "@/pages/HouseholdPageOption1";
import HouseholdPageOption2 from "@/pages/HouseholdPageOption2";
import AccountDetailOption2 from "@/components/AccountDetailOption2";
import NotFound from "@/pages/not-found";
import CssBaseline from "@mui/material/CssBaseline";
import Header from "./components/header/Header";
import Navbar from "./components/navbar/Navbar";
import { drawerWidth } from './constants';
import { DrawerHeader } from "./components/navbar/Navbar";
import { styled } from '@mui/material/styles';

import type { ThemeOptions } from "@mui/material/styles";

export const themeContract: ThemeOptions = {
  palette: {
    mode: "light",

    primary: {
      main: "#2E2E2E",       // neutral dark gray (not black)
      contrastText: "#FFFFFF",
    },

    secondary: {
      main: "#6E6E6E",       // mid-gray
      contrastText: "#FFFFFF",
    },

    background: {
      default: "#FFFFFF",
      paper: "#F9F9F9",
    },

    divider: "#E5E5E5",

    text: {
      primary: "#1C1C1C",
      secondary: "#5F5F5F",
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily: [
      "ui-sans-serif",
      "-apple-system",
      "system-ui",
      "Segoe UI",
      "Helvetica",
      "Apple Color Emoji",
      "Arial",
      "sans-serif",
      "Segoe UI Emoji",
      "Segoe UI Symbol"
    ].join(","),
  },
  mixins: {
    toolbar: {
      minHeight: 52,
      "@media (min-width:600px)": {
        minHeight: 52,
      },
    }
  },
  components: {
    MuiListItemButton: {
      styleOverrides: {
        root: {
          minHeight: 32,        // default ≈ 48
          paddingTop: 6,
          paddingBottom: 6,
          borderRadius: 8,
          marginLeft: 8,
          marginRight: 8,
          paddingLeft: 12,
          paddingRight: 12,

          // hover state
          "&:hover": {
            backgroundColor: "rgba(0, 0, 0, 0.10)",
          },

          // selected state
          "&.Mui-selected": {
            backgroundColor: "rgba(0, 0, 0, 0.06)",
            "&:hover": {
              backgroundColor: "rgba(0, 0, 0, 0.10)",
            },
          },
        },
      },
    },

    // tighten icon spacing
    MuiListItemIcon: {
      styleOverrides: {
        root: {
          minWidth: 20, // default 56
        },
      },
    },
  }
};

// TODO: allow users to select a theme they like
const theme = createTheme(themeContract);


const Main = styled('main', { shouldForwardProp: (prop) => prop !== 'open' })<{
  open?: boolean;
}>(({ theme }) => ({
  flexGrow: 1,
  // padding: theme.spacing(3),
  height: "100vh",
  display: "flex",
  flexDirection: "column",
  transition: theme.transitions.create('margin', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  marginLeft: `-${drawerWidth}px`,
  variants: [
    {
      props: ({ open }) => open,
      style: {
        transition: theme.transitions.create('margin', {
          easing: theme.transitions.easing.easeOut,
          duration: theme.transitions.duration.enteringScreen,
        }),
        marginLeft: 0,
      },
    },
  ],
}));

interface RouterProps {
  drawerOpen: boolean;
}

function Router({ drawerOpen }: RouterProps) {
  useNavigationTracking();

  return (
    <Main open={drawerOpen}>
      {/* this is just a filler component to fill space where the header would be */}
      <DrawerHeader />
      {/* this is the outlet for react router */}
      <Box sx={{ flex: 1, height: "100%", overflow: "auto", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <Switch>
          <Route path="/" component={() => <Redirect to="/ciq/client" />} />
          <Route path="/ciq/household" component={HouseholdPage} />
          <Route path="/ciq/:tabView" component={CustomerDashboard} />
          <Route path="/admin/users" component={UserManagement} />
          {/* 
            <Route path="/household/customer/:customerId" component={HouseholdPage} />
            <Route path="/household/:id" component={HouseholdPage} />
            <Route path="/household/option1" component={HouseholdPageOption1} /> 
            <Route path="/household/option2" component={HouseholdPageOption2} /> 
            <Route path="/account/:accountId">{(params) => <AccountDetailOption2 accountId={params.accountId} />}</Route> 
          */}
          <Route component={NotFound} />
        </Switch>
      </Box>
    </Main>
  );
}

function App() {

  const [drawerOpen, setDrawerOpen] = React.useState(true);

  const handleDrawerOpen: React.MouseEventHandler = () => {
    setDrawerOpen(true);
  };

  const handleDrawerClose: React.MouseEventHandler = () => {
    setDrawerOpen(false);
  };


  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <EventTrackingProvider>
          <ThemeProvider theme={theme}>
            <TooltipProvider>
              <ErrorBoundary module="app-root">
                <Box sx={{
                  display: 'flex',
                  width: "100%",
                  height: "100vh",
                }}>
                  <CssBaseline />
                  <Header
                    drawerOpen={drawerOpen}
                    handleDrawerOpen={handleDrawerOpen}
                    handleDrawerClose={handleDrawerClose}
                  />
                  <Navbar
                    drawerOpen={drawerOpen}
                    handleDrawerClose={handleDrawerClose}
                  />
                  <Router drawerOpen={drawerOpen}/>
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
