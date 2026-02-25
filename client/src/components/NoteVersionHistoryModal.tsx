import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  IconButton,
  Box,
  Typography,
  Chip,
  Paper,
  CircularProgress,
  Alert
} from '@mui/material';
import {
  Timeline,
  TimelineItem,
  TimelineSeparator,
  TimelineConnector,
  TimelineContent,
  TimelineDot,
  TimelineOppositeContent
} from '@mui/lab';
import { Close, History } from '@mui/icons-material';
import { useDateFormatter } from '@/lib/dateFormatters';

interface NoteVersion {
  versionId: number;
  noteId: number;
  versionNumber: number;
  title: string;
  body: string;
  categoryId?: number | null;
  importance?: string | null;
  visibility?: string | null;
  legalHold?: boolean | null;
  retentionYears?: number | null;
  isPinned?: boolean | null;
  authorEmployeeId?: number | null;
  createdAt: string;
}

interface NoteVersionHistoryModalProps {
  open: boolean;
  onClose: () => void;
  noteId: number | null;
}

// Helper function to safely format string values
const safeToUpperCase = (value: string | null | undefined, fallback: string = 'N/A'): string => {
  return value?.toUpperCase() || fallback;
};

// Helper function to safely format numbers
const safeNumber = (value: number | null | undefined, fallback: number = 0): number => {
  return value ?? fallback;
};

export default function NoteVersionHistoryModal({ open, onClose, noteId }: NoteVersionHistoryModalProps) {
  const { formatDateTime } = useDateFormatter();

  const { data: versionsData, isLoading, error } = useQuery({
    queryKey: [`/api/notes/${noteId}/versions`],
    enabled: open && !!noteId && noteId > 0,
    retry: 1,
    staleTime: 30000
  });

  const versions: NoteVersion[] = Array.isArray((versionsData as any)?.versions) 
    ? (versionsData as any).versions 
    : [];

  // Validate and sanitize versions
  const validVersions = versions.filter(v => 
    v && 
    typeof v === 'object' && 
    v.versionId && 
    v.versionNumber !== undefined &&
    v.title !== undefined &&
    v.body !== undefined &&
    v.createdAt
  );

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      data-testid="dialog-version-history"
    >
      <DialogTitle sx={{ 
        borderBottom: 1, 
        borderColor: 'divider',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <History />
          <Typography variant="h6">Version History</Typography>
        </Box>
        <IconButton onClick={onClose} data-testid="button-close-version-history">
          <Close />
        </IconButton>
      </DialogTitle>

      <DialogContent sx={{ pt: 3 }}>
        {isLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            Failed to load version history. Please try again.
          </Alert>
        ) : validVersions.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">No version history available</Typography>
          </Box>
        ) : (
          <Timeline position="right">
            {validVersions.map((version, index) => {
              // Safe destructuring with fallbacks
              const {
                versionId = 0,
                versionNumber = 0,
                title = 'Untitled',
                body = '',
                importance = null,
                visibility = null,
                legalHold = false,
                isPinned = false,
                authorEmployeeId = null,
                createdAt = new Date().toISOString()
              } = version || {};

              return (
                <TimelineItem key={versionId || index}>
                  <TimelineOppositeContent color="text.secondary" sx={{ flex: 0.3 }}>
                    <Typography variant="caption" display="block">
                      {createdAt ? formatDateTime(createdAt) : 'Unknown date'}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {authorEmployeeId ? `Employee #${authorEmployeeId}` : 'Unknown author'}
                    </Typography>
                  </TimelineOppositeContent>

                  <TimelineSeparator>
                    <TimelineDot color={index === 0 ? 'primary' : 'grey'}>
                      <Typography variant="caption" sx={{ fontWeight: 400, color: 'white' }}>
                        v{safeNumber(versionNumber, 1)}
                      </Typography>
                    </TimelineDot>
                    {index < validVersions.length - 1 && <TimelineConnector />}
                  </TimelineSeparator>

                  <TimelineContent>
                    <Paper 
                      elevation={1} 
                      sx={{ 
                        p: 2, 
                        bgcolor: index === 0 ? 'action.hover' : 'background.paper',
                        border: index === 0 ? 2 : 0,
                        borderColor: 'primary.main'
                      }}
                    >
                      <Typography variant="subtitle2" fontWeight="400" gutterBottom>
                        {title || 'Untitled'}
                      </Typography>

                      <Box sx={{ display: 'flex', gap: 0.5, mb: 1, flexWrap: 'wrap' }}>
                        {importance && (
                          <Chip 
                            label={safeToUpperCase(importance, 'MEDIUM')} 
                            size="small" 
                            variant="outlined"
                          />
                        )}
                        {visibility && (
                          <Chip 
                            label={safeToUpperCase(visibility, 'INTERNAL')} 
                            size="small" 
                            variant="outlined"
                          />
                        )}
                        {legalHold && (
                          <Chip 
                            label="LEGAL HOLD" 
                            size="small" 
                            color="primary"
                          />
                        )}
                        {isPinned && (
                          <Chip 
                            label="PINNED" 
                            size="small" 
                            color="primary"
                          />
                        )}
                      </Box>

                      <Typography 
                        variant="body2" 
                        color="text.secondary"
                        sx={{ 
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden'
                        }}
                      >
                        {body || 'No content'}
                      </Typography>

                      {index === 0 && (
                        <Chip 
                          label="Current Version" 
                          size="small" 
                          color="primary" 
                          sx={{ mt: 1 }}
                        />
                      )}
                    </Paper>
                  </TimelineContent>
                </TimelineItem>
              );
            })}
          </Timeline>
        )}
      </DialogContent>
    </Dialog>
  );
}
