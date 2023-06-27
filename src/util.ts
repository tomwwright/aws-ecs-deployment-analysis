import fs from "fs";
/*
 * Library functions
 *
 * (thanks ChatGPT!)
 */

interface CSVObject {
  [key: string]: string;
}

export function parseCSV(filePath: string): CSVObject[] {
  const fileContent = fs.readFileSync(filePath, "utf-8");
  const lines = fileContent.split("\n");

  // Extract the headers from the first line
  const headers = lines[0].split(",");

  const objects: CSVObject[] = [];

  for (let i = 1; i < lines.length; i++) {
    const currentLine = lines[i].split(",");

    if (currentLine.length === headers.length) {
      const obj: CSVObject = {};

      for (let j = 0; j < headers.length; j++) {
        obj[headers[j]] = currentLine[j];
      }

      objects.push(obj);
    }
  }

  return objects;
}

type Hash = Record<string, string>;

export function convertToHash(data: Hash[], field: string) {
  const hash: Record<string, Hash> = {};
  for (const d of data) {
    hash[d[field]] = d;
  }
  return hash;
}

export function mergeHashes(
  hash1: Record<string, Hash>,
  hash2: Record<string, Hash>
): Record<string, Hash> {
  const mergedHash: Record<string, Hash> = { ...hash1 };

  for (const key of Object.keys(hash2)) {
    mergedHash[key] = {
      ...hash2[key],
      ...hash1[key],
    };
  }

  return mergedHash;
}

interface GroupedObjects<T> {
  [key: string]: T[];
}

export function groupBy<T>(
  list: T[],
  key: keyof T,
  sortBy?: keyof T
): GroupedObjects<T> {
  const grouped: GroupedObjects<T> = {};

  for (const item of list) {
    const itemKey = String(item[key]);

    if (grouped[itemKey]) {
      grouped[itemKey].push(item);
    } else {
      grouped[itemKey] = [item];
    }
  }

  if (sortBy) {
    for (const groupKey in grouped) {
      if (grouped.hasOwnProperty(groupKey)) {
        grouped[groupKey] = grouped[groupKey].sort((a, b) => {
          if (a[sortBy] < b[sortBy]) {
            return -1;
          } else if (a[sortBy] > b[sortBy]) {
            return 1;
          }
          return 0;
        });
      }
    }
  }

  return grouped;
}
