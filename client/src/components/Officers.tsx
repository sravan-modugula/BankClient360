import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip, 
  Avatar,
  Divider
} from '@mui/material';
import { 
  Person, 
  Work,
  SupervisorAccount
} from '@mui/icons-material';

interface Officer {
  id: string;
  name: string;
  title: string;
  department: string;
  isPrimary: boolean;
}

interface OfficersProps {
  officers: Officer[];
}

export default function Officers({ officers }: OfficersProps) {
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getDepartmentColor = (department: string) => {
    switch (department.toLowerCase()) {
      case 'lending': return 'primary';
      case 'wealth': return 'success';
      case 'commercial': return 'info';
      case 'retail': return 'warning';
      default: return 'default';
    }
  };

  return (
    <Card elevation={2} sx={{ width: '100%', flex: 1, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <CardContent sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <SupervisorAccount color="secondary" />
          Bank Officers
        </Typography>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
          {officers.map((officer, index) => (
            <Box key={officer.id}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar 
                  sx={{ 
                    width: 32, 
                    height: 32, 
                    bgcolor: officer.isPrimary ? 'primary.main' : 'secondary.main',
                    fontSize: '0.75rem'
                  }}
                  data-testid={`avatar-officer-${officer.id}`}
                >
                  {getInitials(officer.name)}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="body2" sx={{ fontWeight: 400 }} data-testid={`text-officer-name-${officer.id}`}>
                      {officer.name}
                    </Typography>
                    {officer.isPrimary && (
                      <Chip 
                        label="Primary"
                        color="primary"
                        size="small"
                        sx={{ fontSize: '0.7rem', height: 18 }}
                        data-testid={`chip-primary-${officer.id}`}
                      />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary" data-testid={`text-officer-title-${officer.id}`}>
                    {officer.title}
                  </Typography>
                  <Box sx={{ mt: 0.5 }}>
                    <Chip 
                      label={officer.department}
                      color={getDepartmentColor(officer.department) as any}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: 18 }}
                      data-testid={`chip-department-${officer.id}`}
                    />
                  </Box>
                </Box>
              </Box>
              {index < officers.length - 1 && <Divider sx={{ mt: 1.5 }} />}
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
}