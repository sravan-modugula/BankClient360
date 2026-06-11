import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Divider,
  Alert,
  CircularProgress,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Drawer,
  Stack,
  Tooltip
} from '@mui/material';
import {
  NoteAdd,
  Search,
  FilterList,
  History,
  PushPin,
  Gavel,
  Description,
  Close,
  Edit,
  Circle,
  Delete,
  Restore
} from '@mui/icons-material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDateFormatter } from '@/lib/dateFormatters';
import NoteEditorModal from './NoteEditorModal';
import NoteVersionHistoryModal from './NoteVersionHistoryModal';

interface Note {
  noteId: number;
  customerId?: number | null;
  accountId?: number | null;
  targetType: 'customer' | 'account';
  categoryId?: number | null;
  categoryName?: string | null;
  importance?: string | null;
  visibility?: string | null;
  title: string;
  body?: string | null;
  currentVersion?: number | null;
  isPinned?: boolean | null;
  legalHold?: boolean | null;
  retentionYears?: number | null;
  isDeleted?: boolean | null;
  createdAt: string;
  updatedAt: string;
  createdByName?: string | null;
  lastModifiedByName?: string | null;
}

interface NoteCategory {
  categoryId: number;
  categoryName: string;
  description?: string | null;
}

interface NotesSectionProps {
  customerId: number;
  targetType?: 'customer' | 'account';
}

// Utility functions for safe data access
const safeString = (value: string | null | undefined, fallback: string = ''): string => {
  return value ?? fallback;
};

const safeNumber = (value: number | null | undefined, fallback: number = 0): number => {
  return value ?? fallback;
};

const safeBoolean = (value: boolean | null | undefined, fallback: boolean = false): boolean => {
  return value ?? fallback;
};

const truncateText = (text: string | null | undefined, maxLength: number): string => {
  const safeText = safeString(text);
  return safeText.length > maxLength ? `${safeText.substring(0, maxLength)}...` : safeText;
};

export default function NotesSection({ customerId, targetType = 'customer' }: NotesSectionProps) {
  const { formatDate } = useDateFormatter();
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<number | ''>('');
  const [filterImportance, setFilterImportance] = useState<string>('');
  const [showFilters, setShowFilters] = useState(false);
  const [showDeleted, setShowDeleted] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<number | null>(null);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);
  const [detailDrawerOpen, setDetailDrawerOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  // Validate customerId - must be pure boolean for react-query
  const validCustomerId = customerId > 0;

  // Fetch notes with error handling
  const { data: notesData, isLoading: notesLoading, error: notesError } = useQuery({
    queryKey: [`/api/${targetType}s/${customerId}/notes`, showDeleted],
    queryFn: async () => {
      const url = `/api/${targetType}s/${customerId}/notes${showDeleted ? '?includeDeleted=true' : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        throw new Error(`Failed to fetch notes: ${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    enabled: validCustomerId,
    retry: 1,
    staleTime: 30000
  });

  // Fetch categories with error handling
  const { data: categoriesData, error: categoriesError } = useQuery({
    queryKey: ['/api/note-categories'],
    retry: 1,
    staleTime: 60000
  });

  const queryClient = useQueryClient();

  // Invalidate without the showDeleted flag so both Active and Deleted views refetch.
  const notesQueryRoot = [`/api/${targetType}s/${customerId}/notes`];

  const deleteMutation = useMutation({
    mutationFn: async (noteId: number) => {
      const res = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      if (!res.ok) {
        throw new Error(`Failed to delete note: ${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notesQueryRoot, refetchType: 'all' });
      handleCloseDrawer();
    }
  });

  const restoreMutation = useMutation({
    mutationFn: async (noteId: number) => {
      const res = await fetch(`/api/notes/${noteId}/restore`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      if (!res.ok) {
        throw new Error(`Failed to restore note: ${res.status} ${res.statusText}`);
      }
      return res.json();
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: notesQueryRoot, refetchType: 'all' });
      handleCloseDrawer();
    }
  });

  // Normalize and validate notes array - add convenience fields while preserving currentVersion
  const notes: Note[] = Array.isArray((notesData as any)?.notes) 
    ? (notesData as any).notes
        .filter((note: any) => note && typeof note === 'object' && note.noteId !== undefined)
        .map((note: any) => {
          const cv = note.currentVersion || {};
          return {
            ...note,
            // Add convenience fields for filtering and display
            title: cv.title || '',
            body: cv.body || '',
            // Preserve full currentVersion object for version history and metadata
            currentVersion: note.currentVersion
          } as Note;
        })
    : [];

  // Safely extract categories
  const categories: NoteCategory[] = Array.isArray((categoriesData as any)?.categories) 
    ? (categoriesData as any).categories.filter((cat: any) =>
        cat &&
        typeof cat === 'object' &&
        cat.categoryId !== undefined &&
        cat.categoryName !== undefined
      )
    : [];

  // Filter and sort notes with null-safe comparisons
  const filteredNotes = notes.filter(note => {
    const title = safeString((note as any).title).toLowerCase();
    const body = safeString((note as any).body).toLowerCase();
    const searchLower = searchQuery.toLowerCase();
    
    const matchesSearch = !searchQuery || 
      title.includes(searchLower) ||
      body.includes(searchLower);
    
    const matchesCategory = !filterCategory || note.categoryId === filterCategory;
    const matchesImportance = !filterImportance || safeString(note.importance) === filterImportance;
    
    return matchesSearch && matchesCategory && matchesImportance;
  }).sort((a, b) => {
    // Pinned notes first (null-safe)
    const aPinned = safeBoolean(a.isPinned);
    const bPinned = safeBoolean(b.isPinned);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    
    // Then by updated date (null-safe)
    const aDate = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const bDate = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return bDate - aDate;
  });

  const getImportanceColor = (importance: string | null | undefined): string => {
    const safeImportance = safeString(importance).toLowerCase();
    switch (safeImportance) {
      case 'urgent': return '#1b4d20'; // Primary green (4.54:1 contrast with white)
      case 'high': return '#7a5604'; // Darker gold (4.57:1 contrast with white)
      case 'medium': return '#616161'; // Gray 700 (5.74:1 contrast with white)
      case 'low': return '#757575'; // Gray 600 (4.54:1 contrast with white)
      default: return '#757575';
    }
  };

  const getImportanceTextColor = (importance: string | null | undefined): string => {
    // All importance levels use white text on their respective backgrounds
    return '#fff';
  };

  const getVisibilityLabel = (visibility: string | null | undefined): string => {
    const safeVisibility = safeString(visibility, 'internal');
    return safeVisibility.charAt(0).toUpperCase() + safeVisibility.slice(1);
  };

  const handleRowClick = (note: Note) => {
    setSelectedNote(note);
    setDetailDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDetailDrawerOpen(false);
    setSelectedNote(null);
  };

  const handleOpenVersionHistory = (noteId: number) => {
    setSelectedNoteId(noteId);
    setVersionHistoryOpen(true);
  };

  const handleEditNote = (noteId: number) => {
    setEditingNoteId(noteId);
    setEditorOpen(true);
    setDetailDrawerOpen(false);
  };

  const handleCloseEditor = () => {
    setEditorOpen(false);
    setEditingNoteId(null);
  };

  // Show error state
  if (notesError) {
    return (
      <Box sx={{ width: '100%' }}>
        <Typography variant="h5" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <Description color="primary" />
          Customer Notes
        </Typography>
        <Divider sx={{ mb: 3 }} />
        <Alert severity="error">
          Failed to load notes. Please try again later.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      {/* Integrated Table Shell - Everything in one container */}
      {notesLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <TableContainer component={Paper} elevation={2} sx={{ borderLeft: 'none', borderRight: 'none' }}>
          {/* Toolbar inside table container */}
          <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
            {/* Top Row: Title + Controls */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Description color="primary" />
                Customer Notes
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                <ToggleButtonGroup
                  value={showDeleted ? 'deleted' : 'active'}
                  exclusive
                  onChange={(_, value) => {
                    if (value !== null) {
                      setShowDeleted(value === 'deleted');
                    }
                  }}
                  size="small"
                >
                  <ToggleButton value="active" data-testid="button-show-active">
                    Active
                  </ToggleButton>
                  <ToggleButton value="deleted" data-testid="button-show-deleted">
                    Deleted
                  </ToggleButton>
                </ToggleButtonGroup>
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
                <Button
                  variant="text"
                  size="small"
                  startIcon={<NoteAdd />}
                  onClick={() => setEditorOpen(true)}
                  data-testid="button-create-note"
                  disabled={!validCustomerId}
                  sx={{ minWidth: 'auto' }}
                >
                  New
                </Button>
              </Box>
            </Box>

            {/* Search Row */}
            <TextField
              placeholder="Search notes..."
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
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value as number | '')}
                    label="Category"
                    data-testid="select-filter-category"
                  >
                    <MenuItem value="">All Categories</MenuItem>
                    {categories.map(cat => (
                      <MenuItem key={cat.categoryId} value={cat.categoryId}>
                        {safeString(cat.categoryName, 'Unnamed Category')}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

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
            
            {categoriesError && (
              <Alert severity="warning" sx={{ mt: 2 }}>
                Failed to load categories. Some filters may not be available.
              </Alert>
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
                {searchQuery || filterCategory || filterImportance
                  ? 'Try adjusting your filters'
                  : 'Create your first note to get started'}
              </Typography>
            </Box>
          ) : (
            <Table sx={{ minWidth: 650 }} size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 400, width: '45%' }}>Title</TableCell>
                <TableCell sx={{ fontWeight: 400, width: '20%' }}>Updated</TableCell>
                <TableCell sx={{ fontWeight: 400, width: '20%' }}>Author</TableCell>
                <TableCell sx={{ fontWeight: 400, width: '15%', textAlign: 'center' }}>Legal Hold</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredNotes.map((note) => {
                const noteAny = note as any;
                const cv = noteAny.currentVersion || {};
                const isPinned = safeBoolean(note.isPinned);
                const legalHold = safeBoolean(note.legalHold);
                const isDeleted = safeBoolean(cv.isSoftDeleted);
                const importance = safeString(note.importance, 'medium');
                const title = safeString(noteAny.title, 'Untitled');
                const body = safeString(noteAny.body);
                const lastModifiedBy = safeString(cv.authorEmployeeName || note.lastModifiedByName || note.createdByName);
                
                return (
                  <TableRow 
                    key={note.noteId}
                    hover
                    onClick={() => handleRowClick(note)}
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
                              {truncateText(body, 80)}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                    </TableCell>

                    {/* Updated Column */}
                    <TableCell>
                      <Typography variant="body2">
                        {formatDate(note.updatedAt || note.createdAt)}
                      </Typography>
                    </TableCell>

                    {/* Author Column */}
                    <TableCell>
                      <Typography variant="body2" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lastModifiedBy || '—'}
                      </Typography>
                    </TableCell>

                    {/* Legal Hold Column */}
                    <TableCell sx={{ textAlign: 'center' }}>
                      {legalHold ? (
                        <Gavel sx={{ fontSize: 20, color: 'primary.main' }} />
                      ) : (
                        <Typography variant="body2" color="text.secondary">—</Typography>
                      )}
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
        onClose={handleCloseDrawer}
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
                  {safeString((selectedNote as any).title, 'Untitled')}
                </Typography>
                <IconButton onClick={handleCloseDrawer} size="small" data-testid="button-close-drawer">
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
                    color: getImportanceTextColor(selectedNote.importance),
                    fontWeight: 400
                  }}
                />
                <Chip
                  label={getVisibilityLabel(selectedNote.visibility)}
                  size="small"
                  variant="outlined"
                />
                {(selectedNote as any).categoryName && (
                  <Chip
                    label={safeString((selectedNote as any).categoryName)}
                    size="small"
                    variant="outlined"
                  />
                )}
                <Chip
                  label={`v${safeNumber((selectedNote as any).currentVersion?.versionNumber, 1)}`}
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
                {safeString((selectedNote as any).body) || 'No content'}
              </Typography>

              <Divider sx={{ mb: 2 }} />

              {/* Additional Info */}
              <Stack spacing={1.5}>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 400 }}>
                    Created
                  </Typography>
                  <Typography variant="body2">
                    {formatDate(selectedNote.createdAt)}
                    {safeString(selectedNote.createdByName) && ` by ${selectedNote.createdByName}`}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', fontWeight: 400 }}>
                    Last Updated
                  </Typography>
                  <Typography variant="body2">
                    {formatDate(selectedNote.updatedAt)}
                    {safeString((selectedNote as any).currentVersion?.authorEmployeeName) && 
                      ` by ${(selectedNote as any).currentVersion.authorEmployeeName}`}
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
            <Box sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
              <Stack spacing={1}>
                <Button
                  variant="outlined"
                  startIcon={<History />}
                  onClick={() => handleOpenVersionHistory(selectedNote.noteId)}
                  fullWidth
                  data-testid="button-view-history-drawer"
                >
                  View Version History
                </Button>
                {!safeBoolean((selectedNote as any).currentVersion?.isSoftDeleted) ? (
                  <>
                    <Button
                      variant="outlined"
                      startIcon={<Edit />}
                      onClick={() => handleEditNote(selectedNote.noteId)}
                      fullWidth
                      data-testid="button-edit-note-drawer"
                    >
                      Edit Note
                    </Button>
                    <Button
                      variant="outlined"
                      color="error"
                      startIcon={<Delete />}
                      onClick={() => deleteMutation.mutate(selectedNote.noteId)}
                      disabled={deleteMutation.isPending}
                      fullWidth
                      data-testid="button-delete-note-drawer"
                    >
                      Delete Note
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outlined"
                    startIcon={<Restore />}
                    onClick={() => restoreMutation.mutate(selectedNote.noteId)}
                    disabled={restoreMutation.isPending}
                    fullWidth
                    data-testid="button-restore-note-drawer"
                  >
                    Restore Note
                  </Button>
                )}
              </Stack>
            </Box>
          </Box>
        )}
      </Drawer>

      {/* Note Editor Modal */}
      <NoteEditorModal
        open={editorOpen}
        onClose={handleCloseEditor}
        noteId={editingNoteId}
        targetType={targetType}
        targetId={customerId}
      />

      {/* Version History Modal */}
      <NoteVersionHistoryModal
        open={versionHistoryOpen}
        onClose={() => {
          setVersionHistoryOpen(false);
          setSelectedNoteId(null);
        }}
        noteId={selectedNoteId}
      />
    </Box>
  );
}
