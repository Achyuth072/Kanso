export interface Profile {
  id: string;
  display_name: string | null;
  settings: UserSettings;
  timezone: string;
  is_premium: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  notifications?: {
    morning_briefing: boolean;
    evening_plan: boolean;
    due_date_alerts: boolean;
    do_date_alerts: boolean;
    timer_alerts: boolean;
  };
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  notifications: {
    morning_briefing: true,
    evening_plan: true,
    due_date_alerts: true,
    do_date_alerts: true,
    timer_alerts: true,
  },
};
