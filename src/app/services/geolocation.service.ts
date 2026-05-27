import { Injectable, inject, signal } from '@angular/core';
import { OfficeLocation } from '../models/app-data.model';
import { StorageService } from './storage.service';

export interface GeolocationResult {
  success: boolean;
  isAtOffice?: boolean;
  currentPosition?: GeolocationPosition;
  error?: string;
}

@Injectable({
  providedIn: 'root',
})
export class GeolocationService {
  private readonly storageService = inject(StorageService);

  readonly isChecking = signal(false);
  readonly lastError = signal<string | null>(null);

  private isGeolocationAvailable(): boolean {
    return typeof navigator !== 'undefined' && 'geolocation' in navigator;
  }

  async getCurrentPosition(): Promise<GeolocationPosition> {
    if (!this.isGeolocationAvailable()) {
      throw new Error('Geolocation is not available in this browser');
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position),
        (error) => {
          let message: string;
          switch (error.code) {
            case error.PERMISSION_DENIED:
              message = 'Location permission denied. Please enable location access.';
              break;
            case error.POSITION_UNAVAILABLE:
              message = 'Location information unavailable.';
              break;
            case error.TIMEOUT:
              message = 'Location request timed out.';
              break;
            default:
              message = 'An unknown error occurred.';
          }
          reject(new Error(message));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000, // 1 minute cache
        }
      );
    });
  }

  calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    // Haversine formula for calculating distance between two points
    const R = 6371e3; // Earth's radius in meters
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) *
        Math.cos(phi2) *
        Math.sin(deltaLambda / 2) *
        Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  }

  isWithinRadius(
    currentLat: number,
    currentLon: number,
    office: OfficeLocation
  ): boolean {
    const distance = this.calculateDistance(
      currentLat,
      currentLon,
      office.latitude,
      office.longitude
    );
    return distance <= office.radius;
  }

  async checkIfAtOffice(): Promise<GeolocationResult> {
    this.isChecking.set(true);
    this.lastError.set(null);

    try {
      const officeLocation = this.storageService.settings().officeLocation;
      if (!officeLocation) {
        return {
          success: false,
          error: 'Office location not configured. Please set it in Settings.',
        };
      }

      const position = await this.getCurrentPosition();
      const isAtOffice = this.isWithinRadius(
        position.coords.latitude,
        position.coords.longitude,
        officeLocation
      );

      return {
        success: true,
        isAtOffice,
        currentPosition: position,
      };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Unknown error';
      this.lastError.set(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      this.isChecking.set(false);
    }
  }
}
