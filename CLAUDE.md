# Office Days — CLAUDE.md

## Project Overview

A **Progressive Web App (PWA)** that automatically tracks how many days per month a user spends in the office, using the browser's Geolocation API. No backend, no database, no hosting infrastructure — everything runs client-side and persists in `localStorage`.

The app is built with **Angular** and targets mobile (installable via "Add to Home Screen"). The core interaction is passive: open the app when arriving at the office, and it logs the day automatically.

---

## General rules

- Working days per mounth calculation - days from Monday to Friday (no weekends), excepting legal holidays and personal holidays (vacation days). Example: if the month has 20 working days, 1 legal holiday and 4 normal holidays, the total number will be 15 woking days.
- From the total working days, at least 50% should be in the office. This means that if a mounth has 21 working days, 11 days should be at the office.

---

## Goals & Constraints

- **Zero infrastructure**: no server, no DB, no cloud functions
- **Zero manual check-in**: detection is GPS-based, triggered on app open
- **Mobile-first**: designed to be pinned to the home screen as a PWA
- **Lightweight**: minimal dependencies, fast load, works offline
- **Target**: help the user track a 50% monthly office presence requirement

---

## Tech Stack

| Concern | Choice |
|---|---|
| Framework | Angular 17+ (standalone components) |
| PWA | `@angular/pwa` (service worker + manifest) |
| Styling | Angular Material (minimal theme) |
| Location | Browser Geolocation API (native, no SDK) |
| Storage | `localStorage` (no external DB) |
| Hosting | GitHub Pages or local file (static only) |

---

## Dashboard Component

Displays for the **current month**:

- Large counter: `X days in office`
- Progress bar toward the 50% target
- Status label: `On track ` / `Behind`
- Scrollable list of logged days (with delete option for manual correction)
- Button: `+ Add today manually` (fallback if GPS fails)
- Warnig for not added current mounth vacantions and legal holidays
- Navigation: check previous/next month

---

## Settings Component

- **Map or coordinate input**: latitude + longitude of the office
- **Radius slider**: 50m – 500m (default 150m)
- **"Use my current location"** button → auto-fills coords from GPS
- **Save** button
- **Add & Edit legal holidays & vacation days**: posibility to add legal holidays and vacations for correct working days calculus. Should be udated every month.
- **Reset all data** button (with confirmation dialog)

--- 

## Known Limitations

| Limitation | Impact | Mitigation |
|---|---|---|
| No background GPS (browser limitation) | App must be opened to detect location | Low friction: open app once on arrival |
| localStorage ~5MB limit | Irrelevant for this data size | No action needed |
| iOS PWA service worker support is partial | Push notifications may not work on iOS | Not a core feature |
| GPS accuracy varies indoors | May not detect presence inside building | Increase radius in settings (e.g. 300m) |

---

## Deployment to GitHub Pages

Deployment is automated via GitHub Actions. Every push to `main` triggers a build and deploy.

### Setup (One-time)

1. Go to repository **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. Save

### How It Works

The workflow (`.github/workflows/deploy.yml`) automatically:
- Installs dependencies
- Builds the app with correct base href
- Deploys to GitHub Pages

### Manual Trigger

You can also trigger a deploy manually:
1. Go to **Actions** tab
2. Select **Deploy to GitHub Pages**
3. Click **Run workflow**

### Post-Deployment

- App URL: `https://<username>.github.io/office-days/`
- PWA installation works on HTTPS (provided by GitHub Pages)
- Service worker enables offline support

### Troubleshooting

| Issue | Solution |
|---|---|
| 404 on refresh | Add `404.html` that redirects to `index.html` |
| Assets not loading | Verify `--base-href` in workflow matches repository name |
| Service worker not updating | Clear browser cache or hard refresh |
