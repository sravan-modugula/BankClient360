import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import {
  Box,
  Button,
  Container,
  Paper,
  Typography,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  Stack,
  Alert,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow
} from '@mui/material';
import {
  DataGrid,
  GridColDef,
  GridRenderCellParams,
  GridToolbarContainer,
  GridToolbarFilterButton
} from '@mui/x-data-grid';
import {
  ArrowBack,
  AdminPanelSettings,
  Sync,
  Edit,
  Delete,
  Add
} from '@mui/icons-material';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { UserListItem, Role, SamlRoleMapping } from '@shared/schema';

export default function UserManagement() {
  const [currentTab, setCurrentTab] = useState(0);

  return (
    <Container maxWidth="xl" sx={{ py: 4 }}>
      <Box sx={{ mb: 3, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <IconButton component={Link} href="/" data-testid="button-back">
            <ArrowBack />
          </IconButton>
          <Typography variant="h4" component="h1">
            User & Role Management
          </Typography>
        </Box>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>
        System Admin (Level 4) Only - Users login via SAML SSO. Roles are auto-assigned based on SAML attributes or manually assigned by admins.
      </Alert>

      <Paper sx={{ mb: 3 }}>
        <Tabs value={currentTab} onChange={(_, v) => setCurrentTab(v)}>
          <Tab label="Active Users" data-testid="tab-users" />
          <Tab label="SAML Role Mappings" data-testid="tab-saml-mappings" />
        </Tabs>
      </Paper>

      {currentTab === 0 && <ActiveUsersPanel />}
      {currentTab === 1 && <SamlMappingsPanel />}
    </Container>
  );
}

function ActiveUsersPanel() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<number | ''>('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);

  // Build URL with query parameters
  const buildUsersUrl = () => {
    const params = new URLSearchParams();
    if (searchTerm) params.append('search', searchTerm);
    if (roleFilter) params.append('roleId', roleFilter.toString());
    const queryString = params.toString();
    return queryString ? `/api/admin/users?${queryString}` : '/api/admin/users';
  };

  const { data: users = [], isLoading } = useQuery<UserListItem[]>({
    queryKey: [buildUsersUrl()],
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['/api/admin/roles'],
  });

  const filteredUsers = users.filter(u => {
    if (sourceFilter === 'saml') return u.roleAssignmentSource === 'saml';
    if (sourceFilter === 'manual') return u.roleAssignmentSource === 'manual';
    if (sourceFilter === 'needs_assignment') return !u.roleAssignmentSource || !u.primaryRoleName;
    return true;
  });

  function getStatusBadge(user: UserListItem) {
    if (!user.primaryRoleName || !user.roleAssignmentSource) {
      return <Chip label="Needs Role Assignment" size="small" color="secondary" data-testid={`status-needs-assignment-${user.employeeId}`} />;
    }
    if (user.roleAssignmentSource === 'saml') {
      return <Chip label="SAML Synced" size="small" color="primary" icon={<Sync />} data-testid={`status-saml-${user.employeeId}`} />;
    }
    return <Chip label="Manually Assigned" size="small" color="default" data-testid={`status-manual-${user.employeeId}`} />;
  }

  const columns: GridColDef[] = [
    {
      field: 'employeeNumber',
      headerName: 'Employee #',
      width: 130,
    },
    {
      field: 'fullName',
      headerName: 'Name',
      width: 200,
      valueGetter: (_, row) => `${row.firstName} ${row.lastName}`,
    },
    {
      field: 'email',
      headerName: 'Email',
      width: 220,
    },
    {
      field: 'department',
      headerName: 'Department',
      width: 150,
    },
    {
      field: 'primaryRoleName',
      headerName: 'Current Role',
      width: 180,
      renderCell: (params: GridRenderCellParams) => (
        <Chip 
          label={params.value || 'No Role'} 
          size="small"
          color={params.row.privilegeLevel === 4 ? 'primary' : 'default'}
          data-testid={`role-${params.row.employeeId}`}
        />
      ),
    },
    {
      field: 'roleAssignmentSource',
      headerName: 'Assignment Status',
      width: 200,
      renderCell: (params: GridRenderCellParams) => getStatusBadge(params.row),
    },
    {
      field: 'lastSeenSamlRole',
      headerName: 'SAML Role',
      width: 160,
      renderCell: (params: GridRenderCellParams) => (
        params.value ? (
          <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>{params.value}</Typography>
        ) : (
          <Typography variant="caption" color="text.secondary">None</Typography>
        )
      ),
    },
    {
      field: 'actions',
      headerName: 'Actions',
      width: 120,
      sortable: false,
      renderCell: (params: GridRenderCellParams) => (
        <Box>
          <IconButton
            size="small"
            onClick={() => {
              setSelectedUser(params.row);
              setRoleDialogOpen(true);
            }}
            data-testid={`button-assign-role-${params.row.employeeId}`}
          >
            <AdminPanelSettings fontSize="small" />
          </IconButton>
        </Box>
      ),
    },
  ];

  function CustomToolbar() {
    return (
      <GridToolbarContainer>
        <GridToolbarFilterButton />
      </GridToolbarContainer>
    );
  }

  return (
    <>
      <Paper sx={{ mb: 3, p: 2 }}>
        <Stack direction="row" spacing={2}>
          <TextField
            label="Search"
            variant="outlined"
            size="small"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, employee #"
            sx={{ flexGrow: 1 }}
            data-testid="input-search"
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Role</InputLabel>
            <Select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as number | '')}
              label="Role"
              data-testid="select-role-filter"
            >
              <MenuItem value="">All Roles</MenuItem>
              {roles.map((role) => (
                <MenuItem key={role.roleId} value={role.roleId}>
                  {role.roleName}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 180 }}>
            <InputLabel>Assignment Source</InputLabel>
            <Select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              label="Assignment Source"
              data-testid="select-source-filter"
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="saml">SAML Synced</MenuItem>
              <MenuItem value="manual">Manually Assigned</MenuItem>
              <MenuItem value="needs_assignment">Needs Assignment</MenuItem>
            </Select>
          </FormControl>
        </Stack>
      </Paper>

      <Paper sx={{ height: 600 }}>
        <DataGrid
          rows={filteredUsers}
          columns={columns}
          loading={isLoading}
          getRowId={(row) => row.employeeId}
          pageSizeOptions={[25, 50, 100]}
          initialState={{
            pagination: { paginationModel: { pageSize: 25 } },
          }}
          slots={{
            toolbar: CustomToolbar,
          }}
          disableRowSelectionOnClick
          sx={{
            '& .MuiDataGrid-row:hover': {
              cursor: 'pointer',
            },
          }}
        />
      </Paper>

      <ManualRoleAssignmentDialog
        open={roleDialogOpen}
        onClose={() => {
          setRoleDialogOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        roles={roles}
      />
    </>
  );
}

function ManualRoleAssignmentDialog({
  open,
  onClose,
  user,
  roles
}: {
  open: boolean;
  onClose: () => void;
  user: UserListItem | null;
  roles: Role[];
}) {
  const { toast } = useToast();
  const [roleId, setRoleId] = useState<number>(0);
  const [reason, setReason] = useState('');

  // Pre-select current role when dialog opens
  if (open && user && roleId === 0 && user.primaryRoleName) {
    const currentRole = roles.find(r => r.roleName === user.primaryRoleName);
    if (currentRole) {
      setRoleId(currentRole.roleId);
    }
  }

  const assignRoleMutation = useMutation({
    mutationFn: async (data: { employeeId: number; roleId: number; reason: string }) => {
      const response = await fetch(`/api/admin/users/${data.employeeId}/roles/manual`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roleId: data.roleId, reason: data.reason }),
        credentials: 'include'
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      onClose();
      setRoleId(0);
      setReason('');
      toast({ title: 'Role assigned successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to assign role', description: error.message, variant: 'destructive' });
    }
  });

  const handleSubmit = () => {
    if (!user || !roleId || !reason.trim()) {
      toast({ title: 'Please select a role and provide a reason', variant: 'destructive' });
      return;
    }
    assignRoleMutation.mutate({ employeeId: user.employeeId, roleId, reason });
  };

  if (!user) return null;

  const selectedRole = roles.find(r => r.roleId === roleId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Manually Assign Role - {user.firstName} {user.lastName}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">
            <strong>Current Role:</strong> {user.primaryRoleName || 'None'} (Level {user.privilegeLevel || 'N/A'})<br />
            <strong>Assignment Source:</strong> {user.roleAssignmentSource === 'saml' ? 'SAML Auto-Assigned' : user.roleAssignmentSource === 'manual' ? 'Manually Assigned' : 'Not Assigned'}<br />
            {user.lastSeenSamlRole && (
              <>
                <strong>SAML Role:</strong> {user.lastSeenSamlRole}
              </>
            )}
          </Alert>
          
          {user.roleAssignmentSource === 'saml' && (
            <Alert severity="warning">
              This user has a SAML-synced role. Manual assignment will override SAML until the next login (for "initial" mode) or will be overridden on next login (for "enforced" mode).
            </Alert>
          )}

          <FormControl fullWidth required>
            <InputLabel>New Role</InputLabel>
            <Select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value as number)}
              label="New Role"
              data-testid="select-new-role"
            >
              {roles.map((role) => (
                <MenuItem key={role.roleId} value={role.roleId}>
                  {role.roleName} (Level {role.privilegeLevel})
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {selectedRole && (
            <Alert severity="info">
              <strong>{selectedRole.roleName}:</strong> {selectedRole.description}
            </Alert>
          )}
          
          <TextField
            label="Reason for Manual Assignment"
            multiline
            rows={3}
            required
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            helperText="Required for audit trail - will be logged as source='manual'"
            data-testid="input-reason"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} data-testid="button-cancel-role">Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={assignRoleMutation.isPending || !roleId || !reason.trim()}
          data-testid="button-submit-role"
        >
          Assign Role Manually
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function SamlMappingsPanel() {
  const { toast } = useToast();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedMapping, setSelectedMapping] = useState<SamlRoleMapping | null>(null);

  const { data: mappings = [], isLoading } = useQuery<SamlRoleMapping[]>({
    queryKey: ['/api/admin/saml-mappings'],
  });

  const { data: roles = [] } = useQuery<Role[]>({
    queryKey: ['/api/admin/roles'],
  });

  const deleteMutation = useMutation({
    mutationFn: async (mappingId: number) => {
      const response = await fetch(`/api/admin/saml-mappings/${mappingId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/saml-mappings'] });
      toast({ title: 'SAML mapping deleted successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to delete mapping', description: error.message, variant: 'destructive' });
    }
  });

  return (
    <>
      <Paper sx={{ mb: 2, p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6">SAML Role Mappings</Typography>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setCreateDialogOpen(true)}
            data-testid="button-create-mapping"
          >
            Add Mapping
          </Button>
        </Box>
      </Paper>

      <Alert severity="info" sx={{ mb: 2 }}>
        SAML mappings connect SAML role attributes from your Identity Provider to application roles. 
        <strong> Initial</strong> mode assigns once on first login. <strong>Enforced</strong> mode reassigns on every login and auto-revokes when SAML role is removed.
      </Alert>

      <TableContainer component={Paper} sx={{ borderLeft: 'none', borderRight: 'none' }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>SAML Role Key</TableCell>
              <TableCell>Application Role</TableCell>
              <TableCell>Sync Mode</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Description</TableCell>
              <TableCell>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} align="center">Loading...</TableCell>
              </TableRow>
            ) : mappings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} align="center">No SAML mappings configured</TableCell>
              </TableRow>
            ) : (
              mappings.map((mapping) => {
                const role = roles.find(r => r.roleId === mapping.roleId);
                return (
                  <TableRow key={mapping.mappingId} data-testid={`mapping-row-${mapping.mappingId}`}>
                    <TableCell>
                      <Typography sx={{ fontFamily: 'monospace', fontWeight: 400 }}>
                        {mapping.samlRoleKey}
                      </Typography>
                    </TableCell>
                    <TableCell>{role?.roleName || 'Unknown Role'}</TableCell>
                    <TableCell>
                      <Chip 
                        label={mapping.syncMode === 'enforced' ? 'Enforced' : 'Initial'} 
                        size="small"
                        color={mapping.syncMode === 'enforced' ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip 
                        label={mapping.isActive ? 'Active' : 'Inactive'} 
                        size="small"
                        color={mapping.isActive ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>{mapping.description || '-'}</TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => {
                          setSelectedMapping(mapping);
                          setEditDialogOpen(true);
                        }}
                        data-testid={`button-edit-mapping-${mapping.mappingId}`}
                      >
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        color="primary"
                        onClick={() => {
                          if (window.confirm(`Delete SAML mapping for "${mapping.samlRoleKey}"?`)) {
                            deleteMutation.mutate(mapping.mappingId);
                          }
                        }}
                        data-testid={`button-delete-mapping-${mapping.mappingId}`}
                      >
                        <Delete fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <CreateMappingDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        roles={roles}
      />

      <EditMappingDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedMapping(null);
        }}
        mapping={selectedMapping}
        roles={roles}
      />
    </>
  );
}

function CreateMappingDialog({
  open,
  onClose,
  roles
}: {
  open: boolean;
  onClose: () => void;
  roles: Role[];
}) {
  const { toast } = useToast();
  const [samlRoleKey, setSamlRoleKey] = useState('');
  const [roleId, setRoleId] = useState<number>(0);
  const [syncMode, setSyncMode] = useState<'initial' | 'enforced'>('initial');
  const [description, setDescription] = useState('');

  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/admin/saml-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/saml-mappings'] });
      onClose();
      setSamlRoleKey('');
      setRoleId(0);
      setSyncMode('initial');
      setDescription('');
      toast({ title: 'SAML mapping created successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to create mapping', description: error.message, variant: 'destructive' });
    }
  });

  const handleSubmit = () => {
    if (!samlRoleKey.trim() || !roleId) {
      toast({ title: 'Please provide SAML role key and select an application role', variant: 'destructive' });
      return;
    }
    createMutation.mutate({ samlRoleKey, roleId, syncMode, description });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Create SAML Role Mapping</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <TextField
            label="SAML Role Key"
            required
            value={samlRoleKey}
            onChange={(e) => setSamlRoleKey(e.target.value)}
            placeholder="e.g., System_Admin, Branch_Manager"
            helperText="The exact SAML role attribute value from your Identity Provider"
            data-testid="input-saml-role-key"
          />
          
          <FormControl fullWidth required>
            <InputLabel>Application Role</InputLabel>
            <Select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value as number)}
              label="Application Role"
              data-testid="select-app-role"
            >
              {roles.map((role) => (
                <MenuItem key={role.roleId} value={role.roleId}>
                  {role.roleName} (Level {role.privilegeLevel})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth required>
            <InputLabel>Sync Mode</InputLabel>
            <Select
              value={syncMode}
              onChange={(e) => setSyncMode(e.target.value as 'initial' | 'enforced')}
              label="Sync Mode"
              data-testid="select-sync-mode"
            >
              <MenuItem value="initial">Initial (Assign once, preserve manual changes)</MenuItem>
              <MenuItem value="enforced">Enforced (Reassign every login, auto-revoke if SAML role removed)</MenuItem>
            </Select>
          </FormControl>

          {syncMode === 'enforced' && (
            <Alert severity="warning">
              <strong>Enforced Mode:</strong> User roles will be automatically updated on every login. If the SAML role is removed, access will be revoked.
            </Alert>
          )}

          <TextField
            label="Description (Optional)"
            multiline
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            data-testid="input-description"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} data-testid="button-cancel-create">Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={createMutation.isPending || !samlRoleKey.trim() || !roleId}
          data-testid="button-submit-create"
        >
          Create Mapping
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function EditMappingDialog({
  open,
  onClose,
  mapping,
  roles
}: {
  open: boolean;
  onClose: () => void;
  mapping: SamlRoleMapping | null;
  roles: Role[];
}) {
  const { toast } = useToast();
  const [syncMode, setSyncMode] = useState<'initial' | 'enforced'>((mapping?.syncMode as 'initial' | 'enforced') || 'initial');
  const [description, setDescription] = useState(mapping?.description || '');
  const [isActive, setIsActive] = useState(mapping?.isActive ?? true);

  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!mapping) throw new Error('No mapping selected');
      const response = await fetch(`/api/admin/saml-mappings/${mapping.mappingId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
        credentials: 'include'
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/saml-mappings'] });
      onClose();
      toast({ title: 'SAML mapping updated successfully' });
    },
    onError: (error: any) => {
      toast({ title: 'Failed to update mapping', description: error.message, variant: 'destructive' });
    }
  });

  const handleSubmit = () => {
    if (!mapping) return;
    updateMutation.mutate({ syncMode, description, isActive });
  };

  if (!mapping) return null;

  const role = roles.find(r => r.roleId === mapping.roleId);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Edit SAML Mapping - {mapping.samlRoleKey}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          <Alert severity="info">
            <strong>SAML Role:</strong> {mapping.samlRoleKey}<br />
            <strong>Application Role:</strong> {role?.roleName}
          </Alert>

          <FormControl fullWidth required>
            <InputLabel>Sync Mode</InputLabel>
            <Select
              value={syncMode}
              onChange={(e) => setSyncMode(e.target.value as 'initial' | 'enforced')}
              label="Sync Mode"
              data-testid="select-edit-sync-mode"
            >
              <MenuItem value="initial">Initial (Assign once)</MenuItem>
              <MenuItem value="enforced">Enforced (Reassign every login)</MenuItem>
            </Select>
          </FormControl>

          <FormControl fullWidth required>
            <InputLabel>Status</InputLabel>
            <Select
              value={isActive ? 'active' : 'inactive'}
              onChange={(e) => setIsActive(e.target.value === 'active')}
              label="Status"
              data-testid="select-edit-status"
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
          </FormControl>

          <TextField
            label="Description"
            multiline
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            data-testid="input-edit-description"
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} data-testid="button-cancel-edit">Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          disabled={updateMutation.isPending}
          data-testid="button-submit-edit"
        >
          Update Mapping
        </Button>
      </DialogActions>
    </Dialog>
  );
}
