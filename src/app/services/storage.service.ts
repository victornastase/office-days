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

@Injectable({
  providedIn: 'root',
})
export class StorageService {
  private readonly data = signal<AppData>(this.loadData());

  readonly settings = computed(() => this.data().settings);
  readonly monthsData = computed(() => this.data().monthsData);

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
}
