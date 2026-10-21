export type Role = "admin" | "analyst";

export interface User {
  id?: number;
  username: string;
  email?: string;
  role: Role;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  username: string;
  role: Role;
}

export interface Alert {
  id: number;
  log_id: number;
  alert_type: string; // doubles as the alert title
  rule_name: string;
  severity: string; // critical | high | medium | low
  risk_score: number;
  confidence: number; // detection-time confidence, 0-1
  ip_address: string | null;
  description: string | null;
  status: string; // NEW | UNDER_INVESTIGATION | CONFIRMED_THREAT | FALSE_POSITIVE | RESOLVED
  created_at: string;
  confidence_score: number | null; // investigation confidence, 0-100
  investigation_result: string | null;
  investigation_reason: string | null;
  detected_by: string | null;
  related_event_count: number | null;
  recommended_action: string | null;
  investigated_by: string | null;
  investigated_at: string | null;
  resolved_at: string | null;
  mitre_technique_id: string | null;
  mitre_technique_name: string | null;
  mitre_tactic: string | null;
}

export interface AlertListResponse {
  total: number;
  alerts: Alert[];
}

export interface UploadResult {
  message: string;
  filename: string;
  logs_parsed: number;
  logs_failed: number;
  alerts_created: number;
}

export interface CountItem {
  name: string;
  count: number;
}

export interface DayCount {
  date: string;
  count: number;
}

export interface DashboardSummary {
  total_logs: number;
  total_alerts: number;
  threats_today: number;
  critical_open_alerts: number;
  confirmed_threats: number;
  threat_trend: DayCount[];
  log_volume: DayCount[];
  attack_types: CountItem[];
  status_breakdown: CountItem[];
  severity_breakdown: CountItem[];
  top_ips: CountItem[];
  top_countries: CountItem[];
  generated_at: string;
    has_data: boolean;
}