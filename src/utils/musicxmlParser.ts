import type { ScoreMetadata } from '../types/hymn';

/**
 * Safely parses metadata from a MusicXML string using browser DOMParser.
 * Does NOT invent missing data; defaults to "Not provided".
 */
export function parseMusicXmlMetadata(xmlContent: string, file: File): ScoreMetadata {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlContent, 'application/xml');

  // Check for XML parsing error
  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid or corrupted XML file format.');
  }

  // 1. Title
  let title = 'Not provided';
  const workTitle = xmlDoc.querySelector('work > work-title')?.textContent?.trim();
  const movementTitle = xmlDoc.querySelector('movement-title')?.textContent?.trim();
  
  if (workTitle) {
    title = workTitle;
  } else if (movementTitle) {
    title = movementTitle;
  } else {
    // Check credit-words for title
    const creditWords = xmlDoc.querySelectorAll('credit > credit-words');
    for (let i = 0; i < creditWords.length; i++) {
      const text = creditWords[i].textContent?.trim();
      if (text && text.length > 0) {
        title = text;
        break;
      }
    }
  }

  // 2. Composer
  let composer = 'Not provided';
  const composerTag = xmlDoc.querySelector('identification > creator[type="composer"]')?.textContent?.trim();
  const genericCreator = xmlDoc.querySelector('identification > creator')?.textContent?.trim();
  
  if (composerTag) {
    composer = composerTag;
  } else if (genericCreator) {
    composer = genericCreator;
  }

  // 3. Number of Parts
  const scoreParts = xmlDoc.querySelectorAll('part-list > score-part');
  const partCount = scoreParts.length > 0 ? scoreParts.length : (xmlDoc.querySelectorAll('part').length || 1);

  // File Size Formatting
  const bytes = file.size;
  let fileSizeFormatted = `${bytes} B`;
  if (bytes >= 1024 * 1024) {
    fileSizeFormatted = `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  } else if (bytes >= 1024) {
    fileSizeFormatted = `${(bytes / 1024).toFixed(1)} KB`;
  }

  return {
    fileName: file.name,
    fileType: file.name.split('.').pop()?.toUpperCase() || 'MUSICXML',
    fileSizeFormatted,
    title,
    composer,
    partCount
  };
}
