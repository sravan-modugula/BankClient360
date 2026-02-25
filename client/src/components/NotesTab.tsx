import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Box,
  Typography,
  TextField,
  InputAdornment,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Button,
  Chip,
  IconButton,
  Card,
  CardContent,
  Stack,
  CircularProgress,
  Tooltip
} from '@mui/material';
import {
  Search,
  Add,
  PushPin,
  Edit,
  Delete,
  History,
  Restore,
  FilterList
} from '@mui/icons-material';
import { useDateFormatter } from '@/lib/dateFormatters';
import NoteVersionHistoryModal from './NoteVersionHistoryModal';

interface Note {
  noteId: number;
  customerId?: number | null;
  accountId?: number | null;
  targetType: 'customer' | 'account';
  categoryId?: number | null;
  categoryName?: string | null;
  importance: 'low' | 'medium' | 'high' | 'urgent';
  visibility: 'public' | 'internal' | 'confidential';
  title: string;
  body: string;
  legalHold: boolean;
  retentionYears?: number | null;
  isPinned: boolean;
  isDeleted: boolean;
  deletedAt?: string | null;
  deletedByEmployeeId?: number | null;
  createdAt: string;
  updatedAt: string;
  currentVersion: number;
  authorEmployeeId: number;
  lastModifiedByEmployeeId: number;
}

interface NoteCategory {
  categoryId: number;
  name: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
}

interface NotesTabProps {
  targetType: 'customer' | 'account';
  targetId: number;
  onEdit?: (noteId: number) => void;
  onCreate?: () => void;
}

export default function NotesTab({ targetType, targetId, onEdit, onCreate }: NotesTabProps) {
  const { formatDateTime } = useDateFormatter();
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [importanceFilter, setImportanceFilter] = useState<string>('all');
  const [visibilityFilter, setVisibilityFilter] = useState<string>('all');
  const [showDeleted, setShowDeleted] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [selectedNoteId, setSelectedNoteId] = useState<number | null>(null);

  // Fetch notes
  const { data: notesData, isLoading: notesLoading, refetch: refetchNotes } = useQuery({
    queryKey: [`/api/${targetType}s/${targetId}/notes`, showDeleted],
    queryFn: async () => {
      const url = `/api/${targetType}s/${targetId}/notes${showDeleted ? '?includeDeleted=true' : ''}`;
      const res = await fetch(url, { credentials: 'include' });
      if (!res.ok) {
        throw new Error(`${res.status}: ${res.statusText}`);
      }
      return res.json();
    },
    enabled: !!targetId
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['/api/note-categories']
  });

  const notes: Note[] = (notesData as any)?.notes || [];
  const categories: NoteCategory[] = (categoriesData as any)?.categories || [];

  // Filter notes based on search and filters
  const filteredNotes = notes.filter(note => {
    const matchesSearch = !searchQuery || 
      note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.body.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = categoryFilter === 'all' || 
      (note.categoryId ? note.categoryId.toString() === categoryFilter : categoryFilter === 'none');
    
    const matchesImportance = importanceFilter === 'all' || 
      note.importance === importanceFilter;
    
    const matchesVisibility = visibilityFilter === 'all' || 
      note.visibility === visibilityFilter;

    return matchesSearch && matchesCategory && matchesImportance && matchesVisibility;
  });

  // Sort: pinned first, then by updated date
  const sortedNotes = [...filteredNotes].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  const getImportanceColor = (importance: string) => {
    switch (importance) {
      case 'urgent': return 'primary';
      case 'high': return 'secondary';
      case 'medium': return 'primary';
      default: return 'default';
    }
  };

  const getVisibilityColor = (visibility: string) => {
    switch (visibility) {
      case 'confidential': return 'primary';
      case 'internal': return 'secondary';
      default: return 'primary';
    }
  };

  if (notesLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      {/* Header with search and actions */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search notes..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          size="small"
          sx={{ flex: '1 1 300px' }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            )
          }}
          data-testid="input-search-notes"
        />
        
        <IconButton 
          onClick={() => setShowFilters(!showFilters)}
          color={showFilters ? 'primary' : 'default'}
          data-testid="button-toggle-filters"
        >
          <FilterList />
        </IconButton>

        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={onCreate}
          data-testid="button-create-note"
        >
          New Note
        </Button>
      </Box>

      {/* Filters */}
      {showFilters && (
        <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Category</InputLabel>
            <Select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              label="Category"
              data-testid="select-category-filter"
            >
              <MenuItem value="all">All Categories</MenuItem>
              <MenuItem value="none">No Category</MenuItem>
              {categories.map(cat => (
                <MenuItem key={cat.categoryId} value={cat.categoryId.toString()}>
                  {cat.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Importance</InputLabel>
            <Select
              value={importanceFilter}
              onChange={(e) => setImportanceFilter(e.target.value)}
              label="Importance"
              data-testid="select-importance-filter"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="urgent">Urgent</MenuItem>
              <MenuItem value="high">High</MenuItem>
              <MenuItem value="medium">Medium</MenuItem>
              <MenuItem value="low">Low</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Visibility</InputLabel>
            <Select
              value={visibilityFilter}
              onChange={(e) => setVisibilityFilter(e.target.value)}
              label="Visibility"
              data-testid="select-visibility-filter"
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="public">Public</MenuItem>
              <MenuItem value="internal">Internal</MenuItem>
              <MenuItem value="confidential">Confidential</MenuItem>
            </Select>
          </FormControl>

          <Button
            variant="outlined"
            size="small"
            onClick={() => setShowDeleted(!showDeleted)}
            color={showDeleted ? 'primary' : 'inherit'}
            data-testid="button-toggle-deleted"
          >
            {showDeleted ? 'Hide Deleted' : 'Show Deleted'}
          </Button>
        </Box>
      )}

      {/* Notes list */}
      {sortedNotes.length === 0 ? (
        <Box sx={{ textAlign: 'center', py: 8 }}>
          <Typography color="text.secondary">
            {notes.length === 0 ? 'No notes found' : 'No notes match your filters'}
          </Typography>
        </Box>
      ) : (
        <Stack spacing={2}>
          {sortedNotes.map(note => (
            <Card 
              key={note.noteId} 
              elevation={note.isPinned ? 3 : 1}
              sx={{ 
                bgcolor: note.isDeleted ? 'action.disabledBackground' : 'background.paper',
                border: note.isPinned ? 2 : 0,
                borderColor: 'primary.main'
              }}
              data-testid={`card-note-${note.noteId}`}
            >
              <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                  <Box sx={{ flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                      {note.isPinned && (
                        <PushPin sx={{ fontSize: 16, color: 'primary.main' }} />
                      )}
                      <Typography variant="h6" fontWeight="400" data-testid={`text-note-title-${note.noteId}`}>
                        {note.title}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 1 }}>
                      {note.categoryName && (
                        <Chip 
                          label={note.categoryName} 
                          size="small" 
                          variant="outlined"
                          data-testid={`chip-category-${note.noteId}`}
                        />
                      )}
                      <Chip 
                        label={note.importance.toUpperCase()} 
                        size="small"
                        color={getImportanceColor(note.importance) as any}
                        data-testid={`chip-importance-${note.noteId}`}
                      />
                      <Chip 
                        label={note.visibility.toUpperCase()} 
                        size="small"
                        color={getVisibilityColor(note.visibility) as any}
                        variant="outlined"
                        data-testid={`chip-visibility-${note.noteId}`}
                      />
                      {note.legalHold && (
                        <Chip 
                          label="LEGAL HOLD" 
                          size="small"
                          color="primary"
                          data-testid={`chip-legal-hold-${note.noteId}`}
                        />
                      )}
                      {note.currentVersion > 1 && (
                        <Chip 
                          label={`v${note.currentVersion}`} 
                          size="small"
                          variant="outlined"
                          data-testid={`chip-version-${note.noteId}`}
                        />
                      )}
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    {!note.isDeleted ? (
                      <>
                        <Tooltip title="Edit">
                          <IconButton 
                            size="small" 
                            onClick={() => onEdit?.(note.noteId)}
                            data-testid={`button-edit-${note.noteId}`}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Version History">
                          <IconButton 
                            size="small"
                            onClick={() => {
                              setSelectedNoteId(note.noteId);
                              setVersionHistoryOpen(true);
                            }}
                            data-testid={`button-history-${note.noteId}`}
                          >
                            <History fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton 
                            size="small" 
                            color="primary"
                            data-testid={`button-delete-${note.noteId}`}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </>
                    ) : (
                      <Tooltip title="Restore">
                        <IconButton 
                          size="small" 
                          color="primary"
                          data-testid={`button-restore-${note.noteId}`}
                        >
                          <Restore fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>

                <Typography 
                  variant="body2" 
                  color="text.secondary"
                  sx={{ 
                    mb: 1,
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden'
                  }}
                  data-testid={`text-note-body-${note.noteId}`}
                >
                  {note.body}
                </Typography>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Typography variant="caption" color="text.secondary">
                    Created: {formatDateTime(note.createdAt)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Updated: {formatDateTime(note.updatedAt)}
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          ))}
        </Stack>
      )}

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
