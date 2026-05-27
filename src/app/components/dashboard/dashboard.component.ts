import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatListModule } from '@angular/material/list';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { StorageService } from '../../services/storage.service';
import { GeolocationService } from '../../services/geolocation.service';
import { WorkingDaysService, MonthStats } from '../../services/working-days.service';
import { OfficeDayLog } from '../../models/app-data.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressBarModule,
    MatListModule,
    MatSnackBarModule,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class DashboardComponent implements OnInit {
  private readonly storageService = inject(StorageService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly workingDaysService = inject(WorkingDaysService);
  private readonly snackBar = inject(MatSnackBar);

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
}
