'use client'

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { FamilyTreeNode } from '@/types/family';
import SheetSelector from '@/components/SheetSelector';
import { Montserrat } from 'next/font/google';

const montserrat = Montserrat({ 
  subsets: ['latin'],
  weight: ['400', '700'],
});

// Dynamically import the FamilyTree component to avoid SSR issues with D3
const FamilyTree = dynamic(() => import('@/components/FamilyTree'), {
  ssr: false,
});

export default function Home() {
  const [sheets, setSheets] = useState<string[]>([]);
  const [currentSheet, setCurrentSheet] = useState<string>('');
  const [treeData, setTreeData] = useState<{ [key: string]: FamilyTreeNode[] }>({});
  const [loading, setLoading] = useState(true);

  const fetchData = async (sheetName?: string) => {
    try {
      setLoading(true);
      const url = sheetName 
        ? `/api/family?sheet=${encodeURIComponent(sheetName)}`
        : '/api/family';
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (response.ok) {
        setSheets(data.sheets);
        setCurrentSheet(data.currentSheet);
        setTreeData(data.data);
        console.log("Tree data:", data.data);
      } else {
        console.error('Failed to fetch data:', data.error);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSheetChange = (sheet: string) => {
    fetchData(sheet);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-4 bg-gradient-to-br from-sky-100 via-emerald-50 to-green-100">
      <div className="w-full max-w-7xl">
        <h1 className={`${montserrat.className} text-4xl font-semibold text-center mb-8 text-emerald-600`}>
          Anita&apos;s Sims 3 Family Tree Viewer
        </h1>
        
        {sheets.length > 0 && (
          <SheetSelector
            sheets={sheets}
            currentSheet={currentSheet}
            onSheetChange={handleSheetChange}
          />
        )}

        <div className="w-full h-[800px] bg-white/90 backdrop-blur-sm rounded-lg shadow-lg">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-lg">Loading...</div>
            </div>
          ) : (
            <FamilyTree data={treeData} />
          )}
        </div>
      </div>
    </main>
  );
}
