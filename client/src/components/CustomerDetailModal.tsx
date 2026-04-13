import React from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Chip,
  IconButton,
  Card,
  CardContent
} from '@mui/material';
import {
  Close,
  Star,
  Badge,
  Security,
  CheckCircle,
  Person,
  Business,
  Gavel,
  Cake,
  Work,
  AccountBalance,
  VerifiedUser
} from '@mui/icons-material';
import { useDateFormatter } from '@/lib/dateFormatters';

interface CustomerDetail {
  customerId: number;
  firstName?: string | null;
  lastName?: string | null;
  middleName?: string | null;
  preferredName?: string | null;
  title?: string | null;
  suffix?: string | null;
  businessName?: string | null;
  fullName: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  maritalStatus?: string | null;
  citizenship?: string | null;
  customerType: string;
  customerStatus: string;
  customerSince: string;
  taxIdentifier?: string | null;
  governmentId?: string | null;
  governmentIdType?: string | null;
  occupation?: string | null;
  employerName?: string | null;
  naicsCode?: string | null;
  kycStatus?: string | null;
  kycLastUpdated?: string | null;
  riskRating?: string | null;
  languagePreference?: string | null;
  jackHenryCifNumber?: string | null;
  inquiryCode?: string | null;
  insideCode?: string | null;
  salesAssociateCode?: string | null;
  classCode?: string | null;
  isEmployee: boolean;
  vipCustomer: boolean;
  isDeceased: boolean;
}

interface CustomerDetailModalProps {
  open: boolean;
  onClose: () => void;
  customerId: number;
}

export default function CustomerDetailModal({ open, onClose, customerId }: CustomerDetailModalProps) {
  const { formatDate } = useDateFormatter();
  const [customerData, setCustomerData] = React.useState<CustomerDetail | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (open && customerId) {
      fetchCustomerDetails();
    }
  }, [open, customerId]);

  const fetchCustomerDetails = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/customers/${customerId}/details`);
      if (response.ok) {
        const data = await response.json();
        setCustomerData(data);
      }
    } catch (error) {
      console.error('Error fetching customer details:', error);
    } finally {
      setLoading(false);
    }
  };

  const getCustomerTypeIcon = (type: string) => {
    switch (type.toLowerCase()) {
      case 'business':
        return <Business sx={{ fontSize: 20, color: 'primary.main' }} />;
      case 'trust':
        return <Gavel sx={{ fontSize: 20, color: 'primary.main' }} />;
      default:
        return <Person sx={{ fontSize: 20, color: 'primary.main' }} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'success';
      case 'inactive': return 'warning';
      case 'suspended': return 'error';
      default: return 'default';
    }
  };

  const getRiskColor = (rating: string) => {
    switch (rating?.toLowerCase()) {
      case 'low': return 'success';
      case 'medium': return 'warning';
      case 'high': return 'error';
      default: return 'default';
    }
  };

  const calculateAge = (dob: string) => {
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  if (!customerData || loading) {
    return (
      <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
        <DialogContent>
          <Typography align="center" color="text.secondary" sx={{ py: 4 }}>
            {loading ? 'Loading customer details...' : 'No data available'}
          </Typography>
        </DialogContent>
      </Dialog>
    );
  }

  const isIndividual = ['individual', 'premium', 'regular'].includes((customerData.customerType ?? 'unknown').toLowerCase());

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="lg" 
      fullWidth
      disableAutoFocus
      disableEnforceFocus
      PaperProps={{
        sx: { minHeight: '70vh', maxHeight: '85vh' }
      }}
    >
      <DialogTitle sx={{ 
        bgcolor: 'background.paper',
        borderBottom: 1,
        borderColor: 'divider',
        pb: 2
      }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="h5" fontWeight="400" gutterBottom data-testid="modal-customer-name">
              {customerData.fullName}
              {customerData.preferredName && (
                <Typography component="span" variant="h6" color="text.secondary" sx={{ ml: 1 }}>
                  "{customerData.preferredName}"
                </Typography>
              )}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                CIF: {customerData.jackHenryCifNumber || 'N/A'}
              </Typography>
              <Typography variant="body2" color="text.secondary">•</Typography>
              <Typography variant="body2" color="text.secondary">
                {(customerData.customerType ?? 'unknown').replace('_', ' ')}
              </Typography>
              <Typography variant="body2" color="text.secondary">•</Typography>
              <Chip 
                label={(customerData.customerStatus ?? 'unknown').toUpperCase()}
                color={getStatusColor(customerData.customerStatus ?? 'unknown') as any}
                size="small"
              />
              {customerData.vipCustomer && (
                <Chip
                  icon={<Star />}
                  label="VIP"
                  size="small"
                  sx={{
                    bgcolor: '#936b06',
                    color: '#ffffff',
                    fontWeight: 400,
                    '& .MuiChip-icon': { color: '#ffffff' }
                  }}
                  data-testid="chip-vip"
                />
              )}
              {customerData.isEmployee && (
                <Chip
                  icon={<Badge />}
                  label="Employee"
                  size="small"
                  sx={{
                    bgcolor: '#1b4d20',
                    color: '#ffffff',
                    fontWeight: 400,
                    '& .MuiChip-icon': { color: '#ffffff' }
                  }}
                  data-testid="chip-employee"
                />
              )}
            </Box>
          </Box>
          <IconButton onClick={onClose} data-testid="button-close-modal">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ pt: 3, pb: 2, overflow: 'auto' }}>
        {/* Customer Overview */}
        {(
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {/* Row 1: Personal, Professional, Compliance */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
          {isIndividual && (
            <Box sx={{ flex: '1 1 calc(33.33% - 16px)', minWidth: '280px' }}>
              <Card elevation={1} sx={{ height: '100%', bgcolor: 'background.paper' }}>
                <CardContent sx={{ pb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Cake sx={{ color: 'primary.main', fontSize: 20 }} />
                    <Typography variant="subtitle2" fontWeight="400" color="primary">
                      PERSONAL
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {customerData.gender && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">Gender</Typography>
                        <Typography variant="body2" fontWeight="400">{customerData.gender}</Typography>
                      </Box>
                    )}
                    {customerData.dateOfBirth && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">Age</Typography>
                        <Typography variant="body2" fontWeight="400">
                          {calculateAge(customerData.dateOfBirth)} years
                        </Typography>
                      </Box>
                    )}
                    {customerData.maritalStatus && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">Marital Status</Typography>
                        <Typography variant="body2" fontWeight="400">{customerData.maritalStatus}</Typography>
                      </Box>
                    )}
                    {customerData.citizenship && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">Citizenship</Typography>
                        <Typography variant="body2" fontWeight="400">{customerData.citizenship}</Typography>
                      </Box>
                    )}
                    <Box>
                      <Typography variant="caption" color="text.secondary">Customer Since</Typography>
                      <Typography variant="body2" fontWeight="400">{formatDate(customerData.customerSince)}</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          )}

          {!isIndividual && (
            <Box sx={{ flex: '1 1 calc(33.33% - 16px)', minWidth: '280px' }}>
              <Card elevation={1} sx={{ height: '100%', bgcolor: 'background.paper' }}>
                <CardContent sx={{ pb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Business sx={{ color: 'primary.main', fontSize: 20 }} />
                    <Typography variant="subtitle2" fontWeight="400" color="primary">
                      BUSINESS
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary">Business Name</Typography>
                      <Typography variant="body2" fontWeight="400">{customerData.businessName}</Typography>
                    </Box>
                    {customerData.naicsCode && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">NAICS Code</Typography>
                        <Typography variant="body2" fontWeight="400" sx={{ fontFamily: 'Roboto Mono' }}>
                          {customerData.naicsCode}
                        </Typography>
                      </Box>
                    )}
                    {customerData.citizenship && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">Country</Typography>
                        <Typography variant="body2" fontWeight="400">{customerData.citizenship}</Typography>
                      </Box>
                    )}
                    <Box>
                      <Typography variant="caption" color="text.secondary">Customer Since</Typography>
                      <Typography variant="body2" fontWeight="400">{formatDate(customerData.customerSince)}</Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Box>
          )}

          {isIndividual && (customerData.occupation || customerData.employerName) && (
            <Box sx={{ flex: '1 1 calc(33.33% - 16px)', minWidth: '280px' }}>
              <Card elevation={1} sx={{ height: '100%', bgcolor: 'background.paper' }}>
                <CardContent sx={{ pb: 2 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <Work sx={{ color: 'primary.main', fontSize: 20 }} />
                    <Typography variant="subtitle2" fontWeight="400" color="primary">
                      PROFESSIONAL
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {customerData.occupation && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">Occupation</Typography>
                        <Typography variant="body2" fontWeight="400">{customerData.occupation}</Typography>
                      </Box>
                    )}
                    {customerData.employerName && (
                      <Box>
                        <Typography variant="caption" color="text.secondary">Employer</Typography>
                        <Typography variant="body2" fontWeight="400">{customerData.employerName}</Typography>
                      </Box>
                    )}
                  </Box>
                </CardContent>
              </Card>
            </Box>
          )}

          <Box sx={{ flex: '1 1 calc(33.33% - 16px)', minWidth: '280px' }}>
            <Card elevation={1} sx={{ height: '100%', bgcolor: 'background.paper' }}>
              <CardContent sx={{ pb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <VerifiedUser sx={{ color: 'primary.main', fontSize: 20 }} />
                  <Typography variant="subtitle2" fontWeight="400" color="primary">
                    IDENTIFICATION
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {customerData.taxIdentifier && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Tax ID</Typography>
                      <Typography variant="body2" fontWeight="400" sx={{ fontFamily: 'Roboto Mono' }}>
                        ***-**-{customerData.taxIdentifier.slice(-4)}
                      </Typography>
                    </Box>
                  )}
                  {customerData.governmentId && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">Government ID</Typography>
                      <Typography variant="body2" fontWeight="400" sx={{ fontFamily: 'Roboto Mono' }}>
                        ***{customerData.governmentId.slice(-4)}
                      </Typography>
                    </Box>
                  )}
                  {customerData.governmentIdType && (
                    <Box>
                      <Typography variant="caption" color="text.secondary">ID Type</Typography>
                      <Typography variant="body2" fontWeight="400">{customerData.governmentIdType}</Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Box>
          </Box>

          {/* Row 2: Banking Codes */}
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>

          <Box sx={{ flex: '1 1 calc(66.67% - 16px)', minWidth: '380px' }}>
            <Card elevation={1} sx={{ height: '100%', bgcolor: 'background.paper' }}>
              <CardContent sx={{ pb: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <AccountBalance sx={{ color: 'primary.main', fontSize: 20 }} />
                  <Typography variant="subtitle2" fontWeight="400" color="primary">
                    BANKING CODES & INTEGRATION
                  </Typography>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                  {customerData.inquiryCode && (
                    <Box sx={{ flex: '0 0 auto', minWidth: '100px' }}>
                      <Typography variant="caption" color="text.secondary">Inquiry</Typography>
                      <Typography variant="body2" fontWeight="400" sx={{ fontFamily: 'Roboto Mono' }}>
                        {customerData.inquiryCode}
                      </Typography>
                    </Box>
                  )}
                  {customerData.insideCode && (
                    <Box sx={{ flex: '0 0 auto', minWidth: '100px' }}>
                      <Typography variant="caption" color="text.secondary">Inside</Typography>
                      <Typography variant="body2" fontWeight="400" sx={{ fontFamily: 'Roboto Mono' }}>
                        {customerData.insideCode}
                      </Typography>
                    </Box>
                  )}
                  {customerData.salesAssociateCode && (
                    <Box sx={{ flex: '0 0 auto', minWidth: '100px' }}>
                      <Typography variant="caption" color="text.secondary">Sales Assoc</Typography>
                      <Typography variant="body2" fontWeight="400" sx={{ fontFamily: 'Roboto Mono' }}>
                        {customerData.salesAssociateCode}
                      </Typography>
                    </Box>
                  )}
                  {customerData.classCode && (
                    <Box sx={{ flex: '0 0 auto', minWidth: '120px' }}>
                      <Typography variant="caption" color="text.secondary">Class</Typography>
                      <Typography variant="body2" fontWeight="400" sx={{ fontFamily: 'Roboto Mono' }}>
                        {customerData.classCode}
                      </Typography>
                    </Box>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Box>
          </Box>
        </Box>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2, borderTop: 1, borderColor: 'divider' }}>
        <Button onClick={onClose} variant="outlined" data-testid="button-close">
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}