import { createTheme } from '@mui/material/styles';

export const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1b4d20', // Dark green
    },
    secondary: {
      main: '#936b06', // Gold
    },
    success: {
      main: '#1b4d20', // Dark green
      dark: '#1b4d20',
    },
    info: {
      main: '#1b4d20', // Dark green (no blue)
      dark: '#1b4d20',
    },
    background: {
      default: '#ffffff',
      paper: '#ffffff',
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

export const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#1b4d20', // Dark green
    },
    secondary: {
      main: '#936b06', // Gold
    },
    success: {
      main: '#1b4d20', // Dark green
      dark: '#1b4d20',
    },
    info: {
      main: '#1b4d20', // Dark green (no blue)
      dark: '#1b4d20',
    },
    background: {
      default: 'hsl(220, 10%, 8%)',
      paper: 'hsl(220, 8%, 12%)',
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
