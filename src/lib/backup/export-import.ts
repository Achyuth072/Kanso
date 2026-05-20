import { zipSync, unzipSync, strToU8, strFromU8 } from "fflate";
import type { BackupData } from "./types";
import { generateICS } from "@/lib/utils/ics-generator";
import { toCalendarEventUI } from "@/lib/types/calendar-event";

/**
 * Create a ZIP archive containing backup.json and calendars/kanso-events.ics
 */
export async function createBackupZip(data: BackupData): Promise<Blob> {
  const jsonContent = JSON.stringify(data, null, 2);

  // Filter out archived events and convert to UI-ready format for ICS utility
  const eventsUI = data.events
    .filter((e) => !e.is_archived)
    .map((e) => toCalendarEventUI(e));

  const icsContent =
    eventsUI.length > 0 ? generateICS(eventsUI, "Kanso Backup") : "";

  const files = Object.create(null);
  const jsonU8 = strToU8(jsonContent);
  files["backup.json"] = new Uint8Array(jsonU8);

  if (icsContent) {
    const icsU8 = strToU8(icsContent);
    files["calendars/kanso-events.ics"] = new Uint8Array(icsU8);
  }

  const zipData = zipSync(files, { level: 6 });
  return new Blob([zipData as BlobPart], { type: "application/zip" });
}

/**
 * Parse a backup ZIP, extract backup.json, and validate BackupData
 */
export async function parseBackupZip(blob: Blob): Promise<BackupData> {
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(new Error("FileReader failed to read Blob"));
    reader.readAsArrayBuffer(blob);
  });
  const uint8 = new Uint8Array(buffer);

  if (uint8.length === 0) {
    throw new Error("Invalid backup archive: empty file");
  }

  try {
    const files = unzipSync(uint8);

    // Robust search: find a non-empty entry containing "backup.json"
    let backupJsonRaw: Uint8Array | undefined;
    for (const [name, data] of Object.entries(files)) {
      if (name.toLowerCase().includes("backup.json") && data.length > 0) {
        backupJsonRaw = data;
        break;
      }
    }

    if (!backupJsonRaw) {
      throw new Error("Backup archive does not contain backup.json");
    }

    const jsonStr = strFromU8(backupJsonRaw);
    const data = JSON.parse(jsonStr) as BackupData;

    // Basic structural validation
    if (!data.metadata?.version) {
      throw new Error("Invalid backup format: missing version");
    }

    return data;
  } catch (e) {
    if (e instanceof Error) throw e;
    throw new Error(`Failed to parse backup archive: ${String(e)}`);
  }
}

/**
 * Trigger browser download for a given ZIP Blob with a timestamped filename.
 */
export function downloadBackup(blob: Blob, filename?: string): void {
  const timestamp = new Date().toISOString().split("T")[0];
  const finalName = filename || `kanso-backup-${timestamp}.zip`;

  const url = URL.createObjectURL(blob);
  const anchor = document.body.appendChild(document.createElement("a"));

  anchor.href = url;
  anchor.download = finalName;
  anchor.click();

  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
