import { 
  Card, 
  CardContent, 
  Typography, 
  Box, 
  Chip, 
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Grid,
  Paper,
  IconButton,
  Tooltip
} from '@mui/material';
import { 
  Security, 
  Warning, 
  CheckCircle, 
  Error,
  Schedule,
  VerifiedUser,
  Assessment,
  Policy,
  Flag,
  Visibility
} from '@mui/icons-material';

interface ComplianceItem {
  id: string;
  type: string;
  description: string;
  status: 'compliant' | 'warning' | 'violation' | 'pending';
  lastReview: string;
  nextReview?: string;
  priority: 'low' | 'medium' | 'high';
}

interface RiskMetrics {
  creditScore: number;
  riskRating: string;
  riskScore: number;
  lastAssessment: string;
  factors: string[];
}

interface RiskComplianceProps {
  riskMetrics: RiskMetrics;
  complianceItems: ComplianceItem[];
  onViewDetails?: (itemId: string) => void;
}

export default function RiskCompliance({ riskMetrics, complianceItems, onViewDetails }: RiskComplianceProps) {
  const getRiskColor = (rating: string) => {
    switch (rating.toLowerCase()) {
      case 'low': return 'primary';
      case 'medium': return 'secondary';
      case 'high': return 'primary';
      default: return 'default';
    }
  };

  const getComplianceIcon = (status: string) => {
    switch (status) {
      case 'compliant': return <CheckCircle color="primary" />;
      case 'warning': return <Warning color="secondary" />;
      case 'violation': return <Error color="primary" />;
      case 'pending': return <Schedule color="action" />;
      default: return <Policy />;
    }
  };

  const getComplianceColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'primary';
      case 'warning': return 'secondary';
      case 'violation': return 'primary';
      case 'pending': return 'primary';
      default: return 'default';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'primary';
      case 'medium': return 'secondary';
      case 'low': return 'primary';
      default: return 'default';
    }
  };

  const getComplianceScore = () => {
    const compliant = complianceItems.filter(item => item.status === 'compliant').length;
    return Math.round((compliant / complianceItems.length) * 100);
  };

  const getCreditScoreColor = (score: number) => {
    if (score >= 750) return 'primary';
    if (score >= 650) return 'secondary';
    return 'primary';
  };

  return (
    <Card elevation={2}>
      <CardContent>
        <Typography variant="h5" component="h2" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <Security color="secondary" />
          Risk & Compliance Overview
        </Typography>

        <Grid container spacing={3}>
          {/* Risk Metrics */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <Assessment color="secondary" />
                Risk Assessment
              </Typography>
              
              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary">Overall Risk Rating</Typography>
                  <Chip 
                    label={riskMetrics.riskRating.toUpperCase()}
                    color={getRiskColor(riskMetrics.riskRating) as any}
                    icon={<Security />}
                    data-testid="chip-risk-rating"
                  />
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={riskMetrics.riskScore} 
                  color={getRiskColor(riskMetrics.riskRating) as any}
                  sx={{ height: 8, borderRadius: 1 }}
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
                  Risk Score: {riskMetrics.riskScore}/100
                </Typography>
              </Box>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" component="div">Credit Score</Typography>
                <Typography 
                  variant="h4" 
                  color={getCreditScoreColor(riskMetrics.creditScore) + '.main'}
                  data-testid="text-credit-score"
                  component="div"
                >
                  {riskMetrics.creditScore}
                </Typography>
              </Box>

              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>Risk Factors</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {riskMetrics.factors.map((factor, index) => (
                    <Chip
                      key={index}
                      label={factor}
                      size="small"
                      variant="outlined"
                      data-testid={`factor-${index}`}
                    />
                  ))}
                </Box>
              </Box>

              <Typography variant="caption" color="text.secondary" sx={{ mt: 2, display: 'block' }}>
                Last Assessment: {riskMetrics.lastAssessment}
              </Typography>
            </Paper>
          </Grid>

          {/* Compliance Status */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <VerifiedUser color="secondary" />
                Compliance Status
              </Typography>

              <Box sx={{ mb: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                  <Typography variant="body2" color="text.secondary" component="div">Compliance Score</Typography>
                  <Typography variant="h6" color="primary.main" data-testid="text-compliance-score" component="div">
                    {getComplianceScore()}%
                  </Typography>
                </Box>
                <LinearProgress 
                  variant="determinate" 
                  value={getComplianceScore()} 
                  color="primary"
                  sx={{ height: 8, borderRadius: 1 }}
                />
              </Box>

              <List dense>
                {complianceItems.slice(0, 4).map((item) => (
                  <ListItem 
                    key={item.id}
                    data-testid={`compliance-item-${item.id}`}
                    sx={{ px: 0 }}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      {getComplianceIcon(item.status)}
                    </ListItemIcon>
                    <ListItemText
                      primary={
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                          <Typography variant="body2">
                            {item.type}
                          </Typography>
                          <Chip 
                            label={item.status.toUpperCase()}
                            color={getComplianceColor(item.status) as any}
                            size="small"
                          />
                          <Chip 
                            label={item.priority.toUpperCase()}
                            color={getPriorityColor(item.priority) as any}
                            size="small"
                            variant="outlined"
                            icon={<Flag />}
                          />
                        </Box>
                      }
                      secondary={
                        <Typography variant="caption" color="text.secondary">
                          Last Review: {item.lastReview}
                          {item.nextReview && ` • Next: ${item.nextReview}`}
                        </Typography>
                      }
                    />
                    <Tooltip title="View Details">
                      <IconButton 
                        size="small"
                        onClick={() => {
                          console.log('View compliance details:', item.id);
                          onViewDetails?.(item.id);
                        }}
                        data-testid={`button-view-compliance-${item.id}`}
                      >
                        <Visibility />
                      </IconButton>
                    </Tooltip>
                  </ListItem>
                ))}
              </List>

              {complianceItems.length > 4 && (
                <Typography variant="caption" color="primary" sx={{ cursor: 'pointer', mt: 1, display: 'block' }}>
                  View all {complianceItems.length} compliance items →
                </Typography>
              )}
            </Paper>
          </Grid>
        </Grid>
      </CardContent>
    </Card>
  );
}