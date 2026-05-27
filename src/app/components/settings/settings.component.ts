import { Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSliderModule } from '@angular/material/slider';
import { MatListModule } from '@angular/material/list';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';

import { StorageService } from '../../services/storage.service';
import { GeolocationService } from '../../services/geolocation.service';
import { WorkingDaysService } from '../../services/working-days.service';
import {
  OfficeLocation,
  Holiday,
  DEFAULT_RADIUS,
  MIN_RADIUS,
  MAX_RADIUS,
} from '../../models/app-data.model';

type DateSelectionMode = 'single' | 'range';

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatCardModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatIconModule,
    MatInputModule,
    MatFormFieldModule,
    MatSliderModule,
    MatListModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSnackBarModule,
    MatDividerModule,
  ],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.css',
})
export class SettingsComponent {
  private readonly storageService = inject(StorageService);
  private readonly geolocationService = inject(GeolocationService);
  private readonly workingDaysService = inject(WorkingDaysService);
  private readonly snackBar = inject(MatSnackBar);

  readonly MIN_RADIUS = MIN_RADIUS;
  readonly MAX_RADIUS = MAX_RADIUS;

  // Location settings
  readonly latitude = signal<number | null>(null);
  readonly longitude = signal<number | null>(null);
  readonly radius = signal(DEFAULT_RADIUS);

  // Holiday form
  readonly dateSelectionMode = signal<DateSelectionMode>('single');
  readonly holidaySingleDate = signal<Date | null>(null);
  readonly holidayStartDate = signal<Date | null>(null);
  readonly holidayEndDate = signal<Date | null>(null);
  readonly holidayType = signal<'legal' | 'vacation'>('vacation');
  readonly holidayDescription = signal('');

  // Current month for holiday management
  readonly currentYear = signal(new Date().getFullYear());
  readonly currentMonth = signal(new Date().getMonth());

  readonly monthName = computed(() =>
    this.workingDaysService.getMonthName(this.currentMonth())
  );

  readonly monthData = computed(() =>
    this.storageService.getMonthData(this.currentYear(), this.currentMonth())
  );

  readonly holidays = computed(() => this.monthData().holidays);

  readonly isGettingLocation = this.geolocationService.isChecking;

  readonly hasOfficeLocation = computed(
    () => this.storageService.settings().officeLocation !== null
  );

  // Computed for date range display
  readonly dateRangePreview = computed(() => {
    const start = this.holidayStartDate();
    const end = this.holidayEndDate();
    if (!start || !end) return null;

    const days = this.getDatesBetween(start, end);
    return {
      count: days.length,
      weekdays: days.filter((d) => this.workingDaysService.isWeekday(d)).length,
    };
  });

  constructor() {
    // Initialize form with stored values
    const settings = this.storageService.settings();
    if (settings.officeLocation) {
      this.latitude.set(settings.officeLocation.latitude);
      this.longitude.set(settings.officeLocation.longitude);
      this.radius.set(settings.officeLocation.radius);
    }
  }

  async useCurrentLocation(): Promise<void> {
    try {
      const position = await this.geolocationService.getCurrentPosition();
      this.latitude.set(Number(position.coords.latitude.toFixed(6)));
      this.longitude.set(Number(position.coords.longitude.toFixed(6)));
      this.snackBar.open('Location captured!', 'OK', { duration: 2000 });
    } catch (e) {
      const error = e instanceof Error ? e.message : 'Failed to get location';
      this.snackBar.open(error, 'OK', { duration: 5000 });
    }
  }

  saveLocation(): void {
    const lat = this.latitude();
    const lon = this.longitude();

    if (lat === null || lon === null) {
      this.snackBar.open('Please enter coordinates', 'OK', { duration: 3000 });
      return;
    }

    if (lat < -90 || lat > 90) {
      this.snackBar.open('Latitude must be between -90 and 90', 'OK', {
        duration: 3000,
      });
      return;
    }

    if (lon < -180 || lon > 180) {
      this.snackBar.open('Longitude must be between -180 and 180', 'OK', {
        duration: 3000,
      });
      return;
    }

    const location: OfficeLocation = {
      latitude: lat,
      longitude: lon,
      radius: this.radius(),
    };

    this.storageService.setOfficeLocation(location);
    this.snackBar.open('Office location saved!', 'OK', { duration: 2000 });
  }

  clearLocation(): void {
    this.storageService.setOfficeLocation(null);
    this.latitude.set(null);
    this.longitude.set(null);
    this.radius.set(DEFAULT_RADIUS);
    this.snackBar.open('Office location cleared', 'OK', { duration: 2000 });
  }

  // Holiday month navigation
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

  onDateModeChange(mode: DateSelectionMode): void {
    this.dateSelectionMode.set(mode);
    // Reset dates when switching modes
    this.holidaySingleDate.set(null);
    this.holidayStartDate.set(null);
    this.holidayEndDate.set(null);
  }

  private getDatesBetween(start: Date, end: Date): Date[] {
    const dates: Date[] = [];
    const current = new Date(start);

    while (current <= end) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  addHoliday(): void {
    if (this.dateSelectionMode() === 'single') {
      this.addSingleHoliday();
    } else {
      this.addRangeHolidays();
    }
  }

  private addSingleHoliday(): void {
    const date = this.holidaySingleDate();
    if (!date) {
      this.snackBar.open('Please select a date', 'OK', { duration: 3000 });
      return;
    }

    const dateStr = this.workingDaysService.formatDateToISO(date);
    const holiday: Holiday = {
      date: dateStr,
      type: this.holidayType(),
      description: this.holidayDescription() || undefined,
    };

    this.storageService.addHoliday(date.getFullYear(), date.getMonth(), holiday);

    // Reset form
    this.holidaySingleDate.set(null);
    this.holidayDescription.set('');

    this.snackBar.open('Holiday added!', 'OK', { duration: 2000 });
  }

  private addRangeHolidays(): void {
    const start = this.holidayStartDate();
    const end = this.holidayEndDate();

    if (!start || !end) {
      this.snackBar.open('Please select both start and end dates', 'OK', {
        duration: 3000,
      });
      return;
    }

    if (start > end) {
      this.snackBar.open('Start date must be before end date', 'OK', {
        duration: 3000,
      });
      return;
    }

    const dates = this.getDatesBetween(start, end);
    const description = this.holidayDescription() || undefined;
    let addedCount = 0;

    for (const date of dates) {
      const dateStr = this.workingDaysService.formatDateToISO(date);
      const holiday: Holiday = {
        date: dateStr,
        type: this.holidayType(),
        description,
      };

      // Check if already exists before adding
      const existingMonth = this.storageService.getMonthData(
        date.getFullYear(),
        date.getMonth()
      );
      const alreadyExists = existingMonth.holidays.some(
        (h) => h.date === dateStr
      );

      if (!alreadyExists) {
        this.storageService.addHoliday(
          date.getFullYear(),
          date.getMonth(),
          holiday
        );
        addedCount++;
      }
    }

    // Reset form
    this.holidayStartDate.set(null);
    this.holidayEndDate.set(null);
    this.holidayDescription.set('');

    if (addedCount > 0) {
      this.snackBar.open(`${addedCount} days added!`, 'OK', { duration: 2000 });
    } else {
      this.snackBar.open('All dates already exist', 'OK', { duration: 2000 });
    }
  }

  removeHoliday(holiday: Holiday): void {
    const date = this.workingDaysService.parseISODate(holiday.date);
    this.storageService.removeHoliday(
      date.getFullYear(),
      date.getMonth(),
      holiday.date
    );
    this.snackBar.open('Holiday removed', 'OK', { duration: 2000 });
  }

  formatHolidayDate(dateStr: string): string {
    const date = this.workingDaysService.parseISODate(dateStr);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  }

  resetAllData(): void {
    if (
      confirm('Are you sure you want to reset all data? This cannot be undone.')
    ) {
      this.storageService.resetAllData();
      this.latitude.set(null);
      this.longitude.set(null);
      this.radius.set(DEFAULT_RADIUS);
      this.snackBar.open('All data has been reset', 'OK', { duration: 3000 });
    }
  }
}
