# PromptRoot Forking & Deployment Guide

This comprehensive guide will walk you through every step needed to fork PromptRoot and deploy your own instance. Whether you want to run it with Firebase backend or use Docker for offline development, this guide has you covered.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Fork & Clone the Repository](#fork--clone-the-repository)
3. [Choose Your Path](#choose-your-path)
   - [Path A: Docker Setup (Offline/Local Development)](#path-a-docker-setup-offlinelocal-development)
   - [Path B: Firebase Backend Setup (Full Production)](#path-b-firebase-backend-setup-full-production)
4. [GitHub OAuth Setup](#github-oauth-setup)
5. [Firebase Configuration](#firebase-configuration)
6. [Local Development](#local-development)
7. [Deployment](#deployment)
8. [Post-Deployment Configuration](#post-deployment-configuration)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisites

Before you begin, ensure you have the following:

### Required Accounts
- **GitHub Account** - For forking the repository and OAuth
- **Google Account** - Required for Firebase (if using Path B)
- **Credit Card** - Required for Firebase Blaze Plan (Storage needs this, even if you stay in free tier)

### Required Software

#### For All Users:
```bash
# Node.js (v18 or later recommended, v22 for Functions)
node --version  # Should output v18.x.x or higher
npm --version   # Should output 9.x.x or higher

# Git
git --version   # Should output 2.x.x or higher
```

**Install Node.js:** https://nodejs.org/en/download/
**Install Git:** https://git-scm.com/downloads

#### For Docker Users (Path A):
```bash
# Docker Desktop
docker --version          # Should output 20.x.x or higher
docker-compose --version  # Should output 2.x.x or higher
```

**Install Docker Desktop:** https://www.docker.com/products/docker-desktop/

#### For Firebase Users (Path B):
```bash
# Firebase CLI
npm install -g firebase-tools
firebase --version  # Should output 13.x.x or higher

# Google Cloud SDK (optional, for advanced operations)
gcloud --version
```

**Install Firebase CLI:** Already included above
**Install gcloud CLI:** https://cloud.google.com/sdk/docs/install

---

## Fork & Clone the Repository

### Step 1: Fork on GitHub

1. Go to https://github.com/promptroot/promptroot
2. Click the **Fork** button in the top-right corner
3. Choose your account as the destination
4. Wait for GitHub to create your fork (this takes ~30 seconds)

### Step 2: Clone Your Fork

```bash
# Navigate to where you want the project
cd ~/projects  # or C:\Users\YourName\projects on Windows

# Clone your fork (replace YOUR_USERNAME with your GitHub username)
git clone https://github.com/YOUR_USERNAME/promptroot.git

# Navigate into the project
cd promptroot

# Add upstream remote (to pull updates from original repo)
git remote add upstream https://github.com/promptroot/promptroot.git

# Verify remotes
git remote -v
# Should show:
# origin    https://github.com/YOUR_USERNAME/promptroot.git (fetch)
# origin    https://github.com/YOUR_USERNAME/promptroot.git (push)
# upstream  https://github.com/JesseWarrenDevelopment/promptroot.git (fetch)
# upstream  https://github.com/JesseWarrenDevelopment/promptroot.git (push)
```

---

## Choose Your Path

You have two options for running PromptRoot:

### Path A: Docker Setup (Offline/Local Development)

**✅ Choose this if:**
- You want to develop offline
- You don't want to set up Firebase
- You only need local development without cloud deployment
- You want a quick start

**🔗 Jump to:** [Docker Setup Instructions](#path-a-docker-setup-offlinelocal-development-detailed)

### Path B: Firebase Backend Setup (Full Production)

**✅ Choose this if:**
- You want to deploy to production
- You need cloud storage and authentication
- You want to host at a custom domain
- You want the full feature set

**🔗 Jump to:** [Firebase Setup Instructions](#path-b-firebase-backend-setup-full-production-detailed)

---

## Path A: Docker Setup (Offline/Local Development) {#path-a-docker-setup-offlinelocal-development-detailed}

Docker provides a self-contained environment with Firebase Emulators, so you can develop entirely offline.

### Step 1: Verify Docker Installation

```bash
# Check Docker is running
docker ps
# Should show empty list or running containers (not an error)

# Check Docker Compose
docker-compose --version
# Should show version 2.x.x or higher
```

If Docker is not running, start Docker Desktop from your Applications/Start Menu.

### Step 2: Build the Docker Container

```bash
# From the project root directory
docker-compose build

# This will take 5-10 minutes on first build
# It installs Node.js, Firebase tools, and all dependencies
```

### Step 3: Start the Development Environment

```bash
# Start all services (Firebase Emulators + Web Server)
docker-compose up

# You should see output like:
# ✔  All emulators ready! View status and logs at http://localhost:4000
# 
# Firebase Emulators running at:
# ┌──────────────┬────────────────┬─────────────────────────────────┐
# │ Emulator     │ Host:Port      │ View in Emulator Suite          │
# ├──────────────┼────────────────┼─────────────────────────────────┤
# │ Auth         │ localhost:9099 │ http://localhost:4000/auth      │
# │ Functions    │ localhost:5001 │ http://localhost:4000/functions │
# │ Firestore    │ localhost:8080 │ http://localhost:4000/firestore │
# │ Storage      │ localhost:9199 │ http://localhost:4000/storage   │
# │ Hosting      │ localhost:5000 │ n/a                             │
# └──────────────┴────────────────┴─────────────────────────────────┘

# Web app available at: http://localhost:5000
```

### Step 4: Access the Application

1. **Web App:** Open http://localhost:5000 in your browser
2. **Emulator UI:** Open http://localhost:4000 to view Firebase data
3. **Authentication:** Sign in with any email/password (emulator accepts anything)

### Step 5: Develop with Hot Reload

The Docker setup includes:
- **Live reload** - Changes to HTML/CSS/JS are automatically reflected
- **Persistent data** - Emulator data saved in `emulator-data/` directory
- **Isolated environment** - Won't interfere with any cloud services

### Step 6: Stop the Environment

```bash
# Press Ctrl+C in the terminal where docker-compose is running
# Or in another terminal:
docker-compose down

# To remove all data and start fresh:
docker-compose down -v
rm -rf emulator-data/
```

### Docker Development Notes

- **Firestore Data:** Inspect/modify data at http://localhost:4000/firestore
- **Storage Files:** View uploaded files at http://localhost:4000/storage
- **Function Logs:** Check function execution at http://localhost:4000/functions
- **Data Persistence:** Data survives container restarts (stored in `emulator-data/`)
- **Reset Data:** Stop container and delete `emulator-data/` directory

**Docker Setup Complete!** You can now develop offline. Skip to [Local Development](#local-development) for workflow tips.

---

## Path B: Firebase Backend Setup (Full Production) {#path-b-firebase-backend-setup-full-production-detailed}

This section covers the complete Firebase setup process we performed during the migration.

### Part 1: Firebase Project Creation

#### Step 1.1: Access Firebase Console

1. Go to https://console.firebase.google.com/
2. Sign in with your Google Account
3. Accept Terms of Service if prompted

#### Step 1.2: Create New Project

1. Click **"Add project"** or **"Create a project"**
2. **Project name:** Enter a descriptive name (e.g., `my-promptroot`)
   - This name is for display only
   - Firebase will generate a unique project ID (e.g., `my-promptroot-a1b2c`)
3. Click **"Continue"**
4. **Google Analytics:** Toggle OFF (not needed, simplifies setup)
   - If you want analytics, leave it ON and follow the prompts
5. Click **"Create project"**
6. Wait 30-60 seconds for project creation
7. Click **"Continue"** when ready

**🎯 You now have an empty Firebase project!**

#### Step 1.3: Record Your Project ID

On the Project Overview page:
1. Click the **gear icon** (⚙️) next to "Project Overview"
2. Select **"Project settings"**
3. Note your **Project ID** (e.g., `my-promptroot-a1b2c`)
   - You'll need this for configuration

---

### Part 2: Firebase Service Setup

#### Step 2.1: Enable Firebase Authentication

1. In left sidebar, click **"Authentication"**
2. Click **"Get started"** button
3. You'll see the "Sign-in method" tab

**GitHub Provider Setup** (we'll get credentials later):
1. Click **"GitHub"** in the provider list
2. Toggle **"Enable"** to ON
3. **DON'T CLICK SAVE YET** - you need GitHub OAuth credentials first
4. Leave this tab open, we'll return after creating GitHub OAuth apps

#### Step 2.2: Enable Cloud Firestore Database

1. In left sidebar, click **"Firestore Database"**
2. Click **"Create database"** button
3. **Location:** Choose the region closest to your users
   - `us-central` (Iowa) - Good for North America
   - `europe-west1` (Belgium) - Good for Europe
   - `asia-northeast1` (Tokyo) - Good for Asia
   - ⚠️ **CANNOT BE CHANGED LATER**
4. Click **"Next"**
5. **Security rules:** Select **"Start in production mode"**
   - We'll deploy proper rules from code later
6. Click **"Enable"**
7. Wait 1-2 minutes for database creation

**✅ Firestore is now enabled!**

#### Step 2.3: Enable Cloud Storage

⚠️ **CREDIT CARD REQUIRED**: Storage requires Firebase Blaze (pay-as-you-go) plan.

**Upgrade to Blaze Plan:**
1. In the top-left, click your project name dropdown
2. Click **"Upgrade"** or the **upgrade icon**
3. Select **"Blaze Plan"**
4. Click **"Purchase"** or **"Continue"**
5. Enter credit card information
6. **Budget Alert** (recommended): Set a monthly budget alert (e.g., $10)
   - This prevents surprise charges
   - Free tier includes: 1GB storage, 10GB/month transfer, 50K reads/day
7. Confirm the upgrade

**Enable Storage:**
1. In left sidebar, click **"Storage"**
2. Click **"Get started"** button
3. **Security rules:** Click **"Next"** (we'll deploy rules from code)
4. **Location:** Use the same region you chose for Firestore
5. Click **"Done"**
6. Wait 30 seconds for storage bucket creation

**✅ Storage is now enabled!**

#### Step 2.4: Enable Cloud Functions

1. In left sidebar, click **"Functions"**
2. Click **"Get started"** button
3. Click **"Continue"** if prompted about the Blaze plan
4. You'll see an empty functions list

**✅ Functions are ready!** (We'll deploy them from code later)

#### Step 2.5: Enable Firebase Hosting

1. In left sidebar, click **"Hosting"**
2. Click **"Get started"** button
3. Click through the tutorial (or click **"Finish"** to skip)
4. You'll see an empty sites list

**✅ Hosting is ready!** (We'll deploy from code later)

---

### Part 3: Register Web App & Get Configuration

#### Step 3.1: Register Web App

1. Go back to **Project Overview** (click Firebase logo)
2. Click the **"Web"** icon (`</>`) to add a web app
3. **App nickname:** Enter a name (e.g., `PromptRoot Web`)
4. **Firebase Hosting:** Check this box (✅)
5. Click **"Register app"**
6. Wait for registration to complete

#### Step 3.2: Copy Firebase Configuration

You'll see a code snippet with your Firebase config:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxX",
  authDomain: "my-promptroot-a1b2c.firebaseapp.com",
  projectId: "my-promptroot-a1b2c",
  storageBucket: "my-promptroot-a1b2c.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890abcdef"
};
```

**COPY THIS ENTIRE OBJECT** - you'll need it in the next section.

Click **"Continue to console"** when done.

---

## GitHub OAuth Setup

PromptRoot uses **TWO separate GitHub OAuth apps**:
1. **Web App Authentication** - For signing into the website
2. **Browser Extension** - For syncing prompts with GitHub repos

### Part 4: Create GitHub OAuth Apps

#### Step 4.1: Create Web App OAuth App

1. Go to https://github.com/settings/developers
2. Click **"OAuth Apps"** in left sidebar
3. Click **"New OAuth App"** button
4. Fill out the form:

   **Application name:** `PromptRoot Web` (or your fork name)
   
   **Homepage URL:** 
   ```
   https://YOUR_PROJECT_ID.web.app
   ```
   Replace `YOUR_PROJECT_ID` with your Firebase project ID (e.g., `my-promptroot-a1b2c.web.app`)
   
   **Application description:** (optional)
   ```
   PromptRoot web application authentication
   ```
   
   **Authorization callback URL:**
   ```
   https://YOUR_PROJECT_ID.firebaseapp.com/__/auth/handler
   ```
   ⚠️ **CRITICAL**: Replace `YOUR_PROJECT_ID` and keep the exact path `/__/auth/handler`
   
5. Click **"Register application"**

**Record Credentials:**
1. You'll see your **Client ID** (e.g., `Ov23liAg1J4KCbE1HaDD`)
   - Copy this - you need it for Firebase Authentication
2. Click **"Generate a new client secret"**
3. Copy the **Client secret** (e.g., `60c4d016fca0d2ad316b83a1a8c05ddc8af86b3b`)
   - ⚠️ **You can only see this once!** Save it securely
4. Keep this tab open for later

#### Step 4.2: Create Browser Extension OAuth App

1. In GitHub OAuth Apps page, click **"New OAuth App"** again
2. Fill out the form:

   **Application name:** `PromptRoot Extension` (or your fork name)
   
   **Homepage URL:**
   ```
   https://YOUR_PROJECT_ID.web.app
   ```
   
   **Application description:** (optional)
   ```
   PromptRoot browser extension GitHub sync
   ```
   
   **Authorization callback URL:**
   ```
   https://YOUR_PROJECT_ID.web.app/oauth-callback.html
   ```
   ⚠️ **NOTE**: This is different from the web app callback!
   
3. Click **"Register application"**

**Record Credentials:**
1. Copy your **Client ID** (e.g., `Ov23liz8g6qMlD1izTFe`)
2. Click **"Generate a new client secret"**
3. Copy the **Client secret** (e.g., `95b6731de3697bf25d21376a8b9ba7a004ab36fa`)
4. Save both securely

**✅ You now have 4 values:**
- Web App Client ID
- Web App Client Secret
- Extension Client ID
- Extension Client Secret

---

## Firebase Configuration

Now we'll configure your local files with Firebase and GitHub credentials.

### Part 5: Configure Firebase in Your Code

#### Step 5.1: Update Firebase Config File

Open `src/firebase-init.js` in your code editor:

```bash
# Using VS Code:
code src/firebase-init.js

# Or any text editor:
notepad src/firebase-init.js  # Windows
nano src/firebase-init.js     # Mac/Linux
```

Find this section (around line 7-15):

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxXxX",
  authDomain: "promptroot-f8eeb.firebaseapp.com",
  projectId: "promptroot-f8eeb",
  storageBucket: "promptroot-f8eeb.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890abcdef"
};
```

**Replace the entire object** with the Firebase config you copied in Step 3.2.

**Save the file** (Ctrl+S or Cmd+S).

#### Step 5.2: Update Firebase Project ID

Open `firebase.json`:

```bash
code firebase.json
```

Find this line (near the top):

```json
{
  "projects": {
    "default": "promptroot-f8eeb"
  },
```

Replace `"promptroot-f8eeb"` with your Firebase project ID:

```json
{
  "projects": {
    "default": "my-promptroot-a1b2c"
  },
```

Find this section (around line 40):

```json
"hosting": {
  "site": "promptroot-f8eeb",
```

Replace the site name with your project ID:

```json
"hosting": {
  "site": "my-promptroot-a1b2c",
```

**Save the file**.

#### Step 5.3: Update Browser Extension Config

Open `browser-extension/config.js`:

```bash
code browser-extension/config.js
```

Find this object (entire file):

```javascript
const CONFIG = {
  clientId: 'Ov23liz8g6qMlD1izTFe',
  redirectUri: 'https://promptroot.ai/oauth-callback.html',
  scopes: ['public_repo'],
  functionsUrl: 'https://us-central1-promptroot-b02a2.cloudfunctions.net',
  projectId: 'promptroot-b02a2'
};
```

Replace with your values:

```javascript
const CONFIG = {
  clientId: 'YOUR_EXTENSION_CLIENT_ID',  // From Step 4.2
  redirectUri: 'https://YOUR_PROJECT_ID.web.app/oauth-callback.html',
  scopes: ['public_repo'],  // Keep this for public repos only
  functionsUrl: 'https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net',
  projectId: 'YOUR_PROJECT_ID'
};
```

**Save the file**.

#### Step 5.4: Update Web App OAuth Scope

Open `src/modules/auth.js`:

```bash
code src/modules/auth.js
```

Find the `signInWithGitHub()` function (around line 20-30):

```javascript
async signInWithGitHub() {
  const provider = new firebase.auth.GithubAuthProvider();
  // Add scope for public repo access
  provider.addScope('public_repo');
  
  try {
    const result = await firebase.auth().signInWithPopup(provider);
```

**Verify the line** `provider.addScope('public_repo');` exists.
- If it's not there, add it after the `const provider = ...` line
- This scope allows the app to create issues in public repos

**Save the file**.

---

### Part 6: Set Firebase Functions Environment Variables

Firebase Functions need your GitHub OAuth credentials to exchange auth codes for tokens.

#### Step 6.1: Login to Firebase CLI

```bash
# Login to Firebase (opens browser)
firebase login

# Login with the Google account that owns your Firebase project
# Grant permissions when prompted
# You should see: "✔  Success! Logged in as your@email.com"
```

#### Step 6.2: Select Your Project

```bash
# List available projects
firebase projects:list

# Should show your project:
# │ my-promptroot-a1b2c │ My PromptRoot │

# Select your project (if not already selected)
firebase use my-promptroot-a1b2c
```

#### Step 6.3: Set GitHub OAuth Credentials

```bash
# Set the WEB APP credentials (for Firebase Functions)
firebase functions:config:set \
  github.client_id="YOUR_WEB_APP_CLIENT_ID" \
  github.client_secret="YOUR_WEB_APP_CLIENT_SECRET"

# Example:
# firebase functions:config:set \
#   github.client_id="Ov23liAg1J4KCbE1HaDD" \
#   github.client_secret="60c4d016fca0d2ad316b83a1a8c05ddc8af86b3b"

# You should see:
# ✔  Functions config updated.
# ...
# Please deploy your functions for the change to take effect by running:
#    firebase deploy --only functions
```

**Windows PowerShell users:** Use this format instead:
```powershell
firebase functions:config:set github.client_id="YOUR_WEB_APP_CLIENT_ID" github.client_secret="YOUR_WEB_APP_CLIENT_SECRET"
```

#### Step 6.4: Verify Configuration (Optional)

```bash
# Check what's configured
firebase functions:config:get

# Should show:
# {
#   "github": {
#     "client_id": "Ov23liAg1J4KCbE1HaDD",
#     "client_secret": "60c4d016fca0d2ad316b83a1a8c05ddc8af86b3b"
#   }
# }
```

---

### Part 7: Deploy Firebase Security Rules

Security rules control who can read/write your Firestore database and Storage.

#### Step 7.1: Deploy Firestore Rules

```bash
# Deploy Firestore security rules
firebase deploy --only firestore:rules

# You should see:
# === Deploying to 'my-promptroot-a1b2c'...
# 
# i  firestore: reading indexes from firestore.indexes.json...
# i  firestore: checking firestore.rules for compilation errors...
# ✔  firestore: rules file firestore.rules compiled successfully
# i  firestore: uploading rules firestore.rules...
# ✔  firestore: released rules firestore.rules to cloud.firestore
# 
# ✔  Deploy complete!
```

#### Step 7.2: Deploy Storage Rules

```bash
# Deploy Storage security rules
firebase deploy --only storage

# You should see:
# === Deploying to 'my-promptroot-a1b2c'...
# 
# i  storage: checking storage.rules for compilation errors...
# ✔  storage: rules file storage.rules compiled successfully
# i  storage: uploading rules storage.rules...
# ✔  storage: released rules storage.rules
# 
# ✔  Deploy complete!
```

**✅ Security rules deployed!** Your database and storage are now protected.

---

### Part 8: Deploy Functions

Firebase Functions handle server-side operations like GitHub OAuth token exchange.

#### Step 8.1: Install Functions Dependencies

```bash
# Navigate to functions directory
cd functions

# Install dependencies (uses Node.js specified in package.json)
npm install

# You should see:
# added 300 packages, and audited 301 packages in 45s
# ...

# Return to project root
cd ..
```

#### Step 8.2: Deploy Functions

```bash
# Deploy all functions
firebase deploy --only functions

# This takes 3-5 minutes for initial deployment
# You should see:
# === Deploying to 'my-promptroot-a1b2c'...
# 
# i  functions: preparing codebase default for deployment
# i  functions: ensuring required API cloudfunctions.googleapis.com is enabled...
# i  functions: ensuring required API cloudbuild.googleapis.com is enabled...
# ✔  functions: required API cloudfunctions.googleapis.com is enabled
# ✔  functions: required API cloudbuild.googleapis.com is enabled
# i  functions: loading and analyzing source code for codebase default to determine what to deploy
# Serving at port 8337
# 
# i  functions: preparing functions directory for uploading...
# i  functions: packaged /path/to/functions (83.5 KB) for uploading
# ✔  functions: functions folder uploaded successfully
# 
# The following functions are found in your project but do not exist in your local source code:
#   runJules(us-central1)
#   ...
# ? Would you like to proceed with deletion? Select yes only if these functions were intentionally removed. No
# 
# i  functions: creating Node.js 18 function runJules(us-central1)...
# i  functions: creating Node.js 18 function runJulesHttp(us-central1)...
# i  functions: creating Node.js 18 function validateJulesKey(us-central1)...
# i  functions: creating Node.js 18 function getJulesKeyInfo(us-central1)...
# i  functions: creating Node.js 18 function githubOAuthExchange(us-central1)...
# i  functions: creating Node.js 18 function getGitHubUser(us-central1)...
# 
# ✔  functions[runJules(us-central1)] Successful create operation.
# ✔  functions[runJulesHttp(us-central1)] Successful create operation.
# ✔  functions[validateJulesKey(us-central1)] Successful create operation.
# ✔  functions[getJulesKeyInfo(us-central1)] Successful create operation.
# ✔  functions[githubOAuthExchange(us-central1)] Successful create operation.
# ✔  functions[getGitHubUser(us-central1)] Successful create operation.
# 
# ✔  Deploy complete!
# 
# Function URLs:
#   runJulesHttp: https://us-central1-my-promptroot-a1b2c.cloudfunctions.net/runJulesHttp
#   githubOAuthExchange: https://us-central1-my-promptroot-a1b2c.cloudfunctions.net/githubOAuthExchange
#   getGitHubUser: https://us-central1-my-promptroot-a1b2c.cloudfunctions.net/getGitHubUser
```

**⚠️ Node Version Warning:** If you see:
```
⚠  functions: package.json indicates an outdated version of firebase-functions. Please upgrade...
```
This is safe to ignore for now. Functions will still work with Node 18.

**✅ Functions deployed!** Your serverless backend is live.

---

### Part 9: Deploy Hosting

Deploy your web application to Firebase Hosting.

#### Step 9.1: Build Check (Optional)

```bash
# Optional: Verify all files are in place
ls -la  # Mac/Linux
dir     # Windows

# Should see: index.html, src/, pages/, assets/, etc.
```

#### Step 9.2: Deploy Hosting

```bash
# Deploy hosting files
firebase deploy --only hosting

# You should see:
# === Deploying to 'my-promptroot-a1b2c'...
# 
# i  hosting: preparing ./ directory for upload...
# ✔  hosting: 127 files uploaded successfully
# 
# ✔  Deploy complete!
# 
# Project Console: https://console.firebase.google.com/project/my-promptroot-a1b2c/overview
# Hosting URL: https://my-promptroot-a1b2c.web.app
```

**✅ Your app is live at:** `https://YOUR_PROJECT_ID.web.app`

---

## Post-Deployment Configuration

### Part 10: Configure GitHub OAuth in Firebase Console

Remember the GitHub OAuth apps we created? Now we connect them to Firebase Authentication.

#### Step 10.1: Add GitHub Credentials to Firebase

1. Go to Firebase Console: https://console.firebase.google.com/
2. Select your project
3. Click **"Authentication"** in left sidebar
4. Click **"Sign-in method"** tab
5. Click **"GitHub"** provider
6. Toggle **"Enable"** to ON (if not already)
7. **Client ID:** Paste your **Web App Client ID** (from Step 4.1)
8. **Client secret:** Paste your **Web App Client Secret** (from Step 4.1)
9. **Copy the redirect URI** shown (e.g., `https://my-promptroot-a1b2c.firebaseapp.com/__/auth/handler`)
10. Click **"Save"**

#### Step 10.2: Update GitHub OAuth App Callback URL

1. Go back to GitHub OAuth Apps: https://github.com/settings/developers
2. Click your **"PromptRoot Web"** app (the web app, not extension)
3. Click **"Authorization callback URL"** field
4. **Replace with:** The redirect URI you copied in step 9 above
   ```
   https://YOUR_PROJECT_ID.firebaseapp.com/__/auth/handler
   ```
5. Click **"Update application"**

**✅ GitHub authentication is now configured!**

#### Step 10.3: Add Authorized Domain (If Using Custom Domain)

If you plan to use a custom domain (e.g., `promptroot.ai`):

1. In Firebase Console → Authentication
2. Click **"Settings"** tab
3. Scroll to **"Authorized domains"**
4. Click **"Add domain"**
5. Enter your domain: `yourdomain.com`
6. Click **"Add"**

---

### Part 11: GitHub Pages Setup (Optional)

If you want to host documentation on GitHub Pages:

#### Step 11.1: Enable GitHub Pages

1. Go to your forked repository on GitHub
2. Click **"Settings"** tab
3. Click **"Pages"** in left sidebar
4. **Source:** Select "Deploy from a branch"
5. **Branch:** Select `main` (or `master`)
6. **Folder:** Select `/ (root)` or `/docs` if you have docs
7. Click **"Save"**
8. Wait 1-2 minutes for deployment

**Your docs will be available at:**
```
https://YOUR_USERNAME.github.io/promptroot/
```

#### Step 11.2: Custom Domain for GitHub Pages (Optional)

If you have a custom domain:

1. In GitHub Pages settings, enter your domain in **"Custom domain"**
2. Click **"Save"**
3. Add a `CNAME` file to your repository root:
   ```bash
   echo "yourdomain.com" > CNAME
   git add CNAME
   git commit -m "Add custom domain"
   git push
   ```
4. Configure DNS:
   - Add `CNAME` record: `www` → `YOUR_USERNAME.github.io`
   - Add `A` records for apex domain (check GitHub docs)

---

## Local Development

### Part 12: Running Locally

#### Step 12.1: Install Dependencies

```bash
# If you haven't already, install project dependencies
npm install

# This installs development tools (http-server, etc.)
```

#### Step 12.2: Start Local Server

```bash
# Start local development server
npm start

# You should see:
# Starting up http-server, serving ./
# 
# http-server version: 14.1.1
# 
# http-server settings: 
# CORS: disabled
# Cache: 3600 seconds
# Connection Timeout: 120 seconds
# Directory Listings: visible
# AutoIndex: visible
# Serve GZIP Files: false
# Serve Brotli Files: false
# Default File Extension: none
# 
# Available on:
#   http://127.0.0.1:3000
#   http://192.168.1.100:3000
# Hit CTRL-C to stop the server
```

#### Step 12.3: Access Local App

Open your browser to: http://localhost:3000

**First-Time Setup:**
1. Click **"Sign in with GitHub"**
2. Authorize the GitHub OAuth app
3. You'll be redirected back and signed in
4. Check browser console (F12) for any errors

#### Step 12.4: Test Features

**Test Authentication:**
- Sign in with GitHub ✅
- Check that your username appears in header
- Sign out and sign in again

**Test Prompt Creation:**
- Create a new prompt
- Save to Firestore
- Refresh page - prompt should persist

**Test GitHub Sync (Browser Extension):**
- Install extension (see `browser-extension/README.md`)
- Authorize GitHub access
- Sync prompts to a test repository

**Test Jules Integration (if you have API key):**
- Go to Jules page
- Enter API key
- Submit a task
- Check queue

#### Step 12.5: Local Development Workflow

```bash
# 1. Make code changes in your editor
#    Files auto-reload in browser (for HTML/CSS/JS)

# 2. Test changes at http://localhost:3000

# 3. Check browser console for errors (F12)

# 4. Commit changes when satisfied
git add .
git commit -m "Your change description"
git push origin main

# 5. Deploy to Firebase when ready
firebase deploy
```

---

## Deployment

### Part 13: Deploy Updates

When you make changes and want to deploy them:

#### Step 13.1: Full Deployment

```bash
# Deploy everything (rules, functions, hosting)
firebase deploy

# Takes 3-5 minutes
# Deploys:
#   - Firestore rules
#   - Storage rules
#   - All Functions
#   - Hosting files
```

#### Step 13.2: Selective Deployment

```bash
# Deploy only hosting (fastest, for UI changes)
firebase deploy --only hosting

# Deploy only functions (for backend changes)
firebase deploy --only functions

# Deploy only rules (for security changes)
firebase deploy --only firestore:rules,storage

# Deploy specific function (faster than all functions)
firebase deploy --only functions:githubOAuthExchange
```

#### Step 13.3: Verify Deployment

After deployment:

1. **Check Hosting URL:**
   ```
   https://YOUR_PROJECT_ID.web.app
   ```
   Hard refresh (Ctrl+Shift+R) to clear cache

2. **Check Functions:**
   ```bash
   # List deployed functions
   firebase functions:list
   ```

3. **Test in Production:**
   - Sign in with GitHub
   - Create/view prompts
   - Check browser console for errors

4. **Monitor Logs:**
   ```bash
   # View function logs (live)
   firebase functions:log
   
   # View logs for specific function
   firebase functions:log --only githubOAuthExchange
   ```

---

## Troubleshooting

### Common Issues & Solutions

#### Issue: "Firebase command not found"

**Solution:**
```bash
# Install Firebase CLI globally
npm install -g firebase-tools

# Verify installation
firebase --version
```

#### Issue: "Permission denied" when deploying

**Solution:**
```bash
# Logout and login again
firebase logout
firebase login

# Use correct Google account (one that owns the project)
```

#### Issue: "Project not found" when deploying

**Solution:**
```bash
# Check current project
firebase projects:list

# Select correct project
firebase use YOUR_PROJECT_ID

# Verify selection
firebase use
```

#### Issue: Firestore "Permission denied" in browser

**Solution:**
1. Make sure you're signed in (check header for username)
2. Verify Firestore rules are deployed:
   ```bash
   firebase deploy --only firestore:rules
   ```
3. Check Firebase Console → Firestore Database → Rules tab
4. Rules should allow authenticated users to read/write their own data

#### Issue: GitHub sign-in doesn't work

**Solution:**
1. Verify GitHub OAuth credentials in Firebase Console:
   - Firebase Console → Authentication → Sign-in method → GitHub
   - Check Client ID and Secret are correct
2. Verify callback URL in GitHub OAuth app:
   - Should be: `https://YOUR_PROJECT_ID.firebaseapp.com/__/auth/handler`
3. Check browser console for errors (F12)
4. Verify authorized domains include your hosting URL:
   - Firebase Console → Authentication → Settings → Authorized domains

#### Issue: Functions fail with "github.client_id not found"

**Solution:**
```bash
# Set functions config
firebase functions:config:set \
  github.client_id="YOUR_CLIENT_ID" \
  github.client_secret="YOUR_CLIENT_SECRET"

# Deploy functions again
firebase deploy --only functions
```

#### Issue: Browser extension won't sync

**Solution:**
1. Check `browser-extension/config.js` has correct:
   - `clientId` (Extension OAuth App Client ID)
   - `redirectUri` (should match your hosting URL + `/oauth-callback.html`)
   - `functionsUrl` (should match your project functions URL)
2. Reload extension in Chrome:
   - chrome://extensions/ → Click reload icon for PromptRoot
3. Check extension console logs:
   - Right-click extension icon → Inspect popup → Console tab

#### Issue: "Storage: Quota exceeded" error

**Solution:**
1. Verify you're on Blaze plan (required for Storage)
2. Check current usage: Firebase Console → Usage and billing
3. Clear old files if needed
4. Consider implementing file size limits in code

#### Issue: Functions deploy fails with Node version error

**Solution:**
```bash
# Check Node version
node --version

# If < v18, install Node 18+:
# Download from: https://nodejs.org/

# Functions package.json specifies Node 22, but 18 works
# To suppress warning, edit functions/package.json:
# "engines": {
#   "node": "18"
# }

# Redeploy
firebase deploy --only functions
```

#### Issue: "npm start" fails with EADDRINUSE

**Solution:**
```bash
# Another process is using port 3000
# Find and kill it:

# Mac/Linux:
lsof -ti:3000 | xargs kill -9

# Windows:
netstat -ano | findstr :3000
taskkill /PID <PID_NUMBER> /F

# Or use a different port:
npx http-server ./ -p 8080
```

#### Issue: CORS errors in browser console

**Solution:**
This happens when making requests from localhost to Firebase.

**Option 1:** Use Firebase Hosting URL instead of localhost
```
https://YOUR_PROJECT_ID.web.app
```

**Option 2:** Add CORS headers to Functions
See `functions/index.js` - CORS is already configured with `cors({origin: true})`

**Option 3:** Use Firebase Emulators for local development
```bash
firebase emulators:start
```

#### Issue: Data not appearing after deployment

**Solution:**
1. **Hard refresh:** Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. **Clear cache:** Browser settings → Clear browsing data → Cached files
3. **Check Firebase Console:** Verify data exists in Firestore
4. **Check browser console:** Look for JavaScript errors
5. **Verify Firebase config:** Ensure `src/firebase-init.js` has correct project ID

#### Issue: Docker container won't start

**Solution:**
```bash
# Check Docker is running
docker ps

# If not, start Docker Desktop

# Check for port conflicts
docker-compose down
docker-compose up

# View logs for errors
docker-compose logs

# Rebuild from scratch
docker-compose down -v
docker-compose build --no-cache
docker-compose up
```

---

## Advanced Topics

### Custom Domain Setup

To use a custom domain (e.g., `yourdomain.com`):

#### Step 1: Firebase Hosting Custom Domain

1. Firebase Console → Hosting
2. Click **"Add custom domain"**
3. Enter your domain: `yourdomain.com`
4. Follow Firebase instructions to add DNS records:
   - Type `A`, Name `@`, Value `151.101.1.195` (and other IPs provided)
   - Type `A`, Name `@`, Value `151.101.65.195`
   - Or `CNAME` for subdomain: `www` → `YOUR_PROJECT_ID.web.app`
5. Wait 24-48 hours for DNS propagation
6. Firebase will automatically provision SSL certificate

#### Step 2: Update OAuth Callback URLs

1. Update GitHub OAuth apps with new domain:
   ```
   https://yourdomain.com/oauth-callback.html
   ```
2. Update `browser-extension/config.js`:
   ```javascript
   redirectUri: 'https://yourdomain.com/oauth-callback.html'
   ```
3. Update Firebase authorized domains:
   - Firebase Console → Authentication → Settings → Authorized domains
   - Add `yourdomain.com`

#### Step 3: Redeploy

```bash
firebase deploy --only hosting
```

### Data Migration from Another Firebase Project

If you forked this from an existing instance with data:

See the `scripts/migrate-data.js` file for a complete migration script.

```bash
# 1. Download service account keys:
#    - Old project: Firebase Console → Settings → Service Accounts → Generate key
#    - New project: Same steps
#    Save as scripts/old-service-account.json and scripts/new-service-account.json

# 2. Install dependencies
cd scripts
npm install firebase-admin

# 3. Run migration (idempotent - safe to run multiple times)
node migrate-data.js

# Migrates:
#   - julesQueues (all users' queues)
#   - julesKeys (API keys)
#   - users (user profiles)
```

### Environment Variables

For multiple environments (dev, staging, prod):

```bash
# Create .firebaserc with aliases
{
  "projects": {
    "default": "my-promptroot-dev",
    "production": "my-promptroot-prod"
  }
}

# Deploy to specific environment
firebase use production
firebase deploy

# Or in one command
firebase deploy --project my-promptroot-prod
```

### Continuous Integration / Continuous Deployment (CI/CD)

#### GitHub Actions Setup

Create `.github/workflows/firebase-deploy.yml`:

```yaml
name: Deploy to Firebase Hosting

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install Firebase CLI
        run: npm install -g firebase-tools
      
      - name: Deploy to Firebase
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
        run: firebase deploy --token "$FIREBASE_TOKEN"
```

**Get Firebase CI Token:**
```bash
firebase login:ci
# Copy the token and add to GitHub Secrets:
# Repo → Settings → Secrets → Actions → New secret
# Name: FIREBASE_TOKEN
# Value: <paste token>
```

---

## Summary Checklist

Use this checklist to verify your setup:

### Firebase Setup
- [ ] Firebase project created
- [ ] Blaze plan activated (credit card added)
- [ ] Firestore Database enabled
- [ ] Cloud Storage enabled
- [ ] Authentication enabled (GitHub provider)
- [ ] Cloud Functions enabled
- [ ] Firebase Hosting enabled
- [ ] Web app registered
- [ ] Firebase config copied to `src/firebase-init.js`
- [ ] Project ID updated in `firebase.json`

### GitHub Setup
- [ ] Web OAuth app created
- [ ] Extension OAuth app created
- [ ] Web OAuth credentials saved
- [ ] Extension OAuth credentials saved
- [ ] Web OAuth callback URL configured
- [ ] Extension OAuth callback URL configured
- [ ] OAuth credentials added to Firebase Console
- [ ] Authorized domains configured (if custom domain)

### Code Configuration
- [ ] `src/firebase-init.js` updated with Firebase config
- [ ] `firebase.json` updated with project ID
- [ ] `browser-extension/config.js` updated with extension OAuth
- [ ] `src/modules/auth.js` includes `public_repo` scope
- [ ] Firebase CLI logged in
- [ ] Functions environment variables set (`github.client_id`, `github.client_secret`)

### Deployment
- [ ] Firestore rules deployed
- [ ] Storage rules deployed
- [ ] Functions deployed (6 functions)
- [ ] Hosting deployed
- [ ] Deployment verified in browser

### Testing
- [ ] Local server runs (`npm start`)
- [ ] Can access at localhost:3000
- [ ] GitHub sign-in works
- [ ] Can create/view prompts
- [ ] Prompts persist after refresh
- [ ] Browser extension syncs (if testing extension)
- [ ] Production URL works (https://YOUR_PROJECT_ID.web.app)

### Optional Enhancements
- [ ] Custom domain configured
- [ ] SSL certificate provisioned
- [ ] GitHub Pages enabled
- [ ] CI/CD pipeline set up
- [ ] Data migrated from old instance

---

## Support & Resources

### Official Documentation
- **Firebase Docs:** https://firebase.google.com/docs
- **Firebase CLI:** https://firebase.google.com/docs/cli
- **GitHub OAuth:** https://docs.github.com/en/developers/apps/building-oauth-apps
- **Docker Docs:** https://docs.docker.com/

### This Project
- **Main Repository:** https://github.com/JesseWarrenDevelopment/prompt-sharing
- **Issues:** https://github.com/JesseWarrenDevelopment/prompt-sharing/issues
- **License:** AGPL-3.0 (see LICENSE file)

### Getting Help

1. **Check this guide** - Most issues are covered in Troubleshooting
2. **Browser console** - Check for JavaScript errors (F12)
3. **Firebase logs** - Run `firebase functions:log` to see backend errors
4. **GitHub Discussions** - Ask questions in the repository Discussions tab
5. **Create an Issue** - If you find a bug, open an issue with details:
   - What you were trying to do
   - What actually happened
   - Error messages (include full text)
   - Browser/OS version
   - Screenshots if relevant

---

## License

This project is licensed under **AGPL-3.0**. When you fork and deploy:

- ✅ You can modify the code freely
- ✅ You can deploy your own instance
- ✅ You can use for commercial purposes
- ⚠️ You **must** keep the same AGPL-3.0 license
- ⚠️ You **must** make your source code available
- ⚠️ You **must** disclose your changes

**In practice:** If you fork this project and deploy it publicly, you must:
1. Keep the LICENSE file
2. Keep your forked repository public on GitHub
3. Document any changes you make
4. Provide a link to your source code for users

See the LICENSE file for full legal terms.

---

## Congratulations! 🎉

You've successfully forked and deployed PromptRoot! Your instance should now be running at:

- **Firebase Hosting:** `https://YOUR_PROJECT_ID.web.app`
- **Custom Domain:** `https://yourdomain.com` (if configured)
- **Local Development:** `http://localhost:3000`

**Next Steps:**
- Customize the UI to match your branding
- Add your Jules API keys
- Invite team members
- Create your first prompts
- Explore the codebase

**Happy prompting!** 🚀
