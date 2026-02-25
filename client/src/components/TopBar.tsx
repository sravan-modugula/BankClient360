import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Box,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Typography,
  Chip,
  Alert,
  Button,
  CircularProgress
} from '@mui/material';
import {
  ManageAccounts as ManageAccountsIcon,
  Logout as LogoutIcon,
  KeyboardArrowDown as ArrowDownIcon,
  Science as ScienceIcon,
  ChevronRight as ChevronRightIcon,
  Undo as UndoIcon,
  Login as LoginIcon
} from '@mui/icons-material';
import { queryClient } from '@/lib/queryClient';
import { useAuth } from '@/contexts/AuthContext';
import clientiqLogo from '../assets/clientiq-logo.png';

interface RoleOption {
  roleId: number;
  roleName: string;
  privilegeLevel: number;
  description: string | null;
}

export default function TopBar() {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [roleTestAnchorEl, setRoleTestAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const roleTestOpen = Boolean(roleTestAnchorEl);
  const [, setLocation] = useLocation();
  
  const { isAuthenticated, isLoading, user: userInfo, login, logout } = useAuth();

  const { data: roleOptions = [] } = useQuery<RoleOption[]>({
    queryKey: ['/api/auth/role-test/options'],
    enabled: import.meta.env.DEV && isAuthenticated,
    retry: false,
  });

  const activateRoleMutation = useMutation({
    mutationFn: async (roleId: number) => {
      const response = await fetch('/api/auth/role-test/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId }),
      });
      if (!response.ok) throw new Error('Failed to activate role');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/permissions'] });
      handleCloseRoleTest();
      handleClose();
    },
  });

  const resetRoleMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/auth/role-test/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Failed to reset role');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/permissions'] });
      handleCloseRoleTest();
      handleClose();
    },
  });

  const handleClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleRoleTestClick = (event: React.MouseEvent<HTMLElement>) => {
    event.stopPropagation();
    setRoleTestAnchorEl(event.currentTarget);
  };

  const handleCloseRoleTest = () => {
    setRoleTestAnchorEl(null);
  };

  const handleActivateRole = (roleId: number) => {
    activateRoleMutation.mutate(roleId);
  };

  const handleResetRole = () => {
    resetRoleMutation.mutate();
  };

  const handleLogout = async () => {
    handleClose();
    await logout();
  };

  const handleHomeClick = () => {
    // Force a page refresh to reset customer selection
    window.location.href = '/';
  };

  const canManageUsers = userInfo?.permissions.includes('users.view');
  const isRoleTesting = userInfo?.isRoleTesting || false;
  const currentRoleName = userInfo?.roles?.[0]?.roleName || userInfo?.primaryRoleName;
  const privilegeLevel = userInfo?.roles?.[0]?.privilegeLevel || userInfo?.privilegeLevel;

  return (
    <>
      {/* Role Testing Banner */}
      {isRoleTesting && (
        <Alert 
          severity="warning" 
          sx={{ 
            borderRadius: 0, 
            borderBottom: 1, 
            borderColor: 'divider',
            py: 0.5
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <ScienceIcon fontSize="small" />
            <Typography variant="body2" sx={{ fontWeight: 400 }}>
              Role Testing Mode Active: {currentRoleName}
            </Typography>
          </Box>
        </Alert>
      )}

      <Box
        sx={{
          bgcolor: '#1b4d20', // Primary dark green
          px: 4,
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
        }}
      >
        {/* Logo and Header */}
        <Box
          onClick={handleHomeClick}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            cursor: 'pointer',
            px: 2,
            py: 1,
            borderRadius: 1,
            transition: 'background-color 0.15s, transform 0.15s',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.1)',
              transform: 'scale(1.02)'
            }
          }}
          data-testid="button-home"
        >
          {/* SVG Network Logo */}
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Primary connection lines from center to corners */}
            <line x1="18" y1="18" x2="8" y2="8" stroke="#936b06" strokeWidth="1.5" opacity="0.6"/>
            <line x1="18" y1="18" x2="28" y2="8" stroke="#936b06" strokeWidth="1.5" opacity="0.6"/>
            <line x1="18" y1="18" x2="8" y2="28" stroke="#936b06" strokeWidth="1.5" opacity="0.6"/>
            <line x1="18" y1="18" x2="28" y2="28" stroke="#936b06" strokeWidth="1.5" opacity="0.6"/>
            
            {/* Connection lines from center to edge nodes */}
            <line x1="18" y1="18" x2="18" y2="6" stroke="#936b06" strokeWidth="1.5" opacity="0.5"/>
            <line x1="18" y1="18" x2="30" y2="18" stroke="#936b06" strokeWidth="1.5" opacity="0.5"/>
            <line x1="18" y1="18" x2="18" y2="30" stroke="#936b06" strokeWidth="1.5" opacity="0.5"/>
            <line x1="18" y1="18" x2="6" y2="18" stroke="#936b06" strokeWidth="1.5" opacity="0.5"/>
            
            {/* Outer ring connections (between corner nodes) */}
            <line x1="8" y1="8" x2="28" y2="8" stroke="#936b06" strokeWidth="1" opacity="0.3"/>
            <line x1="28" y1="8" x2="28" y2="28" stroke="#936b06" strokeWidth="1" opacity="0.3"/>
            <line x1="28" y1="28" x2="8" y2="28" stroke="#936b06" strokeWidth="1" opacity="0.3"/>
            <line x1="8" y1="28" x2="8" y2="8" stroke="#936b06" strokeWidth="1" opacity="0.3"/>
            
            {/* Corner nodes */}
            <circle cx="8" cy="8" r="3" fill="#FFFFFF"/>
            <circle cx="28" cy="8" r="3" fill="#FFFFFF"/>
            <circle cx="8" cy="28" r="3" fill="#FFFFFF"/>
            <circle cx="28" cy="28" r="3" fill="#FFFFFF"/>
            
            {/* Edge nodes (top, right, bottom, left) */}
            <circle cx="18" cy="6" r="2.5" fill="#FFFFFF" opacity="0.9"/>
            <circle cx="30" cy="18" r="2.5" fill="#FFFFFF" opacity="0.9"/>
            <circle cx="18" cy="30" r="2.5" fill="#FFFFFF" opacity="0.9"/>
            <circle cx="6" cy="18" r="2.5" fill="#FFFFFF" opacity="0.9"/>
            
            {/* Center node */}
            <circle cx="18" cy="18" r="4" fill="#936b06"/>
            <circle cx="18" cy="18" r="2.5" fill="#FFFFFF"/>
          </svg>
          
          {/* Logo Text */}
          <Typography
            variant="h5"
            sx={{
              color: '#FFFFFF',
              fontWeight: 600,
              letterSpacing: '0.5px',
              fontSize: '1.4rem',
              fontFamily: '"Roboto", "Helvetica", "Arial", sans-serif'
            }}
          >
            Client<span style={{ color: '#936b06' }}>IQ</span>
          </Typography>
        </Box>

      {/* User Menu - Conditional based on authentication */}
      {isLoading ? (
        <Box sx={{ display: 'flex', alignItems: 'center', px: 2 }}>
          <CircularProgress size={24} sx={{ color: 'rgba(255, 255, 255, 0.7)' }} />
        </Box>
      ) : !isAuthenticated ? (
        <Button
          onClick={login}
          variant="outlined"
          startIcon={<LoginIcon />}
          sx={{
            color: '#FFFFFF',
            borderColor: 'rgba(255, 255, 255, 0.5)',
            '&:hover': {
              borderColor: '#FFFFFF',
              bgcolor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
          data-testid="button-login"
        >
          Login
        </Button>
      ) : (
        <Box
          onClick={handleClick}
          sx={{
            display: 'flex',
            alignItems: 'center',
            cursor: 'pointer',
            px: 1.5,
            py: 1,
            borderRadius: 1,
            transition: 'background-color 0.15s',
            '&:hover': {
              bgcolor: 'rgba(255, 255, 255, 0.1)'
            }
          }}
          data-testid="button-user-menu"
        >
          <Box sx={{ textAlign: 'right', mr: 0.75 }}>
            <Typography variant="body2" sx={{ fontWeight: 400, lineHeight: 1.4, color: '#FFFFFF', fontSize: '0.9rem' }}>
              {userInfo?.firstName && userInfo?.lastName 
                ? `${userInfo.firstName} ${userInfo.lastName}` 
                : userInfo?.email || 'User'}
            </Typography>
            {userInfo?.primaryRoleName && (
              <Typography variant="caption" sx={{ fontWeight: 300, lineHeight: 1, color: 'rgba(255, 255, 255, 0.7)', fontSize: '0.75rem' }}>
                {userInfo.primaryRoleName}
              </Typography>
            )}
          </Box>
          <ArrowDownIcon sx={{ fontSize: 18, color: 'rgba(255, 255, 255, 0.7)' }} />
        </Box>
      )}

      {/* Dropdown Menu - Only shown when authenticated */}
      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={handleClose}
        onClick={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{
          paper: {
            elevation: 3,
            sx: {
              mt: 0.5,
              minWidth: 200,
              borderRadius: 1
            }
          }
        }}
      >
        {canManageUsers && (
          <MenuItem
            component={Link}
            href="/admin/users"
            data-testid="menu-item-user-management"
          >
            <ListItemIcon>
              <ManageAccountsIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>User Management</ListItemText>
          </MenuItem>
        )}

        {/* Role Testing Menu */}
        {roleOptions.length > 0 && (
          <>
            <Divider sx={{ my: 0.5 }} />
            <MenuItem onClick={handleRoleTestClick} data-testid="menu-item-role-tester">
              <ListItemIcon>
                <ScienceIcon fontSize="small" />
              </ListItemIcon>
              <ListItemText>Role Tester</ListItemText>
              {isRoleTesting && (
                <Chip 
                  label="Active" 
                  size="small" 
                  color="secondary" 
                  sx={{ ml: 1, height: 20, fontSize: '0.7rem' }} 
                />
              )}
              <ChevronRightIcon fontSize="small" sx={{ ml: 'auto' }} />
            </MenuItem>
          </>
        )}

        <Divider sx={{ my: 0.5 }} />

        <MenuItem onClick={handleLogout} data-testid="menu-item-logout">
          <ListItemIcon>
            <LogoutIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>Logout</ListItemText>
        </MenuItem>
      </Menu>

      {/* Role Testing Submenu */}
      <Menu
        anchorEl={roleTestAnchorEl}
        open={roleTestOpen}
        onClose={handleCloseRoleTest}
        transformOrigin={{ horizontal: 'left', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'top' }}
        slotProps={{
          paper: {
            elevation: 3,
            sx: {
              minWidth: 280,
              maxHeight: 400,
              borderRadius: 1
            }
          }
        }}
      >
        <Box sx={{ px: 2, py: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 400 }}>
            Test Application as Role
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 300 }}>
            {isRoleTesting ? `Currently testing: ${currentRoleName}` : 'Select a role to test'}
          </Typography>
        </Box>

        {isRoleTesting && (
          <>
            <MenuItem 
              onClick={handleResetRole}
              data-testid="menu-item-reset-role"
              sx={{ bgcolor: 'action.hover' }}
            >
              <ListItemIcon>
                <UndoIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText 
                primary="Revert to Original Role"
                primaryTypographyProps={{ fontWeight: 400, color: 'primary' }}
              />
            </MenuItem>
            <Divider sx={{ my: 0.5 }} />
          </>
        )}

        {roleOptions.map((role) => (
          <MenuItem
            key={role.roleId}
            onClick={() => handleActivateRole(role.roleId)}
            data-testid={`menu-item-test-role-${role.roleId}`}
            selected={userInfo?.roles?.[0]?.roleId === role.roleId}
          >
            <Box sx={{ width: '100%' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Typography variant="body2" sx={{ fontWeight: 400 }}>
                  {role.roleName}
                </Typography>
                <Chip 
                  label={`Level ${role.privilegeLevel}`} 
                  size="small" 
                  sx={{ height: 20, fontSize: '0.7rem' }} 
                />
              </Box>
              {role.description && (
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 300 }}>
                  {role.description}
                </Typography>
              )}
            </Box>
          </MenuItem>
        ))}
      </Menu>
    </Box>
    </>
  );
}
