'use client'

interface SheetSelectorProps {
  sheets: string[];
  currentSheet: string;
  onSheetChange: (sheet: string) => void;
}

export default function SheetSelector({ sheets, currentSheet, onSheetChange }: SheetSelectorProps) {
  return (
    <div className="flex items-center gap-4 mb-4">
      <label htmlFor="sheet-select" className="font-medium text-gray-700">
        Select Family Tree:
      </label>
      <select
        id="sheet-select"
        value={currentSheet}
        onChange={(e) => onSheetChange(e.target.value)}
        className="bg-white block w-64 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
      >
        {sheets.map((sheet) => (
          <option key={sheet} value={sheet}>
            {sheet}
          </option>
        ))}
      </select>
    </div>
  );
} 