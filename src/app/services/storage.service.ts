import { Injectable, signal, computed } from '@angular/core';
import {
  AppData,
  AppSettings,
  MonthData,
  OfficeDayLog,
  Holiday,
  DEFAULT_APP_DATA,
  OfficeLocation,
} from '../models/app-data.model';

const STORAGE_KEY = 'office-days-data';
const BACKUP_REMINDER_DISMISSED_KEY = 'office-days-backup-reminder-dismissed';
const BACKUP_REMINDER_DAYS = 2; // Show reminder after this many days

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly data = signal<AppData>(this.loadData());
  private readonly backupReminderDismissedUntil = signal<string | null>(
    this.loadDismissedDate()
  );

  readonly settings = computed(() => this.data().settings);
  readonly monthsData = computed(() => this.data().monthsData);
  readonly lastBackupDate = computed(() => this.data().lastBackupDate);

  readonly shouldShowBackupReminder = computed(() => {
    // Check if reminder was dismissed recently
    const dismissedUntil = this.backupReminderDismissedUntil();
    if (dismissedUntil) {
      const dismissedDate = new Date(dismissedUntil);
      if (dismissedDate > new Date()) {
        return false;
      }
    }

    // Check if there's any data worth backing up
    const stats = this.getDataStats();
    if (stats.totalOfficeDays === 0 && stats.totalHolidays === 0) {
      return false;
    }

    // Check if backup is needed (no backup or backup older than BACKUP_REMINDER_DAYS)
    const lastBackup = this.data().lastBackupDate;
    if (!lastBackup) {
      return true; // Never backed up
    }

    const lastBackupDate = new Date(lastBackup);
    const daysSinceBackup = Math.floor(
      (new Date().getTime() - lastBackupDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    return daysSinceBackup >= BACKUP_REMINDER_DAYS;
  });

  private loadData(): AppData {
    if (typeof localStorage === 'undefined') {
      return DEFAULT_APP_DATA;
    }
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored) as AppData;
      }
    } catch (e) {
      console.error('Failed to load data from localStorage', e);
    }
    return DEFAULT_APP_DATA;
  }

  private loadDismissedDate(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }
    try {
      return localStorage.getItem(BACKUP_REMINDER_DISMISSED_KEY);
    } catch (e) {
      return null;
    }
  }

  private saveDismissedDate(date: string | null): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      if (date) {
        localStorage.setItem(BACKUP_REMINDER_DISMISSED_KEY, date);
      } else {
        localStorage.removeItem(BACKUP_REMINDER_DISMISSED_KEY);
      }
    } catch (e) {
      console.error('Failed to save dismissed date', e);
    }
  }

  private saveData(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data()));
    } catch (e) {
      console.error('Failed to save data to localStorage', e);
    }
  }

  getMonthData(year: number, month: number): MonthData {
    const existing = this.data().monthsData.find(
      (m) => m.year === year && m.month === month
    );
    if (existing) {
      return existing;
    }
    return {
      year,
      month,
      officeDays: [],
      holidays: [],
    };
  }

  saveMonthData(monthData: MonthData): void {
    const currentData = this.data();
    const existingIndex = currentData.monthsData.findIndex(
      (m) => m.year === monthData.year && m.month === monthData.month
    );

    const updatedMonthsData = [...currentData.monthsData];
    if (existingIndex >= 0) {
      updatedMonthsData[existingIndex] = monthData;
    } else {
      updatedMonthsData.push(monthData);
    }

    this.data.set({
      ...currentData,
      monthsData: updatedMonthsData,
    });
    this.saveData();
  }

  addOfficeDay(
    year: number,
    month: number,
    date: string,
    autoDetected: boolean
  ): void {
    const monthData = this.getMonthData(year, month);
    const exists = monthData.officeDays.some((d) => d.date === date);
    if (exists) {
      return;
    }

    const newLog: OfficeDayLog = { date, autoDetected };
    const updatedMonthData: MonthData = {
      ...monthData,
      officeDays: [...monthData.officeDays, newLog].sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
    };
    this.saveMonthData(updatedMonthData);
  }

  removeOfficeDay(year: number, month: number, date: string): void {
    const monthData = this.getMonthData(year, month);
    const updatedMonthData: MonthData = {
      ...monthData,
      officeDays: monthData.officeDays.filter((d) => d.date !== date),
    };
    this.saveMonthData(updatedMonthData);
  }

  addHoliday(year: number, month: number, holiday: Holiday): void {
    const monthData = this.getMonthData(year, month);
    const exists = monthData.holidays.some((h) => h.date === holiday.date);
    if (exists) {
      return;
    }

    const updatedMonthData: MonthData = {
      ...monthData,
      holidays: [...monthData.holidays, holiday].sort((a, b) =>
        a.date.localeCompare(b.date)
      ),
    };
    this.saveMonthData(updatedMonthData);
  }

  removeHoliday(year: number, month: number, date: string): void {
    const monthData = this.getMonthData(year, month);
    const updatedMonthData: MonthData = {
      ...monthData,
      holidays: monthData.holidays.filter((h) => h.date !== date),
    };
    this.saveMonthData(updatedMonthData);
  }

  updateSettings(settings: Partial<AppSettings>): void {
    const currentData = this.data();
    this.data.set({
      ...currentData,
      settings: {
        ...currentData.settings,
        ...settings,
      },
    });
    this.saveData();
  }

  setOfficeLocation(location: OfficeLocation | null): void {
    this.updateSettings({ officeLocation: location });
  }

  resetAllData(): void {
    this.data.set(DEFAULT_APP_DATA);
    this.saveData();
  }

  /**
   * Export all data as JSON string
   */
  exportData(): string {
    // Update the backup date
    const today = new Date().toISOString().split('T')[0];
    const currentData = this.data();
    this.data.set({
      ...currentData,
      lastBackupDate: today,
    });
    this.saveData();

    // Clear any dismissed reminder
    this.backupReminderDismissedUntil.set(null);
    this.saveDismissedDate(null);

    return JSON.stringify(this.data(), null, 2);
  }

  /**
   * Dismiss backup reminder for a number of days
   */
  dismissBackupReminder(days: number = 1): void {
    const dismissUntil = new Date();
    dismissUntil.setDate(dismissUntil.getDate() + days);
    const dismissDate = dismissUntil.toISOString().split('T')[0];
    this.backupReminderDismissedUntil.set(dismissDate);
    this.saveDismissedDate(dismissDate);
  }

  /**
   * Import data from JSON string
   * Returns true if successful, false if invalid data
   */
  importData(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString) as AppData;

      // Validate basic structure
      if (!parsed.settings || !Array.isArray(parsed.monthsData)) {
        return false;
      }

      this.data.set(parsed);
      this.saveData();
      return true;
    } catch (e) {
      console.error('Failed to import data', e);
      return false;
    }
  }

  /**
   * Get stats about stored data for display
   */
  getDataStats(): { totalOfficeDays: number; totalHolidays: number; monthsTracked: number } {
    const data = this.data();
    let totalOfficeDays = 0;
    let totalHolidays = 0;

    for (const month of data.monthsData) {
      totalOfficeDays += month.officeDays.length;
      totalHolidays += month.holidays.length;
    }

    return {
      totalOfficeDays,
      totalHolidays,
      monthsTracked: data.monthsData.length,
    };
  }
}
