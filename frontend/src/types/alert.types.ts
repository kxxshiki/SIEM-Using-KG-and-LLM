export interface Alert {
  id: string;
  name: string;
  impactedAssetsCount: number;
  permissions: string;
  connectorName: string;
  connectorType: 'aws' | 'azure' | 'gcp' | 'cyscale';
  assetCategory: 'Networking' | 'Storage' | 'IAM' | 'Compute';
  lastSeenAt: string;
  status: 'Open' | 'Resolved' | 'New';
  
  // Detailed info for when the alert action/row is clicked
  sourceIP?: string;
  destinationID?: string;
  generatedAt?: string;
  whyGenerated?: string;
  whatHappened?: string;
  recommendedSolution?: string;
}

export interface AlertDashboardStats {
  summaryPercentage: number;
  summaryTrend: number;
  openAlertsByCategory: {
    networking: number;
    storage: number;
    iam: number;
  };
}