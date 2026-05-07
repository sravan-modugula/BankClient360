import * as React from 'react';
import { styled } from '@mui/material/styles';
import Breadcrumbs from '@mui/material/Breadcrumbs';
import Link from '@mui/material/Link';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import MuiAppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import PanelIcon from './PanelIcon';
import type { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar'
import { drawerWidth } from '../../constants';
import IconButton from '@mui/material/IconButton';
import { useLocation } from "wouter";
import { PROJECTS } from '../../projects';
import CustomerSearch from '../CustomerSearch';

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme }) => ({
  transition: theme.transitions.create(['margin', 'width'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  variants: [
    {
      props: ({ open }) => open,
      style: {
        width: `calc(100% - ${drawerWidth}px)`,
        marginLeft: `${drawerWidth}px`,
        transition: theme.transitions.create(['margin', 'width'], {
          easing: theme.transitions.easing.easeOut,
          duration: theme.transitions.duration.enteringScreen,
        }),
      },
    },
  ],
}));

interface HeaderProps {
  drawerOpen: boolean;
  handleDrawerOpen: React.MouseEventHandler;
  handleDrawerClose: React.MouseEventHandler;
}

function matchesRoute(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(route + "/");
}

export default function Header({
  drawerOpen,
  handleDrawerOpen,
  handleDrawerClose
}: HeaderProps) {
  const [locationRaw, navigate] = useLocation();
  const location = new URL(locationRaw, window.location.origin);

  const breadcrumbs = React.useMemo(() => {
    const { pathname } = location;
    const projects = PROJECTS;

    const project = projects.find(p => matchesRoute(pathname, p.route));
    if (!project) return [{ name: "Home", route: "/" }];

    const crumbs: { name: string; route: string, disable: boolean}[] = [
      { name: project.name, route: project.route, disable: project.disableRouting},
    ];

    // Subroute routes are relative to the project root.
    // "/" maps to the project index (same as project.route), anything else is appended.
    const matchingSubroutes = project.subroutes
      .map(sr => ({
        name: sr.name,
        fullRoute: sr.route === "/" ? project.route : project.route + sr.route,
      }))
      .filter(sr => sr.fullRoute !== project.route && matchesRoute(pathname, sr.fullRoute))
      .sort((a, b) => a.fullRoute.length - b.fullRoute.length);

    for (const sr of matchingSubroutes) {
      crumbs.push({ name: sr.name, route: sr.fullRoute, disable: false});
    }

    return crumbs;
  }, [location.pathname]);

  const breadcrumbItems = breadcrumbs.map((crumb, i) => {
    const isLast = i === breadcrumbs.length - 1;
    if (isLast || crumb.disable) {
      return (
        <Typography key={crumb.route} sx={{color: "#e8dcc8"}} fontSize={14}>
          {crumb.name}
        </Typography>
      );
    }
    return (
      <Link
        key={crumb.route}
        underline="hover"
        fontSize={14}
        sx={{ cursor: "pointer", color: "#e8dcc8"}}
        onClick={(e) => { e.preventDefault(); navigate(crumb.route); }}
      >
        {crumb.name}
      </Link>
    );
  });

  return (
    <AppBar position="fixed" sx={{height: 54, backgroundColor: "#1b4d20"}} open={drawerOpen} elevation={0}>
      <Toolbar>
        <IconButton
          aria-label="open drawer"
          onClick={drawerOpen ? handleDrawerClose : handleDrawerOpen }
          edge="start"
          disableRipple
          sx={{
            mr: 2,
            color: "#e8dcc8",
            // "&.Mui-focusVisible": { outline: "none", boxShadow: "none" },
            "&:focus": { outline: "none" }
          }}
        >
          <PanelIcon
            sx={{
              transform: drawerOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 200ms",
            }}
          />
        </IconButton>
        <Breadcrumbs
          separator={<NavigateNextIcon sx={{ color: "#90a8b8" }} fontSize="small" />}
          aria-label="breadcrumb"
        >
          {breadcrumbItems}
        </Breadcrumbs>

        <CustomerSearch />
      </Toolbar>
    </AppBar>
  );
}