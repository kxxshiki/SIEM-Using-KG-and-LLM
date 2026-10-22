
import axiosClient from './axiosClient';
import { Alert } from '../types/alert.types';

export interface AlertsResponse {
  total: number;
  alerts: Alert[];
}

export const alertsApi = {
  // Fetch real alerts from the backend
  getAlerts: async (): Promise<Alert[]> => {
    const response = await axiosClient.get<AlertsResponse>('/alerts');
    return response.data.alerts;
  },

  // Fetch one alert, including its saved AI investigation
  getAlertById: async (id: string): Promise<Alert> => {
    const response = await axiosClient.get<Alert>(`/alerts/${id}`);
    return response.data;
  },

  // Start an AI investigation
  investigateAlert: async (id: string): Promise<Alert> => {
    const response = await axiosClient.post<Alert>(
      `/alerts/${id}/investigate`,
    );
    return response.data;
  },

  // Update the alert lifecycle status
  updateAlertStatus: async (
    id: string,
    action:
      | 'NEW'
      | 'UNDER_INVESTIGATION'
      | 'CONFIRMED_THREAT'
      | 'FALSE_POSITIVE'
      | 'RESOLVED',
  ): Promise<Alert> => {
    const response = await axiosClient.put<Alert>(
      `/alerts/${id}/action`,
      { action },
    );
    return response.data;
  },

  // Resolve an alert using the backend's actual endpoint
  resolveAlert: async (id: string): Promise<Alert> => {
    return alertsApi.updateAlertStatus(id, 'RESOLVED');
  },
};
