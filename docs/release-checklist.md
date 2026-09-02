# Release checklist

Updated: 2026-09-03

This document separates source readiness, signed-build verification, public
distribution, and app-store submission. Passing repository checks is not proof
that a new binary has been installed on physical devices or accepted by a store.

## Current distribution status

- Android: a public preview APK is distributed from `persimmon.cc` through a
  stable Cloudflare R2 URL.
- GitHub: future Android releases belong to `chihumyum/Persimmon`; the website
  repository is not an application release repository.
- iOS: Persimmon Reader is live on the App Store
  (https://apps.apple.com/us/app/persimmon-reader/id6800041021, App Store
  Connect app `6800041021`). New builds ship through `pnpm release:ios`,
  Transporter, and App Review.
- Google Play: no public listing is claimed.

## Source gate

Before creating a production build:

- [ ] The worktree is clean and `HEAD` matches its upstream branch.
- [ ] The public page-turn submodule is initialized at the recorded gitlink.
- [ ] `pnpm install --frozen-lockfile` succeeds with Node 22.23.1 and pnpm
      10.17.1.
- [ ] `pnpm verify` passes, including Expo Doctor and iOS/Android production
      JavaScript bundles.
- [ ] Gitleaks reports no unexplained findings.
- [ ] Production dependency advisories have been reviewed; unresolved build tool
      findings are recorded with their reachability and upstream status.
- [ ] No APK, IPA, signing material, private EPUB, or generated CNG project is
      tracked.

## Application identity

- Bundle ID and Android application ID: `dev.chihum.persimmon`.
- User-visible version: `0.1.1` until an intentional version change is made.
- Apple development team default: `G7ZSY874L2`.
- Public support address: `support@persimmon.cc`.
- Android public releases must target SDK 36 and carry the recorded production
  signing certificate.

## Android build and publication

1. Review release notes and the exact `main` commit that will be tagged.
2. Manually dispatch the Android build-and-publish workflow from `main` in the
   `production` environment. Leave the EAS build ID blank to create a new
   `production-apk` build; provide a finished build ID only when recovering a
   failed publication for the same source commit.
3. The workflow waits for EAS, verifies that the build belongs to the workflow
   commit, and checks the package name, version, target SDK, APK v2 signature,
   production certificate, and SHA-256.
4. The workflow creates a draft GitHub Release, uploads the versioned APK and
   checksum, downloads and verifies them, updates and verifies stable R2 for a
   stable release, then publishes the GitHub Release.
5. For a prerelease, confirm that the stable R2 APK and checksum did not change.
6. Install the downloaded GitHub artifact on a physical device and exercise
   import, reading, relaunch persistence, export, and Google Drive if OAuth is
   available to that build.

For a local preflight or an unusual recovery, `pnpm release:android` still
downloads a signed build and `pnpm publish:android:apk -- --dry-run <apk>`
verifies it without changing GitHub or R2.

Never recreate a historical GitHub Release unless its artifact, tag, source
commit, signing certificate, and checksum can all be proven to match.

## iOS build and submission

1. `pnpm release:ios` requests a production EAS build for the clean, pushed
   `main` commit and downloads the IPA and its SHA-256 to `dist/ios/`. EAS
   manages the build number remotely; the user-visible version comes from
   `apps/persimmon/app.json` and must be raised before any submission that
   follows a released version.
2. Upload the IPA with Transporter, attach the build to the matching version
   record in App Store Connect, and submit it for review.
3. Distribution credentials, provisioning, and the App Store Connect record
   already exist. App Review still expects current agreements, privacy metadata,
   screenshots, review information, and a physical-device acceptance pass for
   the exact archive.

## Google Drive boundary

The app requests only `https://www.googleapis.com/auth/drive.appdata` for its
private application data folder. A signed build must still be covered by the
correct iOS client ID or Android package/signing SHA-1, and the Google Auth app
must be in a publishing state that permits the intended user.

Verify on two devices before describing sync as release-accepted:

- [ ] Connect the same Google account on both devices.
- [ ] Upload and recover an EPUB.
- [ ] Converge reading progress in both directions.
- [ ] Confirm deletion and local/Drive clearing remain distinct.
- [ ] Relaunch after offline and foreground/background transitions.

## Store work not implied by APK publication

App Store and Google Play submission require their own identity, policy,
screenshots, content rating, privacy disclosures, review credentials, and signed
store artifact. A public source repository or direct APK does not satisfy those
requirements.

## Native project boundary

`apps/persimmon/ios` and `apps/persimmon/android` are generated by Expo CNG and
are not committed. Native dependency or configuration changes must be checked
through a clean prebuild and an exact signed artifact; static TypeScript checks
alone are insufficient.
