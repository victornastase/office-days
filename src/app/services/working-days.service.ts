import { Injectable, inject, computed } from '@angular/core';
import { StorageService } from './storage.service';
import { Holiday, MonthData } from '../models/app-data.model';

export interface MonthStats {
  year: number;
  month: number;
  totalWeekdays: number;
  legalHolidays: number;
  vacationDays: number;
  workingDays: number; // totalWeekdays - legalHolidays - vacationDays
  requiredOfficeDays: number; // 50% of workingDays (rounded up)
  actualOfficeDays: number;
  isOnTrack: boolean;
  progressPercent: number;
  remainingToTarget: number;
}

@Injectable({
  providedIn: 'root',
})
export class WorkingDaysService {
  private readonly storageService = inject(StorageService);

  /**
   * Get all weekdays (Monday-Friday) in a given month
   */
  getWeekdaysInMonth(year: number, month: number): Date[] {
    const weekdays: Date[] = [];
    const date = new Date(year, month, 1);

    while (date.getMonth() === month) {
      const dayOfWeek = date.getDay();
      // 0 = Sunday, 6 = Saturday
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        weekdays.push(new Date(date));
      }
      date.setDate(date.getDate() + 1);
    }

    return weekdays;
  }

  /**
   * Count total weekdays in a month
   */
  countWeekdaysInMonth(year: number, month: number): number {
    return this.getWeekdaysInMonth(year, month).length;
  }

  /**
   * Format date to ISO string (YYYY-MM-DD)
   */
  formatDateToISO(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Parse ISO date string to Date
   */
  parseISODate(dateStr: string): Date {
    const [year, month, day] = dateStr.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  /**
   * Check if a date falls on a weekday
   */
  isWeekday(date: Date): boolean {
    const dayOfWeek = date.getDay();
    return dayOfWeek !== 0 && dayOfWeek !== 6;
  }

  /**
   * Count holidays that fall on weekdays
   */
  countHolidaysOnWeekdays(holidays: Holiday[]): { legal: number; vacation: number } {
    let legal = 0;
    let vacation = 0;

    for (const holiday of holidays) {
      const date = this.parseISODate(holiday.date);
      if (this.isWeekday(date)) {
        if (holiday.type === 'legal') {
          legal++;
        } else {
          vacation++;
        }
      }
    }

    return { legal, vacation };
  }

  /**
   * Calculate the required office days (50% of working days, rounded up)
   */
  calculateRequiredOfficeDays(workingDays: number): number {
    return Math.ceil(workingDays * 0.5);
  }

  /**
   * Get complete statistics for a month
   */
  getMonthStats(year: number, month: number): MonthStats {
    const monthData = this.storageService.getMonthData(year, month);
    const totalWeekdays = this.countWeekdaysInMonth(year, month);

    const holidayCounts = this.countHolidaysOnWeekdays(monthData.holidays);
    const legalHolidays = holidayCounts.legal;
    const vacationDays = holidayCounts.vacation;

    // Working days = total weekdays minus legal holidays minus vacation days
    const workingDays = totalWeekdays - legalHolidays - vacationDays;
    const requiredOfficeDays = this.calculateRequiredOfficeDays(workingDays);
    const actualOfficeDays = monthData.officeDays.length;

    const isOnTrack = actualOfficeDays >= requiredOfficeDays;
    const progressPercent = requiredOfficeDays > 0
      ? Math.min(100, Math.round((actualOfficeDays / requiredOfficeDays) * 100))
      : 100;
    const remainingToTarget = Math.max(0, requiredOfficeDays - actualOfficeDays);

    return {
      year,
      month,
      totalWeekdays,
      legalHolidays,
      vacationDays,
      workingDays,
      requiredOfficeDays,
      actualOfficeDays,
      isOnTrack,
      progressPercent,
      remainingToTarget,
    };
  }

  /**
   * Get current month stats
   */
  getCurrentMonthStats(): MonthStats {
    const now = new Date();
    return this.getMonthStats(now.getFullYear(), now.getMonth());
  }

  /**
   * Check if a specific date is already logged as an office day
   */
  isOfficeDayLogged(year: number, month: number, date: string): boolean {
    const monthData = this.storageService.getMonthData(year, month);
    return monthData.officeDays.some((d) => d.date === date);
  }

  /**
   * Get today's date formatted as ISO string
   */
  getTodayISO(): string {
    return this.formatDateToISO(new Date());
  }

  /**
   * Check if today is a weekday
   */
  isTodayWeekday(): boolean {
    return this.isWeekday(new Date());
  }

  /**
   * Check if today is already logged
   */
  isTodayLogged(): boolean {
    const now = new Date();
    const today = this.getTodayISO();
    return this.isOfficeDayLogged(now.getFullYear(), now.getMonth(), today);
  }

  /**
   * Check if a date is a holiday for the given month
   */
  isHoliday(year: number, month: number, dateStr: string): Holiday | undefined {
    const monthData = this.storageService.getMonthData(year, month);
    return monthData.holidays.find((h) => h.date === dateStr);
  }

  /**
   * Get month name
   */
  getMonthName(month: number): string {
    const months = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    return months[month];
  }
}
