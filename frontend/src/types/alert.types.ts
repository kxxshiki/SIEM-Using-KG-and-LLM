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
  isLogsUploaded: boolean;
  summaryPercentage: number;
  summaryTrend: number;
  sources: {
    aws: number;
    azure: number;
    gcp: number;
    total: number;
  };
  resolvedAlertsCount: number;
  openAlertsByCategory: {
    networking: number;
    storage: number;
    iam: number;
  };
}