import { Injectable, signal, computed, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

@Injectable({
  providedIn: 'root',
})
export class PwaInstallService {
  private readonly platformId = inject(PLATFORM_ID);
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private readonly DISMISS_KEY = 'pwa-install-dismissed';
  private readonly DISMISS_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

  readonly canInstall = signal(false);
  readonly isIOS = signal(false);
  readonly isStandalone = signal(false);
  readonly isDismissed = signal(false);

  readonly shouldShowInstallBanner = computed(() => {
    // Don't show if already installed
    if (this.isStandalone()) return false;
    // Don't show if user dismissed recently
    if (this.isDismissed()) return false;
    // Show if we can install (Android/Chrome) or if iOS (show manual instructions)
    return this.canInstall() || this.isIOS();
  });

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      this.detectPlatform();
      this.checkDismissed();
      this.listenForInstallPrompt();
    }
  }

  private detectPlatform(): void {
    // Check if running as installed PWA
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    this.isStandalone.set(isStandalone);

    // Check if iOS
    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as any).MSStream;
    this.isIOS.set(isIOS);
  }

  private checkDismissed(): void {
    const dismissedAt = localStorage.getItem(this.DISMISS_KEY);
    if (dismissedAt) {
      const dismissedTime = parseInt(dismissedAt, 10);
      const now = Date.now();
      if (now - dismissedTime < this.DISMISS_DURATION) {
        this.isDismissed.set(true);
      } else {
        // Dismissal expired, remove it
        localStorage.removeItem(this.DISMISS_KEY);
      }
    }
  }

  private listenForInstallPrompt(): void {
    window.addEventListener('beforeinstallprompt', (e: Event) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Store the event for later use
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.canInstall.set(true);
    });

    // Listen for successful installation
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.canInstall.set(false);
      this.isStandalone.set(true);
    });
  }

  async install(): Promise<boolean> {
    if (!this.deferredPrompt) {
      return false;
    }

    // Show the install prompt
    await this.deferredPrompt.prompt();

    // Wait for the user's response
    const { outcome } = await this.deferredPrompt.userChoice;

    // Clear the deferred prompt
    this.deferredPrompt = null;
    this.canInstall.set(false);

    return outcome === 'accepted';
  }

  dismiss(): void {
    localStorage.setItem(this.DISMISS_KEY, Date.now().toString());
    this.isDismissed.set(true);
  }
}
