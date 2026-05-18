import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  Tabs,
  Tab,
  Grid,
  useMediaQuery,
  useTheme,
  Tooltip,
  Link,
  CardActions
} from '@mui/material';
import {
  ContactPhone,
  Email,
  Home,
  Phone,
  Business,
  Close,
  ContentCopy,
  CallMade,
  LocationOn,
  Work,
  PersonalVideo,
  Emergency,
  ArrowForward
} from '@mui/icons-material';
import { useState } from 'react';
import PanelTitle from './PanelTitle';

interface ContactInfo {
  id: string;
  type: 'phone' | 'email' | 'address';
  subtype: string;
  value: string;
  isPrimary: boolean;
  purpose: string;
}

interface ContactInformationProps {
  contacts: ContactInfo[];
}

export default function ContactInformation({ contacts }: ContactInformationProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const isTablet = useMediaQuery(theme.breakpoints.between('sm', 'md'));

  const getContactIcon = (type: string, subtype: string) => {
    switch (type) {
      case 'phone':
        if (subtype === 'work') return <Work />;
        if (subtype === 'emergency') return <Emergency />;
        return <Phone />;
      case 'email':
        if (subtype === 'business' || subtype === 'work') return <Business />;
        return <Email />;
      case 'address':
        if (subtype === 'work' || subtype === 'business') return <Business />;
        if (subtype === 'mailing') return <LocationOn />;
        return <Home />;
      default:
        return <ContactPhone />;
    }
  };

  const getContactTypeColor = (type: string, isPrimary: boolean) => {
    if (isPrimary) return 'primary';
    switch (type) {
      case 'phone': return 'success';
      case 'email': return 'info';
      case 'address': return 'warning';
      default: return 'default';
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    if (digits.length === 11 && digits[0] === '1') {
      return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    return phone;
  };

  const formatContactValue = (contact: ContactInfo) => {
    if (contact.type === 'phone') {
      return formatPhoneNumber(contact.value);
    }
    return contact.value;
  };

  const handleContactAction = (contact: ContactInfo) => {
    if (contact.type === 'phone') {
      window.open(`tel:${contact.value}`, '_self');
    } else if (contact.type === 'email') {
      window.open(`mailto:${contact.value}`, '_self');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // Get primary contacts for tile display
  const primaryContacts = contacts.filter(contact => contact.isPrimary);
  const totalContacts = contacts.length;

  // Group contacts by type for modal
  const groupedContacts = contacts.reduce((groups, contact) => {
    if (!groups[contact.type]) {
      groups[contact.type] = [];
    }
    groups[contact.type].push(contact);
    return groups;
  }, {} as Record<string, ContactInfo[]>);

  const contactTypes = [
    { key: 'email', label: 'Email', icon: <Email />, count: groupedContacts.email?.length || 0 },
    { key: 'phone', label: 'Phone', icon: <Phone />, count: groupedContacts.phone?.length || 0 },
    { key: 'address', label: 'Address', icon: <LocationOn />, count: groupedContacts.address?.length || 0 }
  ].filter(type => type.count > 0);

  const renderContactCard = (contact: ContactInfo, showActions = false) => (
    <Box
      key={contact.id}
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 2,
        p: 2,
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'divider',
        mb: 1,
        '&:hover': {
          bgcolor: 'action.hover'
        }
      }}
    >
      <Box sx={{ color: 'action.active', mt: 0.5 }}>
        {getContactIcon(contact.type, contact.subtype)}
      </Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body1" sx={{ fontWeight: 400, mb: 0.5 }}>
          {formatContactValue(contact)}
        </Typography>
        <Box sx={{ display: 'flex', gap: 0.5, mb: showActions ? 1 : 0 }}>
          <Chip
            label={contact.subtype?.charAt(0).toUpperCase() + contact.subtype?.slice(1)}
            color={getContactTypeColor(contact.type, contact.isPrimary) as any}
            size="small"
            variant={contact.isPrimary ? 'filled' : 'outlined'}
          />
          {contact.isPrimary && (
            <Chip
              label="Primary"
              color="primary"
              size="small"
            />
          )}
        </Box>
        {showActions && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            {(contact.type === 'phone' || contact.type === 'email') && (
              <Button
                size="small"
                startIcon={contact.type === 'phone' ? <CallMade /> : <Email />}
                onClick={() => handleContactAction(contact)}
                data-testid={`action-${contact.type}-${contact.id}`}
              >
                {contact.type === 'phone' ? 'Call' : 'Email'}
              </Button>
            )}
            <Button
              size="small"
              startIcon={<ContentCopy />}
              onClick={() => copyToClipboard(contact.value)}
              data-testid={`copy-${contact.id}`}
            >
              Copy
            </Button>
          </Box>
        )}
      </Box>
    </Box>
  );

  return (
    <>
      <Card elevation={2} sx={{ width: '100%', flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
        <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <PanelTitle left="Contact Information" />


          <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
            {primaryContacts.length > 0 ? (
              <>
                {primaryContacts.map((contact, idx, arr) => (
                    <ListItem key={contact.id} disablePadding sx={{ py: 1, borderBottom: idx < arr.length - 1 ? '1px solid #e4eedc' : "none", alignItems: "flex-start" }}>
                      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100%", width: "12%"}}>
                        <Box data-testid={`contact-${contact.id}`} sx={{ width: 36, height: 36, borderRadius: 1.5, background: '#eaf3e4', border: '1px solid #c0d8b8', display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, mr: 1.25 }}>
                          {getContactIcon(contact.type, contact.subtype)}
                        </Box>
                      </Box>
                      <Box>
                        <Typography sx={{ fontSize: 14, color: '#7a9a7a', textTransform: "uppercase", letterSpacing: "0.07em", mb: 0.25 }}>{contact.type}</Typography>
                        <Typography sx={{ fontSize: 16, color: '#2a4a2a', fontWeight: 400 }}>{formatContactValue(contact)}</Typography>
                        <Typography sx={{ fontSize: 14, color: '#9ab89a', mt: 0.25 }}>{contact.subtype?.charAt(0).toUpperCase() + contact.subtype?.slice(1)}{contact.isPrimary ? " • Primary" : ""}</Typography>
                      </Box>
                    </ListItem>
                ))}
              </>
            ) : (
              <Box sx={{ textAlign: 'center', py: 4 }}>
                <ContactPhone sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No Primary Contact Information
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  No primary contact details available for this customer.
                </Typography>
              </Box>
            )}
          </Box>
        </CardContent>

        {totalContacts > primaryContacts.length && (
          <CardActions>
            {/* View Details Link */}
            <Box sx={{ display: 'flex', justifyContent: 'center', pb: 1, width: "100%" }}>
              <Link
                component="button"
                variant="body2"
                onClick={() => setModalOpen(true)}
                data-testid="button-view-all-contacts"
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                  color: 'primary.main',
                  fontWeight: 400,
                  textDecoration: 'none',
                  '&:hover': {
                    textDecoration: 'underline'
                  }
                }}
              >
                View All {totalContacts} Contacts
                <ArrowForward sx={{ fontSize: 16 }} />
              </Link>
            </Box>
          </CardActions>
        )}
      </Card>

      {/* Contact Details Modal */}
      <Dialog
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        fullScreen={isMobile}
        maxWidth={isTablet ? "md" : "lg"}
        fullWidth
        scroll="paper"
        PaperProps={{
          sx: {
            height: isMobile ? '100%' : 'auto',
            maxHeight: isMobile ? 'none' : '90vh'
          }
        }}
      >
        <DialogTitle sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          pb: 1
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {isMobile && (
              <IconButton onClick={() => setModalOpen(false)} sx={{ mr: 1 }}>
                <Close />
              </IconButton>
            )}
            <ContactPhone color="primary" />
            <Typography variant="h6">
              Customer Contact Details
            </Typography>
            <Chip
              label={`${totalContacts} Total`}
              size="small"
              color="primary"
              variant="outlined"
            />
          </Box>
          {!isMobile && (
            <IconButton onClick={() => setModalOpen(false)} data-testid="button-close-modal">
              <Close />
            </IconButton>
          )}
        </DialogTitle>

        <DialogContent dividers sx={{ p: isMobile ? 1 : 3 }}>
          <Tabs
            value={activeTab}
            onChange={(e, newValue) => setActiveTab(newValue)}
            variant={isMobile ? "scrollable" : "standard"}
            scrollButtons="auto"
            sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}
          >
            {contactTypes.map((type, index) => (
              <Tab
                key={type.key}
                icon={type.icon}
                label={`${type.label} (${type.count})`}
                data-testid={`tab-${type.key}`}
                sx={{ minWidth: isMobile ? 120 : 140 }}
              />
            ))}
          </Tabs>

          <Box sx={{ minHeight: 300 }}>
            {contactTypes.map((type, index) => (
              <Box
                key={type.key}
                role="tabpanel"
                hidden={activeTab !== index}
              >
                {activeTab === index && (
                  <Box>
                    <Typography variant="h6" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                      {type.icon}
                      {type.label} Contacts
                    </Typography>

                    {/* Primary contacts first */}
                    {groupedContacts[type.key]?.filter(contact => contact.isPrimary).map(contact =>
                      renderContactCard(contact, true)
                    )}

                    {/* Secondary contacts */}
                    {groupedContacts[type.key]?.filter(contact => !contact.isPrimary).length > 0 && (
                      <>
                        <Typography variant="subtitle2" sx={{ mt: 3, mb: 2, color: 'text.secondary' }}>
                          Additional {type.label} Contacts
                        </Typography>
                        {groupedContacts[type.key]?.filter(contact => !contact.isPrimary).map(contact =>
                          renderContactCard(contact, true)
                        )}
                      </>
                    )}
                  </Box>
                )}
              </Box>
            ))}
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setModalOpen(false)} variant="contained" data-testid="button-close">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}