import axiosClient from './axiosClient';
import { Alert } from '../types/alert.types';

export const alertsApi = {
  // Fetch all alerts
  getAlerts: async (): Promise<Alert[]> => {
    const response = await axiosClient.get('/alerts');
    return response.data;
  },

  // Fetch a single alert by ID
  getAlertById: async (id: string): Promise<Alert> => {
    const response = await axiosClient.get(`/alerts/${id}`);
    return response.data;
  },

  // Resolve an alert
  resolveAlert: async (id: string): Promise<Alert> => {
    const response = await axiosClient.patch(`/alerts/${id}/resolve`);
    return response.data;
  },
};