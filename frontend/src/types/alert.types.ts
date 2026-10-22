
export type AlertStatus =
  | 'NEW'
  | 'UNDER_INVESTIGATION'
  | 'CONFIRMED_THREAT'
  | 'FALSE_POSITIVE'
  | 'RESOLVED';

export interface Alert {
  id: number;
  log_id: number;

  alert_type: string;
  rule_name: string;
  severity: string;
  risk_score: number;
  confidence: number;

  ip_address?: string | null;
  description?: string | null;
  status: AlertStatus;

  confidence_score?: number | null;

  // AI investigation fields returned by the backend
  investigation_result?: string | null;
  investigation_reason?: string | null;
  investigated_by?: string | null;
  investigated_at?: string | null;

  detected_by?: string | null;
  related_event_count?: number | null;
  recommended_action?: string | null;
  resolved_at?: string | null;
  created_at: string;

  mitre_technique_id?: string | null;
  mitre_technique_name?: string | null;
  mitre_tactic?: string | null;
}

export interface AlertsResponse {
  total: number;
  alerts: Alert[];
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
