import React from 'react';
import {
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Avatar,
  Divider,
  Link,
  CardActions,
  Button
} from '@mui/material';
import {
  Person,
  FamilyRestroom,
  Star,
  Badge,
  Cake,
  ArrowForward,
  Business,
  LocationOn,
  Build as BuildIcon
} from '@mui/icons-material';
import CustomerDetailModal from './CustomerDetailModal';
import PanelTitle from "./PanelTitle";
import { formatFlatDate } from '@/helpers';
import MaintenanceModal from './MaintenanceItems';

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
  const [maintenanceOpen, setMaintenanceOpen] = React.useState(false);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active': return 'success';
      case 'inactive': return 'warning';
      case 'suspended': return 'error';
      default: return 'default';
    }
  };

  const isBirthday = (dateOfBirth: string | undefined) => {
    if (!dateOfBirth) return false;

    const birthDate = new Date(dateOfBirth);
    if (isNaN(birthDate.getTime())) return false;

    const today = new Date();
    return birthDate.getUTCMonth() === today.getMonth() &&
      birthDate.getUTCDate() === today.getDate();
  };

  const isBirthdayToday = isBirthday(customer.dateOfBirth);

  return (
    <Card elevation={2} sx={{ width: '100%', flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>

      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <PanelTitle
          left="Client Information"
          right={
              <Button
                variant='contained'
                sx={{ 
                  background: "#f0efeb", 
                  color: "#666", 
                  border: "1px solid #d8d6cf", 
                  borderRadius: 1, 
                  '&:hover': {
                    background: "#e8e6e0",
                    borderColor: "#bbb"
                  }
                }}
                startIcon={<BuildIcon /> }
                onClick={() => setMaintenanceOpen(true)}   
              >
                Maintenance
              </Button>
          } />

        {/* Header Section - Avatar, Name, CIF, Status */}
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2, mb: 2 }}>
          <Avatar sx={{ width: 56, height: 56, background: "#eaf3e4", border: "3px solid #c0d8b8", color: "#2d5a2d" }}>
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

            <Box sx={{ display: "flex", gap: 1 }}>
              {/* Status Badge - Only one badge shown */}
              {customer.status && (
                <Chip
                  label={customer.status.toUpperCase()}
                  sx={{ fontSize: 14, height: 22, borderRadius: 1, background: "#d4edda", color: "#1a5c2a", border: "1px solid #8abf8a" }}
                  color={getStatusColor(customer.status) as any}
                  size="small"
                  data-testid={`chip-status-${customer.status}`}
                />
              )}

              {customer.vipCustomer === true && (
                <Chip
                  label="VIP Customer"
                  size="small"
                  // icon={
                  //   <Star sx={{ fontSize: 12, color: "#7a5200"}} />
                  // }
                  sx={{ fontSize: 14, height: 22, background: "#fff3cd", color: "#7a5200", border: "1px solid #e0b84a", borderRadius: 1 }}
                />
              )}


              {customer.isEmployee === true && (
                <Chip
                  label="Employee"
                  size="small"
                  sx={{ fontSize: 14, height: 22, background: "#d4edda", color: "#1b4d20", border: "1px solid #8abf8a", borderRadius: 1 }}
                />
              )}

              {isBirthdayToday && (
                <Chip
                  label="Birthday Today"
                  size="small"
                  sx={{ fontSize: 14, height: 22, background: "#FFF8EC", color: "#f57c00", border: "1px solid #B54800", borderRadius: 1 }}
                />
              )}

              {customer.customerType && (
                <Chip
                  label={customer.customerType.charAt(0).toUpperCase() + customer.customerType.slice(1)}
                  size="small"
                  icon={customer.customerType === 'business' ? (
                    <Business sx={{ fontSize: 18, color: 'text.secondary' }} />
                  ) : (
                    <Person sx={{ fontSize: 18, color: 'text.secondary' }} />
                  )}
                  sx={{ fontSize: 14, height: 22, background: "#e8e4f8", color: "#3a2a7a", border: "1px solid #9a8ac8", borderRadius: 1 }}
                />
              )}

            </Box>
          </Box>
        </Box>


        {/* Metrics Band - 4-column grid with key information */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, 1fr)',
              md: 'repeat(2, 1fr)'
            },
            gap: 3,
            mb: 2
          }}
        >
          {/* CIF Number */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 400 }}>
              CIF
            </Typography>
            <Typography variant="body1" data-testid="text-date-of-birth" sx={{ fontWeight: 400, mt: 0.5 }}>
              {customer.cifNumber || 'N/A'}
            </Typography>
          </Box>

          {customer.branchName && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 400 }}>
                Branch
              </Typography>
              <Typography variant="body1" data-testid="text-date-of-birth" sx={{ fontWeight: 400, mt: 0.5 }}>
                {customer.branchName}
              </Typography>
            </Box>
          )}

          {/* Preferred Name */}
          {customer.preferredName && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 400 }}>
                Preferred Name
              </Typography>
              <Typography variant="body1" data-testid="text-date-of-birth" sx={{ fontWeight: 400, mt: 0.5 }}>
                {customer.preferredName}
              </Typography>
            </Box>
          )}


          {/* Date of Birth - Only for individual customers */}
          {customer.customerType !== 'business' && customer.customerType !== 'trust' && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 400 }}>
                Date of Birth
              </Typography>
              <Typography variant="body1" data-testid="text-date-of-birth" sx={{ fontWeight: 400, mt: 0.5 }}>
                {formatFlatDate(customer.dateOfBirth)}
              </Typography>
            </Box>
          )}

          {/* Customer Since - Always rendered */}
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 400 }}>
              Customer Since
            </Typography>
            <Typography variant="body1" data-testid="text-customer-since" sx={{ fontWeight: 400, mt: 0.5 }}>
              {formatFlatDate(customer.customerSince)}
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
      </CardContent>

      <CardActions>
        {/* View Details Link */}
        <Box sx={{ display: 'flex', justifyContent: 'center', pb: 1, width: "100%" }}>
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

      </CardActions>

      {/* Customer Detail Modal */}
      <CustomerDetailModal
        open={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        customerId={parseInt(customer.id)}
      />

      {/* Maintenance Items Modal */}
      <MaintenanceModal
        open={maintenanceOpen}
        onClose={() => setMaintenanceOpen(false)}
        clientName={customer.name}
        cifNumber={customer.cifNumber}
      />
    </Card>
  );
}
