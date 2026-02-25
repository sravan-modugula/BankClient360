import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Chip,
  Divider,
  useTheme
} from '@mui/material';
import { 
  History,
  Phone,
  Email,
  Person,
  SpeakerNotes,
  VideoCall,
  Chat
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

export default function RecentContactHistory({ contacts }: RecentContactHistoryProps) {
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
      case 'phone': return 'Phone Call';
      case 'email': return 'Email';
      case 'in-person': return 'In-Person';
      case 'video': return 'Video Call';
      case 'chat': return 'Chat';
      default: return 'Contact';
    }
  };

  const getContactTypeColor = (type: string) => {
    switch (type) {
      case 'phone': return theme.palette.primary.main;
      case 'email': return theme.palette.primary.main;
      case 'in-person': return theme.palette.secondary.main;
      case 'video': return theme.palette.secondary.main;
      case 'chat': return theme.palette.primary.main;
      default: return theme.palette.text.secondary;
    }
  };

  const formatDateTime = (dateTime: string) => {
    const date = new Date(dateTime);
    return {
      date: date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: 'numeric'
      }),
      time: date.toLocaleTimeString('en-US', { 
        hour: 'numeric', 
        minute: '2-digit',
        hour12: true
      })
    };
  };

  return (
    <Card elevation={2} sx={{ 
      width: '100%', 
      flex: 1, 
      height: '100%', 
      display: 'flex', 
      flexDirection: 'column'
    }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', pb: 1 }}>
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

        {contacts.length > 0 ? (
          <List sx={{ flex: 1, p: 0 }}>
            {contacts.slice(0, 5).map((contact, index) => {
              const IconComponent = getContactIcon(contact.type);
              const { date, time } = formatDateTime(contact.dateTime);
              const isLast = index === contacts.slice(0, 5).length - 1;
              
              return (
                <Box key={contact.id}>
                  <ListItem sx={{ 
                    px: 0, 
                    py: 1.5,
                    alignItems: 'flex-start'
                  }}>
                    <ListItemIcon sx={{ minWidth: 40, mt: 0.5 }}>
                      <IconComponent sx={{ 
                        color: getContactTypeColor(contact.type),
                        fontSize: 20
                      }} />
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                          <Chip 
                            label={getContactTypeLabel(contact.type)}
                            size="small"
                            sx={{ 
                              backgroundColor: `${getContactTypeColor(contact.type)}20`,
                              color: getContactTypeColor(contact.type),
                              fontWeight: 400,
                              fontSize: '0.75rem'
                            }}
                          />
                          {contact.duration && (
                            <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                              {contact.duration}
                            </Typography>
                          )}
                        </Box>
                      }
                      secondary={
                        <Box>
                          <Typography variant="body2" sx={{ 
                            color: theme.palette.text.primary, 
                            fontWeight: 400,
                            mb: 0.5
                          }}>
                            {contact.employeeName}
                          </Typography>
                          <Typography variant="caption" sx={{ color: theme.palette.text.secondary }}>
                            {date} at {time}
                          </Typography>
                          {contact.purpose && (
                            <Typography variant="caption" sx={{ 
                              color: theme.palette.text.secondary, 
                              display: 'block',
                              mt: 0.5,
                              fontStyle: 'italic'
                            }}>
                              {contact.purpose}
                            </Typography>
                          )}
                        </Box>
                      }
                    />
                  </ListItem>
                  {!isLast && <Divider variant="inset" component="li" sx={{ ml: 5 }} />}
                </Box>
              );
            })}
          </List>
        ) : (
          <Box sx={{ 
            flex: 1, 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            color: theme.palette.text.secondary
          }}>
            <Typography variant="body2">
              No recent contact history available
            </Typography>
          </Box>
        )}
      </CardContent>
    </Card>
  );
}