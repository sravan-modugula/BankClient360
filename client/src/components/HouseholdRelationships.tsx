import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip, 
  Avatar, 
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  IconButton,
  Divider,
  Button
} from '@mui/material';
import { 
  FamilyRestroom, 
  Person, 
  MoreVert, 
  Add,
  AccountBalance,
  ChildCare,
  Elderly
} from '@mui/icons-material';

interface HouseholdMember {
  id: string;
  name: string;
  relationship: string;
  customerSince?: string;
  totalAccounts: number;
  totalBalance: number;
  isPrimary: boolean;
  age?: number;
}

interface HouseholdRelationshipsProps {
  householdName: string;
  members: HouseholdMember[];
  onViewMember?: (memberId: string) => void;
  onAddMember?: () => void;
}

export default function HouseholdRelationships({ 
  householdName, 
  members, 
  onViewMember, 
  onAddMember 
}: HouseholdRelationshipsProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const getRelationshipIcon = (relationship: string, age?: number) => {
    if (!relationship) return <Person />;
    
    switch (relationship.toLowerCase()) {
      case 'spouse':
      case 'partner':
        return <Person />;
      case 'child':
        return age && age < 18 ? <ChildCare /> : <Person />;
      case 'parent':
        return <Elderly />;
      default:
        return <Person />;
    }
  };

  const getRelationshipColor = (relationship: string) => {
    if (!relationship) return 'default';
    
    switch (relationship.toLowerCase()) {
      case 'primary':
      case 'head of household':
        return 'primary';
      case 'spouse':
      case 'partner':
        return 'secondary';
      case 'child':
        return 'primary';
      default:
        return 'default';
    }
  };

  const getTotalHouseholdBalance = () => {
    return members.reduce((total, member) => total + member.totalBalance, 0);
  };

  return (
    <Card elevation={2}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
          <Typography variant="h5" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <FamilyRestroom color="secondary" />
            Household Relationships
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ textAlign: 'right' }}>
              <Typography variant="body2" color="text.secondary" component="div">Household Total</Typography>
              <Typography variant="h6" color="primary" data-testid="text-household-total" component="div">
                {formatCurrency(getTotalHouseholdBalance())}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ mb: 2 }}>
          <Typography variant="body2" color="text.secondary" component="div">Household Name</Typography>
          <Typography variant="h6" data-testid="text-household-name" component="div">{householdName}</Typography>
        </Box>

        <Divider sx={{ mb: 2 }} />

        <List>
          {members.map((member, index) => (
            <Box key={member.id}>
              <ListItem
                data-testid={`member-${member.id}`}
                sx={{ 
                  px: 0,
                  '&:hover': { 
                    bgcolor: 'action.hover',
                    borderRadius: 1
                  }
                }}
              >
                <ListItemAvatar>
                  <Avatar 
                    sx={{ 
                      bgcolor: member.isPrimary ? 'primary.main' : 'secondary.main',
                      border: member.isPrimary ? '2px solid' : 'none',
                      borderColor: 'primary.dark'
                    }}
                  >
                    {getRelationshipIcon(member.relationship, member.age)}
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body1" fontWeight={member.isPrimary ? 400 : 400}>
                        {member.name}
                      </Typography>
                      <Chip 
                        label={member.relationship}
                        color={getRelationshipColor(member.relationship) as any}
                        size="small"
                        variant={member.isPrimary ? 'filled' : 'outlined'}
                      />
                    </Box>
                  }
                  secondary={
                    <Box sx={{ mt: 0.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        {member.totalAccounts} account{member.totalAccounts !== 1 ? 's' : ''} • {formatCurrency(member.totalBalance)}
                      </Typography>
                      {member.customerSince && (
                        <Typography variant="caption" color="text.secondary">
                          Customer since {member.customerSince}
                        </Typography>
                      )}
                    </Box>
                  }
                />
              </ListItem>
              {index < members.length - 1 && <Divider />}
            </Box>
          ))}
        </List>
      </CardContent>
    </Card>
  );
}