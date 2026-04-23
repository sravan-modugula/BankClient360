import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Box,
  Typography,
  IconButton,
  Alert
} from '@mui/material';
import { Close } from '@mui/icons-material';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

const noteFormSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200),
  body: z.string().min(1, 'Note content is required'),
  categoryId: z.number().nullable().optional(),
  importance: z.enum(['low', 'medium', 'high', 'urgent']),
  visibility: z.enum(['public', 'internal', 'confidential']),
  legalHold: z.boolean().optional(),
  retentionYears: z.number().int().positive().nullable().optional(),
  isPinned: z.boolean().optional()
});

type NoteFormData = z.infer<typeof noteFormSchema>;

interface NoteCategory {
  categoryId: number;
  categoryName: string;
  description?: string;
  isActive: boolean;
}

interface NoteEditorModalProps {
  open: boolean;
  onClose: () => void;
  noteId?: number | null;
  targetType: 'customer' | 'account';
  targetId: number;
}

export default function NoteEditorModal({ 
  open, 
  onClose, 
  noteId, 
  targetType, 
  targetId 
}: NoteEditorModalProps) {
  const { toast } = useToast();
  const isEditMode = !!noteId;

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isDirty }
  } = useForm<NoteFormData>({
    resolver: zodResolver(noteFormSchema),
    defaultValues: {
      title: '',
      body: '',
      categoryId: null,
      importance: 'medium',
      visibility: 'internal',
      legalHold: false,
      retentionYears: null,
      isPinned: false
    }
  });

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['/api/note-categories']
  });

  // Fetch existing note if editing
  const { data: existingNote, isLoading: loadingNote } = useQuery({
    queryKey: [`/api/notes/${noteId}`],
    enabled: isEditMode && !!noteId
  });

  const categories: NoteCategory[] = (categoriesData as any)?.categories || [];

  // Reset form when opening for a new note
  useEffect(() => {
    if (open && !isEditMode) {
      reset({
        title: '',
        body: '',
        categoryId: null,
        importance: 'medium',
        visibility: 'internal',
        legalHold: false,
        retentionYears: null,
        isPinned: false
      });
      createMutation.reset();
    }
  }, [open, isEditMode]);

  // Load existing note data into form with null safety
  useEffect(() => {
    if (existingNote && isEditMode) {
      const note = existingNote as any;
      // Title and body are in currentVersion, other fields are at root level
      reset({
        title: note?.currentVersion?.title || '',
        body: note?.currentVersion?.body || '',
        categoryId: note?.categoryId ?? null,
        importance: note?.importance || 'medium',
        visibility: note?.visibility || 'internal',
        legalHold: note?.legalHold ?? false,
        retentionYears: note?.retentionYears ?? null,
        isPinned: note?.isPinned ?? false
      });
    }
  }, [existingNote, isEditMode, reset]);

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: NoteFormData) => {
      // Filter out null values - backend expects undefined/omitted for optional fields
      const cleanedData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== null)
      );
      
      const payload = {
        ...cleanedData,
        targetType,
        [targetType === 'customer' ? 'customerId' : 'accountId']: Number(targetId)
      };
      const res = await apiRequest('POST', '/api/notes', payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${targetType}s/${targetId}/notes`] });
      toast({
        title: 'Success',
        description: 'Note created successfully'
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to create note',
        variant: 'destructive'
      });
    }
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: NoteFormData) => {
      // Filter out null values - backend expects undefined/omitted for optional fields
      const cleanedData = Object.fromEntries(
        Object.entries(data).filter(([_, value]) => value !== null)
      );
      
      const res = await apiRequest('PATCH', `/api/notes/${noteId}`, cleanedData);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${targetType}s/${targetId}/notes`] });
      queryClient.invalidateQueries({ queryKey: [`/api/notes/${noteId}`] });
      toast({
        title: 'Success',
        description: 'Note updated successfully'
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update note',
        variant: 'destructive'
      });
    }
  });

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = (data: NoteFormData) => {
    if (isEditMode) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog 
      open={open} 
      onClose={handleClose} 
      maxWidth="md" 
      fullWidth
      data-testid="dialog-note-editor"
    >
      <DialogTitle 
        component="div"
        sx={{ 
          borderBottom: 1, 
          borderColor: 'divider',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >
        <Typography variant="h6" component="span">
          {isEditMode ? 'Edit Note' : 'Create New Note'}
        </Typography>
        <IconButton onClick={handleClose} data-testid="button-close-editor">
          <Close />
        </IconButton>
      </DialogTitle>

      <form onSubmit={handleSubmit(onSubmit)}>
        <DialogContent sx={{ pt: 3 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
            {/* Title */}
            <Controller
              name="title"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Title"
                  required
                  fullWidth
                  error={!!errors.title}
                  helperText={errors.title?.message}
                  data-testid="input-note-title"
                />
              )}
            />

            {/* Body */}
            <Controller
              name="body"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label="Note Content"
                  required
                  fullWidth
                  multiline
                  rows={6}
                  error={!!errors.body}
                  helperText={errors.body?.message}
                  data-testid="input-note-body"
                />
              )}
            />

            {/* Category, Importance, Visibility row */}
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Controller
                name="categoryId"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth>
                    <InputLabel>Category</InputLabel>
                    <Select
                      {...field}
                      value={field.value || ''}
                      onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                      label="Category"
                      data-testid="select-note-category"
                    >
                      <MenuItem value="">
                        <em>No Category</em>
                      </MenuItem>
                      {categories.filter(c => c.isActive).map(cat => (
                        <MenuItem key={cat.categoryId} value={cat.categoryId}>
                          {cat.categoryName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              />

              <Controller
                name="importance"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth required>
                    <InputLabel>Importance</InputLabel>
                    <Select
                      {...field}
                      label="Importance"
                      data-testid="select-note-importance"
                    >
                      <MenuItem value="low">Low</MenuItem>
                      <MenuItem value="medium">Medium</MenuItem>
                      <MenuItem value="high">High</MenuItem>
                      <MenuItem value="urgent">Urgent</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />

              <Controller
                name="visibility"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth required>
                    <InputLabel>Visibility</InputLabel>
                    <Select
                      {...field}
                      label="Visibility"
                      data-testid="select-note-visibility"
                    >
                      <MenuItem value="public">Public</MenuItem>
                      <MenuItem value="internal">Internal</MenuItem>
                      <MenuItem value="confidential">Confidential</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
            </Box>

            {/* Retention Years */}
            <Controller
              name="retentionYears"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  value={field.value || ''}
                  onChange={(e) => field.onChange(e.target.value ? Number(e.target.value) : null)}
                  label="Retention Years"
                  type="number"
                  fullWidth
                  helperText="Number of years to retain this note (optional)"
                  data-testid="input-retention-years"
                />
              )}
            />

            {/* Switches */}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Controller
                name="legalHold"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch 
                        {...field} 
                        checked={field.value || false}
                        data-testid="switch-legal-hold"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">Legal Hold</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Prevent deletion for legal/compliance reasons
                        </Typography>
                      </Box>
                    }
                  />
                )}
              />

              <Controller
                name="isPinned"
                control={control}
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch 
                        {...field} 
                        checked={field.value || false}
                        data-testid="switch-pinned"
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body2">Pin Note</Typography>
                        <Typography variant="caption" color="text.secondary">
                          Keep this note at the top of the list
                        </Typography>
                      </Box>
                    }
                  />
                )}
              />
            </Box>

            {isEditMode && existingNote && (
              <Alert severity="info" sx={{ mt: 1 }}>
                Editing will create a new version (v{((existingNote as any).currentVersion?.versionNumber || 0) + 1})
              </Alert>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
          <Button 
            onClick={handleClose} 
            disabled={isPending}
            data-testid="button-cancel-note"
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            variant="contained"
            disabled={isPending || !isDirty}
            data-testid="button-save-note"
          >
            {isPending ? 'Saving...' : isEditMode ? 'Update Note' : 'Create Note'}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
