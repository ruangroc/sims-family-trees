# Anita's Sims 3 Family Tree Viewer

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app) created using Cursor.

## Getting Started

Backed by a Google Sheets spreadsheet with the columns:

```
Name -- string (required)
Parent 1 -- string
Parent 2 -- string
Reproduced via -- string: 
Gender -- string (required): Male, Female
Current partner -- string
Narrative -- string
```

If you want to set up your own spreadsheet and app, you'll need to provide the app with your Google credentials. You'll need to set up a service account on Google Cloud Platform to set up an email and get a private key. Then share the spreadsheet with the service account email. The spreadsheet ID can be found in the URL: `https://docs.google.com/spreadsheets/d/<spreadsheet id here>/edit`.

```
# Google Sheets API credentials
GOOGLE_SHEETS_PRIVATE_KEY=""
GOOGLE_SHEETS_CLIENT_EMAIL=""
GOOGLE_SHEETS_SPREADSHEET_ID=""
GOOGLE_SHEETS_SHEET_NAME="" 
```

Run the development server locally:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

If deploying to Vercel, make sure to set the environemnt variables as well.
