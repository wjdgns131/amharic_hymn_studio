import type { HymnProject } from '../types/hymn';

export interface HymnProjectBackup {
  format: 'amharic-hymn-studio-project';
  version: 1;
  exportedAt: string;
  project: HymnProject;
}

export function exportProjectBackup(project: HymnProject): void {
  const backup: HymnProjectBackup = {
    format: 'amharic-hymn-studio-project',
    version: 1,
    exportedAt: new Date().toISOString(),
    project
  };

  const blob = new Blob(
    [JSON.stringify(backup, null, 2)],
    { type: 'application/json;charset=utf-8' }
  );

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = 'Amharic_Hymn_Studio_Project_Backup.json';

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
