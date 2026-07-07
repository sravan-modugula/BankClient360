import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  useTheme,
  Skeleton,
  Alert
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
import { useQuery } from '@tanstack/react-query';
import type { ContactHistoryDTO } from '@shared/contracts';

interface RecentContactHistoryProps {
  customerId: number;
}

// VARIANT C: Minimal List Style (Streamlined)
export default function RecentContactHistoryVariantC({ customerId }: RecentContactHistoryProps) {
  const theme = useTheme();
  
  const { 
    data: contactHistory, 
    isLoading, 
    error 
  } = useQuery<ContactHistoryDTO>({
    queryKey: [`/api/customers/${customerId}/contact-history`],
    enabled: !!customerId
  });

  if (isLoading) {
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
          <Skeleton variant="text" width="60%" height={24} sx={{ mb: 1 }} />
          <Skeleton variant="text" width="40%" height={24} sx={{ mb: 2 }} />
          <Skeleton variant="rectangular" width="100%" height={120} />
        </CardContent>
      </Card>
    );
  }

  if (error || !contactHistory) {
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
          <Alert severity="info" data-testid="alert-contact-history-error">
            Contact history not available
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const contacts = contactHistory.recentContacts;
  
  const getContactIcon = (type: string) => {
    switch (type) {
      case 'phone': return Phone;
      case 'email': return Email;
      case 'in_person': return Person;
      case 'meeting': return VideoCall;
      case 'chat': return Chat;
      default: return SpeakerNotes;
    }
  };

  const getContactTypeLabel = (type: string) => {
    switch (type) {
      case 'phone': return 'Call';
      case 'email': return 'Email';
      case 'in_person': return 'Visit';
      case 'meeting': return 'Meeting';
      case 'chat': return 'Chat';
      default: return 'Contact';
    }
  };

  const formatRelativeDate = (dateTime: string) => {
    // API sends an ISO-8601 timestamp
    const date = new Date(dateTime);

    // Guard against an unparseable/empty value so we never render "Invalid Date"
    if (!dateTime || isNaN(date.getTime())) {
      return 'None';
    }

    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const recentContacts = contacts.slice(0, 5); // Show 5 contacts

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

        {/* Quick Summary Stats */}
        <Box sx={{ 
          display: 'flex', 
          gap: 3, 
          mb: 3, 
          pb: 2, 
          borderBottom: `1px solid ${theme.palette.divider}`,
          flexWrap: 'wrap'
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary" data-testid="text-contact-total">
              Total: <strong>{contacts.length}</strong>
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" color="text.secondary" data-testid="text-last-contact">
              Last Contact: <strong>{contacts.length > 0 ? formatRelativeDate(contacts[0].occurredAt) : 'None'}</strong>
            </Typography>
          </Box>
        </Box>

        {/* Streamlined Contact List */}
        <Box sx={{ flex: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 400 }}>
            Recent Interactions
          </Typography>
          {recentContacts.length > 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              {recentContacts.map((contact, index) => {
                const IconComponent = getContactIcon(contact.contactType);
                const isLast = index === recentContacts.length - 1;
                
                return (
                  <Box key={index} data-testid={`contact-item-${index}`}>
                    <Box sx={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: 1.5,
                      py: 0.5
                    }}>
                      <IconComponent sx={{ 
                        fontSize: 18, 
                        color: theme.palette.primary.main,
                        flexShrink: 0
                      }} />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                          <Typography 
                            variant="body2" 
                            fontWeight="400" 
                            sx={{ 
                              color: theme.palette.text.primary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            data-testid={`text-employee-name-${index}`}
                          >
                            {contact.employeeName}
                          </Typography>
                          <Typography 
                            variant="caption" 
                            color="text.secondary" 
                            sx={{ flexShrink: 0 }}
                            data-testid={`text-contact-date-${index}`}
                          >
                            {formatRelativeDate(contact.occurredAt)}
                          </Typography>
                        </Box>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          data-testid={`text-contact-type-${index}`}
                        >
                          {contact.contactDescription || getContactTypeLabel(contact.contactType)}
                        </Typography>
                      </Box>
                    </Box>
                    {!isLast && (
                      <Box sx={{ 
                        height: '1px', 
                        backgroundColor: theme.palette.divider, 
                        mx: 2.5, 
                        my: 0.5 
                      }} />
                    )}
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No recent contact history available
            </Typography>
          )}
        </Box>
      </CardContent>
    </Card>
  );
}