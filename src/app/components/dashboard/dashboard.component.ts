import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatNativeDateModule } from '@angular/material/core';

import { StorageService } from '../../services/storage.service';
import { GeolocationService } from '../../services/geolocation.service';
import { WorkingDaysService, MonthStats } from '../../services/working-days.service';
import { PwaInstallService } from '../../services/pwa-install.service';
import { OfficeDayLog } from '../../models/app-data.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatListModule,
    MatSnackBarModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatInputModule,
    MatNativeDateModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly storageService = inject(StorageService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly workingDaysService = inject(WorkingDaysService);
  private readonly snackBar = inject(MatSnackBar);
  readonly pwaInstallService = inject(PwaInstallService);

  readonly currentYear = signal(new Date().getFullYear());
  readonly currentMonth = signal(new Date().getMonth());

  readonly stats = computed<MonthStats>(() => {
    return this.workingDaysService.getMonthStats(
      this.currentYear(),
      this.currentMonth()
    );
  });

  readonly monthData = computed(() => {
    return this.storageService.getMonthData(
      this.currentYear(),
      this.currentMonth()
    );
  });

  readonly officeDays = computed(() => this.monthData().officeDays);
  readonly holidays = computed(() => this.monthData().holidays);

  readonly monthName = computed(() =>
    this.workingDaysService.getMonthName(this.currentMonth())
  );

  readonly isCurrentMonth = computed(() => {
    const now = new Date();
    return (
      this.currentYear() === now.getFullYear() &&
      this.currentMonth() === now.getMonth()
    );
  });

  readonly hasNoHolidays = computed(() => this.holidays().length === 0);
  readonly isOfficeConfigured = computed(
    () => this.storageService.settings().officeLocation !== null
  );

  readonly isChecking = this.geolocationService.isChecking;
  readonly todayLogged = computed(() => {
    if (!this.isCurrentMonth()) return false;
    const today = this.workingDaysService.getTodayISO();
    return this.officeDays().some((d) => d.date === today);
  });

  readonly isTodayWeekday = computed(() =>
    this.workingDaysService.isTodayWeekday()
  );

  // Manual day addition
  readonly showManualAdd = signal(false);
  readonly selectedDate = signal<Date | null>(null);

  // Date filter for the date picker - only allow valid weekdays
  readonly dateFilter = (date: Date | null): boolean => {
    if (!date) return false;

    const year = this.currentYear();
    const month = this.currentMonth();

    // Only allow dates in the currently viewed month
    if (date.getFullYear() !== year || date.getMonth() !== month) {
      return false;
    }

    // Don't allow future dates
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (date > today) {
      return false;
    }

    // Only allow weekdays
    if (!this.workingDaysService.isWeekday(date)) {
      return false;
    }

    // Don't allow already logged days
    const dateISO = this.workingDaysService.formatDateToISO(date);
    if (this.officeDays().some((d) => d.date === dateISO)) {
      return false;
    }

    // Don't allow holidays
    if (this.workingDaysService.isHoliday(year, month, dateISO)) {
      return false;
    }

    return true;
  };

  // Computed to get available days count for the hint
  readonly availableDaysCount = computed(() => {
    const year = this.currentYear();
    const month = this.currentMonth();
    const today = new Date();
    const weekdays = this.workingDaysService.getWeekdaysInMonth(year, month);

    return weekdays.filter((date) => {
      // Only past or today
      if (date > today) return false;

      const dateISO = this.workingDaysService.formatDateToISO(date);

      // Not already logged
      if (this.officeDays().some((d) => d.date === dateISO)) return false;

      // Not a holiday
      if (this.workingDaysService.isHoliday(year, month, dateISO)) return false;

      return true;
    }).length;
  });

  ngOnInit(): void {
    this.checkLocationOnInit();
  }

  private async checkLocationOnInit(): Promise<void> {
    if (!this.isCurrentMonth()) return;
    if (!this.isOfficeConfigured()) return;
    if (this.todayLogged()) return;
    if (!this.isTodayWeekday()) return;

    const result = await this.geolocationService.checkIfAtOffice();
    if (result.success && result.isAtOffice) {
      this.logToday(true);
      this.snackBar.open('Office presence detected and logged!', 'OK', {
        duration: 3000,
      });
    }
  }

  previousMonth(): void {
    if (this.currentMonth() === 0) {
      this.currentYear.update((y) => y - 1);
      this.currentMonth.set(11);
    } else {
      this.currentMonth.update((m) => m - 1);
    }
  }

  nextMonth(): void {
    if (this.currentMonth() === 11) {
      this.currentYear.update((y) => y + 1);
      this.currentMonth.set(0);
    } else {
      this.currentMonth.update((m) => m + 1);
    }
  }

  goToCurrentMonth(): void {
    const now = new Date();
    this.currentYear.set(now.getFullYear());
    this.currentMonth.set(now.getMonth());
  }

  async checkLocation(): Promise<void> {
    const result = await this.geolocationService.checkIfAtOffice();

    if (!result.success) {
      this.snackBar.open(result.error || 'Failed to check location', 'OK', {
        duration: 5000,
      });
      return;
    }

    if (result.isAtOffice) {
      if (this.todayLogged()) {
        this.snackBar.open('You are at the office (already logged today)', 'OK', {
          duration: 3000,
        });
      } else {
        this.logToday(true);
        this.snackBar.open('Office presence detected and logged!', 'OK', {
          duration: 3000,
        });
      }
    } else {
      this.snackBar.open('You are not at the office location', 'OK', {
        duration: 3000,
      });
    }
  }

  logToday(autoDetected: boolean): void {
    if (!this.isCurrentMonth()) {
      this.snackBar.open('Can only log for current month', 'OK', {
        duration: 3000,
      });
      return;
    }

    const now = new Date();
    const today = this.workingDaysService.getTodayISO();
    this.storageService.addOfficeDay(
      now.getFullYear(),
      now.getMonth(),
      today,
      autoDetected
    );
  }

  addTodayManually(): void {
    if (this.todayLogged()) {
      this.snackBar.open('Today is already logged', 'OK', { duration: 3000 });
      return;
    }
    this.logToday(false);
    this.snackBar.open('Today added manually', 'OK', { duration: 3000 });
  }

  removeDay(day: OfficeDayLog): void {
    this.storageService.removeOfficeDay(
      this.currentYear(),
      this.currentMonth(),
      day.date
    );
    this.snackBar.open('Day removed', 'OK', { duration: 2000 });
  }

  formatDate(dateStr: string): string {
    const date = this.workingDaysService.parseISODate(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  toggleManualAdd(): void {
    this.showManualAdd.update((v) => !v);
    if (!this.showManualAdd()) {
      this.selectedDate.set(null);
    }
  }

  addSelectedDate(): void {
    const date = this.selectedDate();
    if (!date) {
      this.snackBar.open('Please select a date', 'OK', { duration: 3000 });
      return;
    }

    const dateISO = this.workingDaysService.formatDateToISO(date);
    const year = date.getFullYear();
    const month = date.getMonth();

    // Verify it's a valid day to add
    if (!this.dateFilter(date)) {
      this.snackBar.open('This date cannot be added', 'OK', { duration: 3000 });
      return;
    }

    this.storageService.addOfficeDay(year, month, dateISO, false);
    this.snackBar.open(`${this.formatDate(dateISO)} added`, 'OK', {
      duration: 3000,
    });
    this.selectedDate.set(null);
  }

  // Get the min date for the picker (first day of current viewed month)
  getMinDate(): Date {
    return new Date(this.currentYear(), this.currentMonth(), 1);
  }

  // Get the max date for the picker (today or last day of month, whichever is earlier)
  getMaxDate(): Date {
    const today = new Date();
    const lastDayOfMonth = new Date(
      this.currentYear(),
      this.currentMonth() + 1,
      0
    );
    return today < lastDayOfMonth ? today : lastDayOfMonth;
  }

  // PWA Install methods
  async installPwa(): Promise<void> {
    const installed = await this.pwaInstallService.install();
    if (installed) {
      this.snackBar.open('App installed successfully!', 'OK', { duration: 3000 });
    }
  }

  dismissInstallBanner(): void {
    this.pwaInstallService.dismiss();
  }
}
