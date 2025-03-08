import { google } from 'googleapis';
import { NextResponse } from 'next/server';
import { transformDataToHierarchy } from '@/utils/transformData';
import { FamilyMemberDataNode, FamilyTreeNode, ReproductionDataNode } from '@/types/family';

const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_SHEETS_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
});

const sheets = google.sheets({ version: 'v4', auth });

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sheetName = searchParams.get('sheet') || 'lazlo-sarai-strange';

    // First, get the list of available sheets
    const spreadsheet = await sheets.spreadsheets.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    });

    const sheetNames = spreadsheet.data.sheets?.map(sheet => sheet.properties?.title) || [];

    // Get the data for the requested sheet
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
      range: `${sheetName}!A2:G`,
    });

    const rows = response.data.values;
    if (!rows) {
      return NextResponse.json({ error: 'No data found' }, { status: 404 });
    }

    // Transform raw data into FamilyMemberDataNode and ReproductionDataNode types
    const familyData: FamilyTreeNode[] = [];

    rows.forEach((row: string[], index: number) => {
      const familyMember: FamilyMemberDataNode = {
        id: `member-${index}`,
        name: row[0] || '',
        parent1Name: row[1] || undefined,
        parent2Name: row[2] || undefined,
        reproducedVia: row[3] || undefined,
        gender: row[4] as 'Male' | 'Female',
        currentPartner: row[5] || undefined,
        narrativeDescription: row[6] || undefined,
      }
      familyData.push(familyMember);

      // Create ReproductionNodes as needed
      const reproducedViaString = row[3] || undefined;
      if (reproducedViaString !== undefined) {
        const rNode: ReproductionDataNode = {
          id: `${reproducedViaString}-${row[1]}-${row[2]}`,
          parent1Name: row[1],
          parent2Name: row[2] || undefined,
          reproductionMethod: reproducedViaString,
        };
        familyData.push(rNode);
      }
    });

    // Transform the flat data into a hierarchical structure
    const hierarchicalData = transformDataToHierarchy(familyData);

    return NextResponse.json({
      sheets: sheetNames,
      currentSheet: sheetName,
      data: Object.fromEntries(hierarchicalData)
    });
  } catch (error) {
    console.error('Error fetching family data:', error);
    return NextResponse.json(
      { error: 'Failed to fetch family data' },
      { status: 500 }
    );
  }
} 