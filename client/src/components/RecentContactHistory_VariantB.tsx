import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip,
  useTheme
} from '@mui/material';
import { 
  History,
  Phone,
  Email,
  Person,
  VideoCall,
  Chat,
  SpeakerNotes
} from '@mui/icons-material';

interface ContactRecord {
  id: string;
  type: 'phone' | 'email' | 'in-person' | 'video' | 'chat';
  dateTime: string;
  employeeName: string;
  duration?: string;
  purpose?: string;
}

interface RecentContactHistoryProps {
  contacts: ContactRecord[];
}

// VARIANT B: Compact Grid Style
export default function RecentContactHistoryVariantB({ contacts }: RecentContactHistoryProps) {
  const theme = useTheme();
  
  const getContactIcon = (type: string) => {
    switch (type) {
      case 'phone': return Phone;
      case 'email': return Email;
      case 'in-person': return Person;
      case 'video': return VideoCall;
      case 'chat': return Chat;
      default: return SpeakerNotes;
    }
  };

  const getContactTypeLabel = (type: string) => {
    switch (type) {
      case 'phone': return 'Call';
      case 'email': return 'Email';
      case 'in-person': return 'Visit';
      case 'video': return 'Video';
      case 'chat': return 'Chat';
      default: return 'Contact';
    }
  };

  const formatCompactDate = (dateTime: string) => {
    const date = new Date(dateTime);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const recentContacts = contacts.slice(0, 6); // Show 6 contacts in grid

  return (
    <Card elevation={2} sx={{ 
      width: '100%', 
      flex: 1, 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column'
    }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" gutterBottom sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1, 
          mb: 2,
          color: theme.palette.text.primary,
          fontWeight: 400
        }}>
          <History sx={{ color: theme.palette.primary.main }} />
          Recent Contact History
        </Typography>

        {/* Quick Stats */}
        <Box sx={{ 
          display: 'flex', 
          gap: 3, 
          mb: 3, 
          pb: 2, 
          borderBottom: `1px solid ${theme.palette.divider}`,
          flexWrap: 'wrap'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Phone sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
            <Typography variant="body2" color="text.secondary">
              Calls: <strong>{contacts.filter(c => c.type === 'phone').length}</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Email sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
            <Typography variant="body2" color="text.secondary">
              Emails: <strong>{contacts.filter(c => c.type === 'email').length}</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Person sx={{ color: theme.palette.primary.main, fontSize: 20 }} />
            <Typography variant="body2" color="text.secondary">
              Visits: <strong>{contacts.filter(c => c.type === 'in-person').length}</strong>
            </Typography>
          </Box>
        </Box>

        {/* Compact Contact Grid */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 400 }}>
            Recent Interactions
          </Typography>
          <Box sx={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: 1.5
          }}>
            {recentContacts.map((contact) => {
              const IconComponent = getContactIcon(contact.type);
              return (
                <Box key={contact.id} sx={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 1.5,
                  p: 1,
                  minHeight: 'fit-content'
                }}>
                  <IconComponent sx={{ 
                    fontSize: 18, 
                    color: theme.palette.primary.main,
                    flexShrink: 0
                  }} />
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.25 }}>
                      <Typography variant="body2" fontWeight="400" sx={{ 
                        color: theme.palette.text.primary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1
                      }}>
                        {contact.employeeName}
                      </Typography>
                      <Chip 
                        label={getContactTypeLabel(contact.type)}
                        size="small"
                        sx={{ 
                          fontSize: '0.7rem',
                          height: 18,
                          backgroundColor: theme.palette.action.hover,
                          color: theme.palette.text.secondary
                        }}
                      />
                    </Box>
                    <Typography variant="caption" color="text.secondary">
                      {formatCompactDate(contact.dateTime)}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}