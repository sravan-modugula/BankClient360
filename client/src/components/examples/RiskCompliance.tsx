import RiskCompliance from '../RiskCompliance';

export default function RiskComplianceExample() {
  const mockRiskMetrics = {
    creditScore: 742,
    riskRating: 'low',
    riskScore: 25,
    lastAssessment: 'March 15, 2024',
    factors: ['Stable Income', 'Long Credit History', 'Low Debt-to-Income', 'Regular Deposits']
  };

  const mockComplianceItems = [
    {
      id: 'COMP001',
      type: 'KYC Verification',
      description: 'Customer identification and verification completed',
      status: 'compliant' as const,
      lastReview: 'Feb 2024',
      nextReview: 'Feb 2025',
      priority: 'high' as const
    },
    {
      id: 'COMP002',
      type: 'AML Screening',
      description: 'Anti-money laundering checks and monitoring',
      status: 'compliant' as const,
      lastReview: 'Mar 2024',
      nextReview: 'Mar 2025',
      priority: 'high' as const
    },
    {
      id: 'COMP003',
      type: 'Tax Reporting',
      description: 'Tax compliance and reporting requirements',
      status: 'warning' as const,
      lastReview: 'Jan 2024',
      nextReview: 'Apr 2024',
      priority: 'medium' as const
    },
    {
      id: 'COMP004',
      type: 'OFAC Screening',
      description: 'Office of Foreign Assets Control screening',
      status: 'compliant' as const,
      lastReview: 'Mar 2024',
      nextReview: 'Jun 2024',
      priority: 'high' as const
    },
    {
      id: 'COMP005',
      type: 'Data Privacy',
      description: 'Customer data privacy and protection compliance',
      status: 'pending' as const,
      lastReview: 'Feb 2024',
      nextReview: 'May 2024',
      priority: 'low' as const
    }
  ];

  return (
    <RiskCompliance 
      riskMetrics={mockRiskMetrics}
      complianceItems={mockComplianceItems}
      onViewDetails={(itemId) => console.log('View compliance details:', itemId)}
    />
  );
}