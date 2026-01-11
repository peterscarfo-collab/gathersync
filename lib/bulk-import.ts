/**
 * Utilities for bulk importing availability data from spreadsheet formats
 */

import type { Participant } from '@/types/models';

export interface BulkImportResult {
  success: boolean;
  participants: Array<{
    name: string;
    availability: Record<string, boolean>;
  }>;
  errors: string[];
}

/**
 * Parse bulk availability data from CSV/TSV format
 * Expected format:
 * Name, 1, 2, 3, 4, 5, ...
 * John, Y, N, Y, Y, N, ...
 * Sarah, Y, Y, Y, N, N, ...
 */
export function parseBulkAvailability(
  text: string,
  month: number,
  year: number
): BulkImportResult {
  const result: BulkImportResult = {
    success: false,
    participants: [],
    errors: [],
  };

  try {
    // Split into lines
    const lines = text.trim().split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      result.errors.push('Need at least a header row and one data row');
      return result;
    }

    // Parse header (day numbers)
    const headerLine = lines[0];
    const separator = headerLine.includes('\t') ? '\t' : ',';
    const headers = headerLine.split(separator).map(h => h.trim());
    
    // First column should be "Name" or similar
    const dayColumns = headers.slice(1);
    const days = dayColumns.map(d => parseInt(d)).filter(d => !isNaN(d) && d >= 1 && d <= 31);
    
    if (days.length === 0) {
      result.errors.push('No valid day numbers found in header row');
      return result;
    }

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const cells = line.split(separator).map(c => c.trim());
      
      if (cells.length < 2) {
        result.errors.push(`Row ${i + 1}: Not enough columns`);
        continue;
      }

      const name = cells[0];
      if (!name) {
        result.errors.push(`Row ${i + 1}: Missing name`);
        continue;
      }

      // Parse availability for each day
      const availability: Record<string, boolean> = {};
      for (let j = 0; j < days.length; j++) {
        const day = days[j];
        const value = cells[j + 1]?.toUpperCase();
        
        // Y/YES/1/TRUE = available, N/NO/0/FALSE = unavailable
        const isAvailable = ['Y', 'YES', '1', 'TRUE', 'X'].includes(value);
        
        // Format date as YYYY-MM-DD
        const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        availability[dateStr] = isAvailable;
      }

      result.participants.push({
        name,
        availability,
      });
    }

    result.success = result.participants.length > 0;
    if (result.participants.length === 0) {
      result.errors.push('No valid participant data found');
    }

  } catch (error: any) {
    result.errors.push(`Parse error: ${error.message}`);
  }

  return result;
}

/**
 * Generate example CSV template for bulk import
 */
export function generateImportTemplate(month: number, year: number): string {
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  
  const header = ['Name', ...days].join(',');
  const example1 = ['John', ...days.map(() => 'Y')].join(',');
  const example2 = ['Sarah', ...days.map((d, i) => i % 2 === 0 ? 'Y' : 'N')].join(',');
  
  return [header, example1, example2].join('\n');
}
