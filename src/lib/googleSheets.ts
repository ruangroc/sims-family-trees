import { google } from 'googleapis';
import { FamilyMemberDataNode } from '@/types/family';

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

export async function getFamilyData(): Promise<FamilyMemberDataNode[]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      range: `${process.env.GOOGLE_SHEETS_SHEET_NAME}!A2:G`,
    });

    const rows = response.data.values;
    if (!rows) return [];

    return rows.map((row, index) => ({
      id: `member-${index}`,
      name: row[0] || '',
      parent1Name: row[1] || null,
      parent2Name: row[2] || null,
      reproducedVia: row[3] || null,
      gender: (row[4] as 'Male' | 'Female'),
      currentPartner: row[5] || null,
      narrativeDescription: row[6] || null,
    }));
  } catch (error) {
    console.error('Error fetching family data:', error);
    throw error;
  }
} 