export interface OfficeLocation {
  latitude: number;
  longitude: number;
  radius: number; // in meters
}

export interface Holiday {
  date: string; // ISO date string YYYY-MM-DD
  type: 'legal' | 'vacation';
  description?: string;
}

export interface OfficeDayLog {
  date: string; // ISO date string YYYY-MM-DD
  autoDetected: boolean;
}

export interface MonthData {
  year: number;
  month: number; // 0-11
  officeDays: OfficeDayLog[];
  holidays: Holiday[];
}

export interface AppSettings {
  officeLocation: OfficeLocation | null;
  defaultHolidays: Holiday[]; // Holidays that apply to all months
}

export interface AppData {
  settings: AppSettings;
  monthsData: MonthData[];
}

export const DEFAULT_APP_DATA: AppData = {
  settings: {
    officeLocation: null,
    defaultHolidays: [],
  },
  monthsData: [],
};

export const DEFAULT_RADIUS = 150; // meters
export const MIN_RADIUS = 50;
export const MAX_RADIUS = 500;
