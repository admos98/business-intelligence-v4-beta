# Business Intelligence for Mehrnoosh's Cafe

This is a full-stack, AI-powered purchasing and analysis tool built with React, Vercel Serverless Functions, and using a GitHub Gist as a database.

## Features

-   Shopping list management
-   AI-powered receipt scanning (OCR)
-   Smart restock suggestions
-   Data analysis and insights hub with an AI Business Advisor
-   Inflation tracking for items and categories
-   Vendor and item management
-   PDF and JSON data exports

## Architecture

-   **Frontend**: React (with TypeScript) and Zustand for state management.
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

1.  **Fork and Clone the Repository:**
    *   First, get the code into your own GitHub account.
    *   Clone your repository to your local machine:
        ```bash
        git clone https://github.com/YourUsername/your-repo-name.git
        cd your-repo-name
        ```

2.  **Install Vercel CLI:**
    *   Open your terminal and install the Vercel command-line interface:
        ```bash
        npm install -g vercel
        ```

3.  **Link the Project to Vercel:**
    *   In your project directory, run:
        ```bash
        vercel login
        vercel link
        ```
    *   Follow the on-screen prompts to link your local project to a new Vercel project.

4.  **Set Environment Variables:**
    *   You need to securely store your API keys on Vercel. Run the following commands, replacing the placeholders with your actual keys from Step 1 and the prerequisites.
        ```bash
        # Add your GitHub Personal Access Token (for the database)
        vercel env add GITHUB_TOKEN

        # Add your Gist ID (for the database)
        vercel env add GIST_ID

        # Add your Google Gemini API Key (for all AI features)
        vercel env add API_KEY
        ```
    *   Vercel will prompt you to paste each value. When asked which environments to apply them to, select **Production, Preview, and Development**.

### Step 3: Run Locally (Optional but Recommended)

1.  **Install Dependencies:**
    ```bash
    npm install
    ```

2.  **Pull Environment Variables:**
    *   To use your secret keys locally, pull them down from Vercel:
        ```bash
        vercel env pull .env.development.local
        ```
    *   This creates a `.env.development.local` file that the Vercel CLI will use.

3.  **Start the Development Server:**
    ```bash
    vercel dev
    ```
    *   Your app should now be running locally, typically at `http://localhost:3000`.

### Step 4: Deploy to Production

1.  **Deploy:**
    *   From your project's root directory, simply run:
        ```bash
        vercel --prod
        ```

2.  **Done!**
    *   Vercel will build and deploy your application. It will provide you with a live URL where you can access your app. Any future pushes to your main branch will trigger automatic deployments if you've connected your GitHub repository through the Vercel dashboard.