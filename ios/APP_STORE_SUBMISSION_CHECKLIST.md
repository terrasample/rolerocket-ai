# RoleRocketAI Apple Store Submission Checklist

This project is prepped locally for iOS metadata and versioning.

## What is already set in code

- App display name: RoleRocketAI
- Bundle ID: com.rolerocket.ai
- iOS deployment target: 15.0
- Version/build: 1.0.1 (2)
- Export compliance key: ITSAppUsesNonExemptEncryption = false
- App icon asset exists (1024x1024)

## What you still need from Apple (required)

1. Enroll in Apple Developer Program (paid account).
2. Create App Store Connect app listing with:
- Name: RoleRocketAI
- Primary language
- Bundle ID: com.rolerocket.ai
- SKU (your internal ID)
3. In Apple Developer portal:
- Create iOS App ID for com.rolerocket.ai
- Create signing certificate
- Create provisioning profile (App Store)

## Xcode setup once account is active

1. Install full Xcode from App Store.
2. Set active developer directory:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
xcodebuild -version
```

3. Open ios/App/App.xcodeproj.
4. In Signing & Capabilities:
- Select your Team
- Keep Automatically manage signing enabled
- Confirm Bundle Identifier is com.rolerocket.ai

## Build and upload

1. Product > Archive
2. Validate App
3. Distribute App > App Store Connect > Upload

## App Store Connect completion

1. Add app description, keywords, support URL, privacy policy URL.
2. Add screenshots for required iPhone sizes.
3. Complete App Privacy questionnaire.
4. Set age rating and content rights.
5. Select uploaded build and submit for review.

## Searchability note

Users can only search for RoleRocketAI in the Apple App Store after:
- Apple approves the app
- The app is released to the store (manual or automatic release)
- Store indexing completes (can take a short time)
