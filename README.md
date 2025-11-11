# Business Intelligence for Mehrnoosh's Cafe

This is a full-stack, AI-powered purchasing and analysis tool built with React, Vite, Vercel Serverless Functions, and using a GitHub Gist as a database.

## Features

-   Shopping list management
-   AI-powered receipt scanning (OCR)
-   Smart restock suggestions
-   Data analysis and insights hub with an AI Business Advisor
-   Inflation tracking for items and categories
-   Vendor and item management
-   PDF and JSON data exports

## Architecture

-   **Frontend**: React (with TypeScript), Vite for building, and Zustand for state management.
-   **Backend**: Vercel Serverless Functions (written in TypeScript) acting as a secure API layer.
-   **Database**: A private GitHub Gist for simple, version-controlled JSON data storage.
-   **AI**: Google Gemini API for all intelligent features, accessed via a secure backend endpoint.
-   **Deployment**: Hosted on Vercel.

---

## Deployment Guide

Follow these steps to set up and deploy your own instance of the application.

### Prerequisites

1.  **Node.js**: Make sure you have Node.js (version 18 or later) installed.
2.  **Vercel Account**: Sign up for a free account at [vercel.com](https://vercel.com).
3.  **GitHub Account**: You will need a GitHub account.
4.  **Google Gemini API Key**: Get an API key from [Google AI Studio](https://aistudio.google.com/app/apikey).

### Step 1: Create a GitHub Gist and Personal Access Token

The application uses a private GitHub Gist to store its data.

1.  **Create a Personal Access Token (PAT):**
    *   Go to your GitHub Settings > Developer settings > Personal access tokens > Tokens (classic).
    *   Click **Generate new token (classic)**.
    *   Give it a descriptive name (e.g., "Mehrnoosh Cafe App").
    *   Set the **Expiration** to "No expiration".
    *   Under **Select scopes**, check the `gist` scope.
    *   Click **Generate token** and **copy the token immediately**. You will not be able to see it again. Save it somewhere safe for the next steps.

2.  **Create a Private Gist:**
    *   Go to [gist.github.com](https://gist.github.com).
    *   Create a new Gist with a filename like `mehrnoosh-cafe-data.json`.
    *   Put `{}` (an empty JSON object) as the initial content.
    *   **Crucially**, select **"Create secret gist"**.
    *   Click **Create secret gist**.
    *   After the Gist is created, look at the URL in your browser. It will look like `https://gist.github.com/YourUsername/abcdef1234567890`. The long string of characters (`abcdef1234567890`) is your **Gist ID**. Copy it.

### Step 2: Set Up and Deploy on Vercel

1.  **Fork this Repository & Link on Vercel:**
    *   Fork this repository to your own GitHub account.
    *   Go to your [Vercel Dashboard](https://vercel.com/new).
    *   Click **"Import Git Repository"** and select your newly forked repo.

2.  **Configure the Vercel Project:**
    *   **Framework Preset**: Vercel should automatically detect and select **`Vite`**. If not, choose it from the dropdown. This is the most important step.
    *   **Build & Development Settings**: You can leave these as the defaults Vercel suggests for Vite. It will automatically use the `build` command (`npm run build`) and set the output directory to `dist`.
    *   Expand the **Environment Variables** section.

3.  **Set Environment Variables:**
    *   You need to securely store your API keys on Vercel. Add the following three variables, replacing the placeholder values with your actual keys from Step 1 and the prerequisites.
    
| Name           | Value                                   |
| -------------- | --------------------------------------- |
| `GITHUB_TOKEN` | Your GitHub Personal Access Token       |
| `GIST_ID`      | Your GitHub Gist ID                     |
| `API_KEY`      | Your Google Gemini API Key              |

4.  **Deploy:**
    *   Click the **Deploy** button. Vercel will now correctly build and deploy your application.

### Step 3: Run Locally (Optional)

1.  **Clone your repository:**
    ```bash
    git clone https://github.com/YourUsername/your-repo-name.git
    cd your-repo-name
    ```
2.  **Install Vercel CLI:**
    ```bash
    npm install -g vercel
    ```
3.  **Install Dependencies:**
    ```bash
    npm install
    ```
4.  **Link and Pull Environment Variables:**
    *   This will link your local project to your Vercel project.
    ```bash
    vercel link
    ```
    *   This will download your environment variables into a local `.env.development.local` file for the dev server to use.
    ```bash
    vercel env pull .env.development.local
    ```
5.  **Start the Development Server:**
    ```bash
    vercel dev
    ```
    *   Your app should now be running locally, typically at `http://localhost:3000`.