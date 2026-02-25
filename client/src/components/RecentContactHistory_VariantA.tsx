import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
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

// VARIANT A: Horizontal Stats Bar Style (Most Compact)
export default function RecentContactHistoryVariantA({ contacts }: RecentContactHistoryProps) {
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

  const formatRelativeDate = (dateTime: string) => {
    const date = new Date(dateTime);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const recentContacts = contacts.slice(0, 4); // Show only 4 most recent

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

        {/* Horizontal Stats Bar Style - Like Transaction History */}
        <Box sx={{ 
          display: 'flex', 
          gap: 3, 
          mb: 3, 
          pb: 2, 
          borderBottom: `1px solid ${theme.palette.divider}`,
          flexWrap: 'wrap'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Total Contacts: <strong>{contacts.length}</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              This Week: <strong>{contacts.filter(c => {
                const days = Math.floor((new Date().getTime() - new Date(c.dateTime).getTime()) / (1000 * 60 * 60 * 24));
                return days <= 7;
              }).length}</strong>
            </Typography>
          </Box>
        </Box>

        {/* Recent Contacts - Horizontal Layout */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 400 }}>
            Recent Interactions
          </Typography>
          <Box sx={{ 
            display: 'flex', 
            flexWrap: 'wrap', 
            gap: 2
          }}>
            {recentContacts.map((contact) => {
              const IconComponent = getContactIcon(contact.type);
              return (
                <Box key={contact.id} sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 'fit-content' }}>
                  <IconComponent sx={{ 
                    fontSize: 20, 
                    color: theme.palette.primary.main
                  }} />
                  <Typography variant="body2" color="text.secondary">
                    {contact.employeeName}: <strong>{formatRelativeDate(contact.dateTime)}</strong>
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}