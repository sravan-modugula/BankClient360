import * as React from 'react';
import { styled } from '@mui/material/styles';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Chip from '@mui/material/Chip';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { useAuth } from '@/contexts/AuthContext';

import { useLocation } from 'wouter';
import { drawerWidth } from '../../constants';
import { PROJECTS } from '../../projects';
import type { Project, ProjectSubroute } from '../../projects';
import Logo from './Logo';
import HomeIcon from '@mui/icons-material/Home';
import { navigateWithMergedSearch } from '@/lib/navigation';


const C = {
  bg:           '#f0ece4',   // warm parchment body
  bgHover:      '#e4dfd6',   // slightly darker on hover
  bgActive:     '#d8e8d0',   // soft green tint for active subroute
  border:       '#b8945a',   // gold divider — unchanged
  textPrimary:  '#1c2e1c',   // deep forest for primary text
  textMuted:    '#4a5e4a',   // mid-tone for inactive items
  textSubdued:  '#7a8a7a',   // light for captions/roles
  activeBar:    '#2d6a2d',   // strong green for the left-edge bar + active icons
  avatarBg:     '#d8e8d0',   // light green tint avatar bg
  avatarBorder: '#a8c8a0',   // soft green avatar border
} as const;

export const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  padding: theme.spacing(0, 1),
  // necessary for content to be below app bar
  ...theme.mixins.toolbar,
  justifyContent: 'flex-end',
}));

interface NavbarProps {
  drawerOpen: boolean;
  handleDrawerClose: React.MouseEventHandler;
}

function getFullRoute(project: Project, subroute: ProjectSubroute): string {
  return subroute.route === "/" ? project.route : project.route + subroute.route;
}

export default function Navbar({ drawerOpen, handleDrawerClose }: NavbarProps) {
  const [locationRaw, navigate] = useLocation();
  const init = {}; // useInitData();
  const projects = PROJECTS;

  const { user: userInfo } = useAuth();

  const user = userInfo;

  const location = new URL(locationRaw, window.location.origin);

  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});

  // Auto-expand the project whose route matches the current path
  React.useEffect(() => {
    for (const project of projects) {
      if (location.pathname === project.route || location.pathname.startsWith(project.route + "/")) {
        setExpanded(prev => ({ ...prev, [project.shorthand]: true }));
      }
    }
  }, [location.pathname, projects]);

  function toggleExpanded(shorthand: string) {
    setExpanded(prev => ({ ...prev, [shorthand]: !prev[shorthand] }));
  }

  // Find the most specific (longest) subroute that matches the current path.
  function getActiveRoute(project: Project): string | null {
    const pathname = location.pathname;
    const matches = project.subroutes
      .map(sr => getFullRoute(project, sr))
      .filter(fr => pathname === fr || pathname.startsWith(fr + "/"))
      .sort((a, b) => b.length - a.length);
    return matches[0] ?? null;
  }

  const userInitials = user && user.firstName && user.lastName
    ? `${user.firstName[0] ?? ''}${user.lastName[0] ?? ''}`.toUpperCase()
    : '?';
  const userFullName = user ? `${user.firstName} ${user.lastName}` : '';
  const userRole = userInfo?.roles?.[0]?.roleName || userInfo?.primaryRoleName || 'User';

  return (
    <Drawer
      sx={{
        width: drawerWidth,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: drawerWidth,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          borderRight: "1px solid #c8c4ba"
        },
      }}
      slotProps={{
        paper: {
          // sx: { bgcolor: "#1b4d20b" }
          sx: { bgcolor: "#f0ece4" }
        }
      }}
      variant="persistent"
      anchor="left"
      open={drawerOpen}
    >
      {/* Header */}
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        px: 2, 
        gap: 1.5, 
        minHeight: 54, 
        flexShrink: 0, 
        bgcolor: "#1b4d20"
      }}>

        {/* Add logo to header */}
        <Logo />

        {/*
        <Chip
          label="TEST"
          size="small"
          icon={<Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: 'error.main', ml: '6px !important' }} />}
          sx={{
            height: 20,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 0.5,
            borderRadius: 1,
            bgcolor: 'rgba(211, 47, 47, 0.3)',
            color: 'error.dark',
            '& .MuiChip-label': { px: 0.75 },
            '& .MuiChip-icon': { mr: 0 },
          }}
        />
        */}

        <IconButton
          size="small"
          onClick={handleDrawerClose}
          sx={{ ml: "auto", color: "#7a9a7a", "&:focus": { outline: "none" } }}
        >
          <ChevronLeftIcon fontSize="small" />
        </IconButton>


      </Box>

      {/* Nav */}
      <Box sx={{ flexGrow: 1, overflow: 'auto', py: 1 }}>

        {/* Project header row */}
        <ListItemButton
          onClick={() => navigate("/")}
          selected={location.pathname === "/"}
          sx={{ gap: 0.75 }}
        >
          <ExpandMoreIcon fontSize="small" sx={{ visibility: "hidden", flexShrink: 0 }} />
          <HomeIcon
            fontSize="small"
            sx={{ flexShrink: 0, color: location.pathname === "/" ? C.textPrimary : C.textSubdued }}
          />
          <ListItemText
            primary={
              <Typography variant="body2" fontWeight={500} color={location.pathname === "/" ? C.textPrimary : C.textSubdued}>
                Home
              </Typography>
            }
          />
        </ListItemButton>

        <List disablePadding>
          {projects.map(project => {
            const isOpen = expanded[project.shorthand] ?? false;
            const activeRoute = getActiveRoute(project);
            const isParentActive = !!activeRoute;


            return (
              <React.Fragment key={project.shorthand}>
                {/* Project header row */}
                <ListItemButton
                  onClick={() => toggleExpanded(project.shorthand)}
                  sx={{ gap: 0.75 }}
                >
                  {isOpen
                    ? <ExpandMoreIcon fontSize="small" sx={{ color: isParentActive ? C.textPrimary : C.textSubdued, flexShrink: 0 }} />
                    : <ChevronRightIcon fontSize="small" sx={{ color: isParentActive ? C.textPrimary : C.textSubdued, flexShrink: 0 }} />
                  }
                  {<project.icon sx={{ color: isParentActive ? C.textPrimary : C.textSubdued }} />}
                  <ListItemText
                    primary={
                      <Typography variant="body2" fontWeight={500} color={isParentActive ? C.textPrimary : C.textSubdued}>
                        {project.shorthand ?? project.name}
                      </Typography>
                    }
                  />
                </ListItemButton>

                {/* Subroutes */}
                <Collapse in={isOpen} timeout="auto" unmountOnExit>
                  <List disablePadding>
                    {project.subroutes.map(sr => {
                      const fullRoute = getFullRoute(project, sr);
                      const active = activeRoute === fullRoute;
                      return (
                        <ListItemButton
                          key={sr.route}
                          selected={active}
                          onClick={() => navigateWithMergedSearch(navigate, fullRoute)}
                          sx={{ pl: 5 }}
                        >
                          <ListItemText
                            primary={
                              <Typography variant="body2" fontWeight={active ? 600 : 400} color={active ? C.textPrimary : C.textSubdued}>
                                {sr.name}
                              </Typography>
                            }
                          />
                        </ListItemButton>
                      );
                    })}
                  </List>
                </Collapse>
              </React.Fragment>
            );
          })}
        </List>
      </Box>
      
      <Divider sx={{ borderColor: "#c8c4ba"}} />

      {/* Footer */}
      <Box sx={{ display: 'flex', alignItems: 'center', px: 2, py: 1.5, gap: 1.5, flexShrink: 0 }}>
        <Avatar
          sx={{
            width: 32,
            height: 32,
            fontSize: 13,
            fontWeight: 600,
            bgcolor: C.avatarBorder,
            color: C.textMuted,
          }}
        >
          {userInitials}
        </Avatar>
        <Box sx={{ flexGrow: 1, minWidth: 0 }}>
          <Typography variant="body2" fontWeight={500} noWrap sx={{color: C.textPrimary}}>
            {userFullName}
          </Typography>
          <Typography variant="caption" noWrap sx={{color: C.textSubdued}}>
            {userRole}
          </Typography>
        </Box>
        <IconButton size="small" sx={{ color: C.textSubdued, ml: "auto"}}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Box>
    </Drawer>
  );
}