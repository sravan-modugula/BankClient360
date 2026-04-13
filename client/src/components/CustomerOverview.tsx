import React from 'react';
import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip, 
  Avatar, 
  Divider,
  Link
} from '@mui/material';
import { 
  Person, 
  FamilyRestroom,
  Star,
  Badge,
  Cake,
  ArrowForward,
  Business,
  LocationOn
} from '@mui/icons-material';
import CustomerDetailModal from './CustomerDetailModal';

interface Customer {
  id: string;
  name: string;
  preferredName?: string;
  taxId: string;
  dateOfBirth?: string;
  customerSince: string;
  customerType: string;
  status: string;
  riskRating: string;
  primaryEmail?: string;
  primaryPhone?: string;
  address?: string;
  relationshipManager?: string;
  isHeadOfHousehold?: boolean;
  gender?: string;
  driverLicense?: string;
  isEmployee?: boolean | null;
  vipCustomer?: boolean | null;
  cifNumber?: string | null;
  branchName?: string;
  branchCode?: string;
}

interface CustomerOverviewProps {
  customer: Customer;
}

export default function CustomerOverview({ customer }: CustomerOverviewProps) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'success';
      case 'inactive': return 'warning';
      case 'suspended': return 'error';
      default: return 'default';
    }
  };

  const formatDate = (dateString: string | undefined) => {
    if (!dateString) return 'N/A';
    
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      return 'N/A';
    }
    
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
  };

  const isBirthday = (dateOfBirth: string | undefined) => {
    if (!dateOfBirth) return false;
    
    const birthDate = new Date(dateOfBirth);
    if (isNaN(birthDate.getTime())) return false;
    
    const today = new Date();
    return birthDate.getMonth() === today.getMonth() && 
           birthDate.getDate() === today.getDate();
  };

  const isBirthdayToday = isBirthday(customer.dateOfBirth);

  return (
    <Card elevation={2} sx={{ width: '100%', flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column', p: 3 }}>
        {/* Header Section - Avatar, Name, CIF, Status */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
          <Avatar sx={{ width: 56, height: 56, bgcolor: 'primary.main' }}>
            <Person sx={{ fontSize: 28 }} />
          </Avatar>
          
          <Box sx={{ flex: 1 }}>
            {/* Name and Household Icon */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
              <Typography variant="h5" component="h1" data-testid="text-customer-name" sx={{ fontWeight: 400 }}>
                {customer.name}
              </Typography>
              {customer.isHeadOfHousehold && (
                <FamilyRestroom sx={{ color: '#936b06', fontSize: 24 }} data-testid="icon-head-of-household" />
              )}
            </Box>

            {/* Preferred Name */}
            {customer.preferredName && (
              <Typography variant="body2" color="text.secondary" data-testid="text-preferred-name" sx={{ mb: 0.5 }}>
                "{customer.preferredName}"
              </Typography>
            )}

            {/* CIF Number */}
            <Typography variant="body2" color="text.secondary" data-testid="text-cif-number" sx={{ mb: 1.5, fontFamily: 'Roboto Mono' }}>
              CIF {customer.cifNumber || 'N/A'}
            </Typography>

            {/* Status Badge - Only one badge shown */}
            {customer.status && (
              <Chip 
                label={customer.status.toUpperCase()}
                color={getStatusColor(customer.status) as any}
                size="small"
                data-testid={`chip-status-${customer.status}`}
                sx={{ fontWeight: 400 }}
              />
            )}
          </Box>
        </Box>

        {/* Subtitle Icons - VIP, Employee, Birthday as text with icons */}
        <Box sx={{ display: 'flex', gap: 2.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          {customer.vipCustomer === true && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} data-testid="indicator-vip">
              <Star sx={{ fontSize: 18, color: '#936b06' }} />
              <Typography variant="body2" sx={{ color: '#936b06', fontWeight: 400 }}>
                VIP Customer
              </Typography>
            </Box>
          )}
          
          {customer.isEmployee === true && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} data-testid="indicator-employee">
              <Badge sx={{ fontSize: 18, color: '#1b4d20' }} />
              <Typography variant="body2" sx={{ color: '#1b4d20', fontWeight: 400 }}>
                Employee
              </Typography>
            </Box>
          )}

          {isBirthdayToday && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} data-testid="indicator-birthday">
              <Cake sx={{ fontSize: 18, color: '#f57c00' }} />
              <Typography variant="body2" sx={{ color: '#f57c00', fontWeight: 400 }}>
                Birthday Today
              </Typography>
            </Box>
          )}

          {customer.customerType && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} data-testid="indicator-customer-type">
              {customer.customerType === 'business' ? (
                <Business sx={{ fontSize: 18, color: 'text.secondary' }} />
              ) : (
                <Person sx={{ fontSize: 18, color: 'text.secondary' }} />
              )}
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 400 }}>
                {customer.customerType.charAt(0).toUpperCase() + customer.customerType.slice(1)}
              </Typography>
            </Box>
          )}

          {customer.branchName && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }} data-testid="indicator-branch">
              <LocationOn sx={{ fontSize: 18, color: '#1b4d20' }} />
              <Typography variant="body2" sx={{ color: '#1b4d20', fontWeight: 400 }}>
                Branch: {customer.branchName}
              </Typography>
            </Box>
          )}
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Metrics Band - 4-column grid with key information */}
        <Box 
          sx={{ 
            display: 'grid', 
            gridTemplateColumns: { 
              xs: '1fr', 
              sm: 'repeat(2, 1fr)', 
              md: 'repeat(4, 1fr)' 
            }, 
            gap: 3,
            mb: 2
          }}
        >
          {/* Date of Birth - Only for individual customers */}
          {customer.customerType !== 'business' && customer.customerType !== 'trust' && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 400 }}>
                Date of Birth
              </Typography>
              <Typography variant="body1" data-testid="text-date-of-birth" sx={{ fontWeight: 400, mt: 0.5 }}>
                {formatDate(customer.dateOfBirth)}
              </Typography>
            </Box>
          )}

          {/* Customer Since - Always rendered */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 400 }}>
              Customer Since
            </Typography>
            <Typography variant="body1" data-testid="text-customer-since" sx={{ fontWeight: 400, mt: 0.5 }}>
              {formatDate(customer.customerSince)}
            </Typography>
          </Box>

          {/* Tax ID - Always rendered */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 400 }}>
              Tax ID
            </Typography>
            <Typography 
              variant="body1" 
              data-testid="text-tax-id" 
              sx={{ 
                fontWeight: 400, 
                fontFamily: 'Roboto Mono', 
                mt: 0.5,
                whiteSpace: 'nowrap'
              }}
            >
              {customer.taxId ? `***-**-${customer.taxId.slice(-4)}` : 'N/A'}
            </Typography>
          </Box>

          {/* Gender for individual customers, Customer Type for business */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 400 }}>
              {customer.customerType === 'business' || customer.customerType === 'trust' ? 'Entity Type' : 'Gender'}
            </Typography>
            <Typography variant="body1" data-testid="text-gender" sx={{ fontWeight: 400, mt: 0.5 }}>
              {customer.customerType === 'business' || customer.customerType === 'trust' 
                ? (customer.customerType.charAt(0).toUpperCase() + customer.customerType.slice(1))
                : (customer.gender || 'N/A')}
            </Typography>
          </Box>
        </Box>

        {/* View Details Link */}
        <Divider sx={{ mb: 2 }} />
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Link
            component="button"
            variant="body2"
            onClick={() => setDetailsOpen(true)}
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
            data-testid="link-view-details"
          >
            View Full Details
            <ArrowForward sx={{ fontSize: 16 }} />
          </Link>
        </Box>
      </CardContent>

      {/* Customer Detail Modal */}
      <CustomerDetailModal
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        customerId={parseInt(customer.id)}
      />
    </Card>
  );
}
