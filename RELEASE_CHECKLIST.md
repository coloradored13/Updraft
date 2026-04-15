# Updraft Release Checklist

Complete guide from "builds complete" to "live in stores and on the web." Follow each section in order. Check off items as you go.

---

## Table of Contents

1. [Prerequisites and Accounts](#1-prerequisites-and-accounts)
2. [Pre-Release Verification](#2-pre-release-verification)
3. [Web Deployment (Cloudflare Pages)](#3-web-deployment-cloudflare-pages)
4. [iOS Release (App Store)](#4-ios-release-app-store)
5. [Android Release (Google Play)](#5-android-release-google-play)
6. [Post-Launch Monitoring](#6-post-launch-monitoring)
7. [Rollback Procedures](#7-rollback-procedures)

---

## 1. Prerequisites and Accounts

Complete these one-time setup steps before your first release.

### Apple Developer Account (~30 min + up to 48 hours for enrollment approval)

- [ ] Enroll in the Apple Developer Program at https://developer.apple.com/programs/enroll/
- [ ] Pay the $99/year fee
- [ ] Wait for enrollment approval (usually 24-48 hours)
- [ ] Log in to App Store Connect at https://appstoreconnect.apple.com
- [ ] Accept any pending agreements (Paid Applications, tax/banking forms)

**Reference**: https://developer.apple.com/support/enrollment/

### Google Play Developer Account (~30 min + up to 48 hours for verification)

- [ ] Register at https://play.google.com/console/signup
- [ ] Pay the $25 one-time fee
- [ ] Complete identity verification (may require government ID)
- [ ] Set up a payments profile if distributing paid apps or in-app purchases
- [ ] Accept the Developer Distribution Agreement

**Reference**: https://support.google.com/googleplay/android-developer/answer/6112435

### Development Machine Requirements

- [ ] macOS with Xcode 15+ installed (required for iOS builds)
- [ ] Android Studio installed with SDK 34+ (API level 34)
- [ ] Node.js 18+ and npm installed
- [ ] CocoaPods installed (`sudo gem install cocoapods` or `brew install cocoapods`)
- [ ] Java 17+ (required by Android Gradle)
- [ ] Cloudflare account created at https://dash.cloudflare.com

### Domain Setup (if using custom domain for web version)

- [ ] Purchase/own a domain name
- [ ] Add the domain to Cloudflare (or your DNS provider)
- [ ] Configure DNS to point to Cloudflare Pages (done during web deployment)

---

## 2. Pre-Release Verification

Run through these checks every time before any release.

### Build Verification (~5 min)

- [ ] Pull latest code: `git pull origin main`
- [ ] Install dependencies: `npm ci`
- [ ] Run production build: `npm run build`
- [ ] Verify `dist/` directory is created with `index.html` and `assets/` folder
- [ ] Check build output for warnings or errors
- [ ] Verify compressed bundle sizes are reasonable (Phaser ~1MB, app code <100KB)

### Local Testing (~15 min)

- [ ] Preview the build: `npm run preview`
- [ ] Open in Chrome DevTools mobile emulation (390x844, iPhone 14 Pro)
- [ ] Verify sky blue (#87CEEB) background renders correctly
- [ ] Test complete game flow: Title -> Gameplay -> Game Over / Victory
- [ ] Confirm tap input works for direction changes
- [ ] Verify audio plays (Tone.js synthesized sounds)
- [ ] Test all five sky phases render (Dawn, Day, Golden Hour, Twilight, Night)
- [ ] Verify obstacles appear at correct altitude thresholds
- [ ] Test pause functionality
- [ ] Check portrait orientation lock behaves correctly
- [ ] Verify no console errors in DevTools

### PWA Verification (~5 min)

- [ ] Open the preview URL in Chrome
- [ ] Verify the web app manifest loads (DevTools > Application > Manifest)
- [ ] Confirm service worker registers (DevTools > Application > Service Workers)
- [ ] Check that all required icon sizes are present in the manifest
- [ ] Test "Install" prompt appears (or "Add to Home Screen" on mobile)
- [ ] Install as PWA and verify it launches correctly
- [ ] Verify offline mode works after initial load (if applicable)

### Capacitor Sync (~5 min)

- [ ] Run `npx cap sync` to copy web assets to native projects
- [ ] Verify no sync errors in the output
- [ ] Check that `ios/App/App/public/` contains the built web assets
- [ ] Check that `android/app/src/main/assets/public/` contains the built web assets

### Asset Verification (~5 min)

- [ ] Verify app icons exist for all required sizes (see Task #8 output)
- [ ] Verify splash screens exist for both platforms (see Task #9 output)
- [ ] Verify privacy policy is accessible at its hosted URL (see Task #11 output)
- [ ] Verify store metadata document is complete (see Task #10 output)

---

## 3. Web Deployment (Cloudflare Pages)

### First-Time Setup (~20 min)

- [ ] Log in to Cloudflare dashboard: https://dash.cloudflare.com
- [ ] Go to **Workers & Pages** > **Create** > **Pages**
- [ ] Connect your GitHub repository
  - Authorize Cloudflare to access your GitHub account
  - Select the `Updraft` repository
- [ ] Configure build settings:
  - **Production branch**: `main`
  - **Build command**: `npm run build`
  - **Build output directory**: `dist`
  - **Node.js version**: Set environment variable `NODE_VERSION` to `18` (or higher)
- [ ] Click **Save and Deploy**
- [ ] Wait for the first build to complete (~2-3 min)
- [ ] Note your `*.pages.dev` URL (e.g., `updraft.pages.dev`)

**Reference**: https://developers.cloudflare.com/pages/get-started/guide/

### Custom Domain Setup (~15 min, optional)

- [ ] In Cloudflare Pages project settings, go to **Custom domains**
- [ ] Click **Set up a custom domain**
- [ ] Enter your domain (e.g., `playupdraft.com`)
- [ ] If the domain is on Cloudflare DNS, the CNAME record is added automatically
- [ ] If using external DNS, add a CNAME record pointing to `updraft.pages.dev`
- [ ] Wait for SSL certificate provisioning (usually <5 min)
- [ ] Verify the site loads at your custom domain with HTTPS

### Deployment Verification (~10 min)

- [ ] Open the deployed URL in a desktop browser
- [ ] Open the deployed URL on a real mobile device (iPhone and Android)
- [ ] Verify the game loads and is playable end-to-end
- [ ] Check that all assets load (no 404s in the Network tab)
- [ ] Verify HTTPS is working (green lock icon)
- [ ] Test the PWA install flow on mobile
- [ ] Check response headers include proper caching and compression
- [ ] Verify analytics are reporting (if analytics were added)

### Subsequent Deployments

- [ ] Push to `main` branch — Cloudflare Pages auto-deploys
- [ ] Monitor the build in the Cloudflare dashboard
- [ ] Verify the new version is live by checking the site
- [ ] Cloudflare Pages keeps previous deployments — you can roll back via the dashboard

---

## 4. iOS Release (App Store)

### Code Signing Setup (~30 min, first time only)

- [ ] Open Xcode and go to **Preferences** > **Accounts**
- [ ] Add your Apple ID (the one enrolled in the Developer Program)
- [ ] Open the Updraft iOS project: `open ios/App/App.xcworkspace`
- [ ] Select the **App** target in the project navigator
- [ ] Go to **Signing & Capabilities** tab
- [ ] Check **Automatically manage signing**
- [ ] Select your **Team** (your Apple Developer account)
- [ ] Verify the **Bundle Identifier** is `com.updraft.game`
- [ ] Xcode will automatically create a provisioning profile and signing certificate
- [ ] If automatic signing fails, manually create certificates at https://developer.apple.com/account/resources/certificates/list

**Reference**: https://developer.apple.com/documentation/xcode/distributing-your-app-for-beta-testing-and-releases

### Build Settings (~10 min)

- [ ] In Xcode, select the **App** target
- [ ] Set **General** tab values:
  - **Display Name**: `Updraft`
  - **Bundle Identifier**: `com.updraft.game`
  - **Version**: `1.0.0`
  - **Build**: `1` (increment for each submission)
  - **Deployment Target**: iOS 16.0 (minimum)
- [ ] Set **Orientation** to **Portrait** only (uncheck Landscape Left and Landscape Right)
- [ ] Verify **App Icons** are set (check Assets.xcassets > AppIcon)
- [ ] Verify **Launch Screen** / splash screen is configured
- [ ] Under **Signing & Capabilities**, verify no errors

### App Store Connect Setup (~30 min)

- [ ] Go to https://appstoreconnect.apple.com
- [ ] Click **My Apps** > **+** > **New App**
- [ ] Fill in the required fields:
  - **Platforms**: iOS
  - **Name**: `Updraft`
  - **Primary Language**: English (U.S.)
  - **Bundle ID**: `com.updraft.game` (select from dropdown)
  - **SKU**: `updraft-game-001`
  - **User Access**: Full Access
- [ ] Click **Create**

### Store Listing (~45 min)

Use the store metadata document (from Task #10) for copy. Fill in all fields:

- [ ] **Subtitle** (30 chars max): brief tagline
- [ ] **Description** (4000 chars max): full description
- [ ] **Keywords** (100 chars max, comma-separated)
- [ ] **What's New**: describe features for this version
- [ ] **Promotional Text** (170 chars max): can be updated without new build
- [ ] **Support URL**: link to your website or GitHub
- [ ] **Marketing URL** (optional)
- [ ] **Privacy Policy URL**: link to hosted privacy policy (from Task #11)
- [ ] **Category**: Games > Casual
- [ ] **Content Rating**: fill out the questionnaire (likely rated 4+ with no objectionable content)

### Screenshots (~30 min)

Upload screenshots for each required device size. Minimum sets:

- [ ] **6.7" Display** (iPhone 15 Pro Max): 1290 x 2796 px — at least 3 screenshots
- [ ] **6.5" Display** (iPhone 15 Plus / older): 1284 x 2778 px — at least 3 screenshots
- [ ] **5.5" Display** (iPhone 8 Plus): 1242 x 2208 px — at least 3 screenshots (optional but recommended)
- [ ] **iPad Pro 12.9"** (6th gen): 2048 x 2732 px — at least 3 (if supporting iPad)

Each screenshot should show:
1. Title screen
2. Gameplay at dawn phase
3. Gameplay at a later sky phase (showing obstacles)
4. Game over / score screen
5. (Optional) Mid-game action showing wind currents and streak

**Reference**: https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications

### App Privacy (~10 min)

- [ ] In App Store Connect, go to **App Privacy**
- [ ] Answer the questionnaire about data collection
- [ ] If no data is collected (no analytics, no accounts), select "No" for all categories
- [ ] If analytics are added, declare the appropriate data types (device identifiers, usage data)
- [ ] Submit privacy responses

**Reference**: https://developer.apple.com/app-store/app-privacy-details/

### Build and Upload (~20 min)

- [ ] Ensure latest web assets are synced: `npm run build && npx cap sync ios`
- [ ] Open Xcode: `open ios/App/App.xcworkspace`
- [ ] Select **Any iOS Device (arm64)** as the build target (not a simulator)
- [ ] Select **Product** > **Archive** from the menu bar
- [ ] Wait for the archive to build (2-5 min)
- [ ] When the Organizer window opens, select your archive
- [ ] Click **Distribute App**
- [ ] Select **App Store Connect** > **Upload**
- [ ] Follow the prompts (keep defaults unless you have specific needs)
- [ ] Wait for the upload to complete (2-5 min)
- [ ] In App Store Connect, wait for the build to finish processing (10-30 min)
- [ ] The build will appear under **TestFlight** and **App Store** tabs once processed

### TestFlight Testing (~30 min)

- [ ] In App Store Connect, go to **TestFlight**
- [ ] Select the newly uploaded build
- [ ] Fill out the **Test Information** (What to Test, email, etc.)
- [ ] Add internal testers (your own account at minimum)
- [ ] Install via TestFlight app on a real device
- [ ] Verify complete game flow on device
- [ ] Test audio output through speaker and headphones
- [ ] Verify portrait lock works
- [ ] Check safe area / notch handling
- [ ] Test with different iOS versions if possible (16, 17, 18)
- [ ] Confirm no crashes (check Xcode Organizer > Crashes)

### Submit for Review (~10 min)

- [ ] In App Store Connect, go to the **App Store** tab
- [ ] Select the build you want to submit
- [ ] Verify all store listing fields are complete (no warnings)
- [ ] Set **Release Method**:
  - **Manually release** (recommended for first release — you control when it goes live)
  - or **Automatically release** after approval
- [ ] Click **Submit for Review**
- [ ] Review typically takes 24-48 hours (can be faster or slower)
- [ ] Monitor your email and App Store Connect for status updates

**Review outcomes**:
- **Approved**: proceed to release (manual) or it goes live automatically
- **Rejected**: read the rejection reason, fix the issues, re-upload, and resubmit
  - Common rejection reasons: crashes, broken links, missing privacy policy, misleading metadata

**Reference**: https://developer.apple.com/app-store/review/guidelines/

### Release (~5 min)

- [ ] If manual release: go to App Store Connect and click **Release This Version**
- [ ] The app typically appears in the App Store within 24 hours
- [ ] Verify the app is searchable and downloadable from the App Store

---

## 5. Android Release (Google Play)

### Signing Setup (~20 min, first time only)

Generate a release signing key:

```bash
keytool -genkey -v -keystore updraft-release.keystore \
  -alias updraft -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass YOUR_STORE_PASSWORD \
  -keypass YOUR_KEY_PASSWORD \
  -dname "CN=Updraft, OU=Games, O=Your Company, L=Your City, ST=Your State, C=US"
```

- [ ] Generate the keystore file (keep it safe — you cannot recover it)
- [ ] **Back up the keystore file** to a secure location (cloud storage, password manager)
- [ ] **Record the passwords** in a password manager
- [ ] Create `android/keystore.properties` (DO NOT commit to git):
  ```properties
  storeFile=../../updraft-release.keystore
  storePassword=YOUR_STORE_PASSWORD
  keyAlias=updraft
  keyPassword=YOUR_KEY_PASSWORD
  ```
- [ ] Verify `keystore.properties` and `*.keystore` are in `.gitignore`
- [ ] Configure `android/app/build.gradle` to use the keystore for release builds

**Reference**: https://developer.android.com/studio/publish/app-signing

### Google Play App Signing (~10 min)

- [ ] In Google Play Console, go to your app > **Setup** > **App signing**
- [ ] Choose **Use Google-managed key** (recommended) or upload your own
- [ ] If using Google-managed key, upload your **upload key** (the keystore you generated)
- [ ] Google will manage the actual signing key for distribution

**Reference**: https://support.google.com/googleplay/android-developer/answer/9842756

### Build Settings (~10 min)

- [ ] Open `android/app/build.gradle`
- [ ] Verify `applicationId` is `com.updraft.game`
- [ ] Set `versionCode` to `1` (increment for each upload)
- [ ] Set `versionName` to `"1.0.0"`
- [ ] Set `minSdkVersion` to `24` (Android 7.0)
- [ ] Set `targetSdkVersion` to `34` (Android 14)
- [ ] Verify screen orientation is locked to portrait in `AndroidManifest.xml`:
  ```xml
  android:screenOrientation="portrait"
  ```

### Google Play Console Setup (~30 min)

- [ ] Go to https://play.google.com/console
- [ ] Click **Create app**
- [ ] Fill in:
  - **App name**: `Updraft`
  - **Default language**: English (United States)
  - **App or game**: Game
  - **Free or paid**: Free
- [ ] Accept the declarations (Developer Program Policies, US export laws)
- [ ] Click **Create app**

### Store Listing (~45 min)

- [ ] Go to **Grow** > **Store presence** > **Main store listing**
- [ ] Fill in all fields using the store metadata document (Task #10):
  - **Short description** (80 chars max)
  - **Full description** (4000 chars max)
- [ ] Upload **Screenshots** (minimum 2, recommended 5-8):
  - Phone: at least 2 screenshots, 16:9 or 9:16 aspect ratio
  - 7-inch tablet (optional but recommended)
  - 10-inch tablet (optional but recommended)
  - Minimum dimension: 320px, maximum: 3840px
- [ ] Upload **Feature Graphic**: 1024 x 500 px (required)
- [ ] Upload **App Icon**: 512 x 512 px (required, must match in-app icon)
- [ ] Set **Application type**: Game
- [ ] Set **Category**: Casual
- [ ] Add **Tags**: relevant search tags
- [ ] **Contact details**:
  - Email (required)
  - Phone (optional)
  - Website (optional)

**Reference**: https://support.google.com/googleplay/android-developer/answer/9859455

### Content Rating (~10 min)

- [ ] Go to **Policy** > **App content** > **Content rating**
- [ ] Click **Start questionnaire**
- [ ] Select category: **All Other App Types** or **Game**
- [ ] Answer questions truthfully (Updraft has no violence, no user-generated content, no purchases)
- [ ] Expected rating: **ESRB Everyone** / **PEGI 3** / **USK 0**
- [ ] Submit the questionnaire

### Privacy and Data Safety (~15 min)

- [ ] Go to **Policy** > **App content** > **Data safety**
- [ ] Fill out the data safety form:
  - Does the app collect or share user data? (depends on analytics setup)
  - If no analytics: select that no data is collected
  - If analytics are present: declare device identifiers, usage data, diagnostics
- [ ] Add **Privacy Policy URL** (from Task #11)
- [ ] Submit the data safety form

### Build and Upload (~15 min)

- [ ] Sync web assets: `npm run build && npx cap sync android`
- [ ] Build a release AAB (Android App Bundle):
  ```bash
  cd android
  ./gradlew bundleRelease
  ```
- [ ] The AAB file will be at `android/app/build/outputs/bundle/release/app-release.aab`
- [ ] Alternatively, build from Android Studio: **Build** > **Generate Signed Bundle / APK**
  - Select **Android App Bundle**
  - Choose your keystore and enter passwords
  - Select **release** build variant
  - Click **Finish**
- [ ] In Google Play Console, go to **Release** > **Production** (or **Internal testing** first)
- [ ] Click **Create new release**
- [ ] Upload the `.aab` file
- [ ] Add **Release notes** (What's new in this version)
- [ ] Click **Review release**

### Testing Tracks (~20 min)

Recommended: use testing tracks before production.

- [ ] **Internal testing** (up to 100 testers):
  - Go to **Release** > **Testing** > **Internal testing**
  - Create a release and upload the AAB
  - Add testers by email
  - Share the opt-in link with testers
  - Testers install via the Play Store link
- [ ] Test on real Android devices:
  - Verify game loads and plays correctly
  - Test audio output
  - Verify portrait lock
  - Check different screen sizes and Android versions
  - Confirm no crashes (check Play Console > Android Vitals)
- [ ] **Closed testing** (optional, larger group)
- [ ] **Open testing** (optional, public beta)

### Submit for Review (~10 min)

- [ ] Ensure all **store listing** fields are complete (no warnings in dashboard)
- [ ] Ensure **content rating** questionnaire is submitted
- [ ] Ensure **data safety** form is submitted
- [ ] Ensure **app content** declarations are complete:
  - Ads declaration
  - Target audience and content
  - News app declaration
  - COVID-19 app declaration (if applicable)
  - Government apps declaration
- [ ] Go to **Release** > **Production**
- [ ] Create a release, upload the AAB, add release notes
- [ ] Click **Start rollout to Production**
- [ ] Choose rollout percentage (100% or staged: 10% -> 50% -> 100%)
- [ ] Review typically takes 1-7 days for first submission (subsequent reviews are faster)

**Review outcomes**:
- **Approved**: the app goes live automatically (or at your staged rollout percentage)
- **Rejected**: read the rejection reason in the Play Console email, fix issues, re-upload

**Reference**: https://support.google.com/googleplay/android-developer/answer/9859348

### Release (~5 min)

- [ ] If staged rollout, monitor crash reports and reviews at each stage
- [ ] Increase rollout percentage as confidence grows
- [ ] Verify the app is searchable and installable from the Play Store

---

## 6. Post-Launch Monitoring

### Day 1 Checks (~30 min)

- [ ] **Web**: verify site is live and responsive at your URL
- [ ] **iOS**: verify app appears in App Store search for "Updraft"
- [ ] **Android**: verify app appears in Play Store search for "Updraft"
- [ ] Check analytics dashboard for first sessions (if analytics added)
- [ ] Monitor crash reports:
  - iOS: Xcode Organizer > Crashes, or App Store Connect > Analytics
  - Android: Google Play Console > Android Vitals > Crashes & ANRs
  - Web: browser console errors via analytics
- [ ] Check app reviews and ratings
- [ ] Verify in-app audio works across devices

### Week 1 Checks (~15 min/day)

- [ ] Monitor daily active users and session counts
- [ ] Review any crash reports and triage fixes
- [ ] Respond to user reviews (both stores)
- [ ] Check Core Web Vitals for the web version (Cloudflare Analytics or Google Search Console)
- [ ] Verify CDN caching is working correctly (Cloudflare dashboard)

### Ongoing Monitoring

- [ ] Set up crash alerting (Firebase Crashlytics or Sentry, optional)
- [ ] Monitor app store ratings weekly
- [ ] Check for OS compatibility issues after major iOS/Android releases
- [ ] Review Cloudflare Pages bandwidth usage

---

## 7. Rollback Procedures

### Web (Cloudflare Pages)

1. Go to **Cloudflare Dashboard** > **Workers & Pages** > **Updraft**
2. Go to the **Deployments** tab
3. Find the last known good deployment
4. Click the three-dot menu > **Rollback to this deployment**
5. The rollback is instant — verify the site

### iOS (App Store)

- You **cannot** roll back an App Store release. Options:
  1. **Remove from sale**: App Store Connect > Pricing and Availability > uncheck all territories
  2. **Submit a hotfix**: fix the issue, increment the build number, re-upload, and request expedited review
  - Expedited review: https://developer.apple.com/contact/app-store/?topic=expedite

### Android (Google Play)

- [ ] **Halt staged rollout**: Play Console > Release > Production > **Halt rollout**
- [ ] **Roll back**: If you used staged rollout, users who haven't updated keep the old version
- [ ] **Submit a hotfix**: fix the issue, increment versionCode, upload new AAB, and release
- [ ] For emergencies: **Unpublish** the app (Play Console > Setup > Advanced settings)

---

## Quick Reference: Version Bumping

For each new release, update these version numbers:

| Location | Field | Example |
|---|---|---|
| `package.json` | `version` | `"1.1.0"` |
| Xcode (App target > General) | Version | `1.1.0` |
| Xcode (App target > General) | Build | `2` (always increment) |
| `android/app/build.gradle` | `versionName` | `"1.1.0"` |
| `android/app/build.gradle` | `versionCode` | `2` (always increment) |

Keep version numbers in sync across all platforms.

---

## Quick Reference: Full Release Commands

```bash
# 1. Build web assets
npm run build

# 2. Sync to native platforms
npx cap sync

# 3. Open iOS project in Xcode
npx cap open ios
# Then: Product > Archive > Distribute App > App Store Connect

# 4. Build Android release
cd android && ./gradlew bundleRelease
# Upload android/app/build/outputs/bundle/release/app-release.aab to Play Console

# 5. Deploy web (automatic on push to main via Cloudflare Pages)
git push origin main
```

---

## Estimated Total Time

| Phase | First Release | Subsequent Releases |
|---|---|---|
| Account setup | 2-3 hours (one-time) | N/A |
| Pre-release verification | 30 min | 30 min |
| Web deployment | 30 min | 5 min (auto-deploy) |
| iOS build + upload | 30 min | 20 min |
| iOS store listing | 45 min | 10 min (just What's New) |
| iOS review wait | 24-48 hours | 24-48 hours |
| Android build + upload | 25 min | 15 min |
| Android store listing | 45 min | 10 min (just release notes) |
| Android review wait | 1-7 days | 1-3 days |
| Post-launch monitoring | 30 min/day for week 1 | 15 min/day |

**Total active work (first release)**: ~5-6 hours
**Total active work (subsequent releases)**: ~1.5-2 hours
**Total calendar time (first release)**: 3-10 days (dominated by review times)
