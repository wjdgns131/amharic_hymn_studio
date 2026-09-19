import JSZip from 'jszip';

export interface MxlExtractResult {
  musicXmlContent: string;
  rootPath: string;
}

/**
 * Extracts raw MusicXML text from a compressed .mxl (ZIP container) file.
 * Strictly adheres to standard MusicXML MXL container specifications (META-INF/container.xml).
 */
export async function extractMusicXmlFromMxl(arrayBuffer: ArrayBuffer): Promise<MxlExtractResult> {
  let zip: JSZip;
  
  // 1. Open ZIP Archive
  try {
    zip = await JSZip.loadAsync(arrayBuffer);
  } catch (err: any) {
    throw new Error('Failed to open .mxl file. The file appears to be a corrupted or invalid ZIP archive.');
  }

  // 2. Locate META-INF/container.xml
  let containerFile = zip.file('META-INF/container.xml');
  if (!containerFile) {
    // Try case-insensitive fallback search
    const foundKey = Object.keys(zip.files).find(
      key => key.toLowerCase() === 'meta-inf/container.xml'
    );
    if (foundKey) {
      containerFile = zip.file(foundKey);
    }
  }

  if (!containerFile) {
    throw new Error("Invalid MXL container structure: Missing 'META-INF/container.xml' inside the archive.");
  }

  // 3. Read and Parse container.xml to locate rootfile path
  const containerXmlText = await containerFile.async('string');
  const domParser = new DOMParser();
  const containerDoc = domParser.parseFromString(containerXmlText, 'application/xml');

  if (containerDoc.querySelector('parsererror')) {
    throw new Error("Invalid MXL container structure: 'META-INF/container.xml' is corrupted.");
  }

  const rootfileEl = containerDoc.querySelector('rootfile[full-path]');
  const rootPath = rootfileEl?.getAttribute('full-path')?.trim();

  if (!rootPath) {
    throw new Error('Invalid MXL container structure: No valid <rootfile full-path="..."> entry found in container.xml.');
  }

  // 4. Locate and Extract the referenced MusicXML document
  let xmlFile = zip.file(rootPath);
  if (!xmlFile) {
    // Try normalized path match
    const normalizedRoot = rootPath.replace(/\\/g, '/');
    const foundKey = Object.keys(zip.files).find(
      key => key.replace(/\\/g, '/').toLowerCase() === normalizedRoot.toLowerCase()
    );
    if (foundKey) {
      xmlFile = zip.file(foundKey);
    }
  }

  if (!xmlFile) {
    throw new Error(`MXL container error: Referenced MusicXML file '${rootPath}' not found inside the ZIP archive.`);
  }

  // 5. Extract UTF-8 MusicXML text
  const musicXmlContent = await xmlFile.async('string');

  // 6. Validate extracted MusicXML XML syntax
  const xmlDoc = domParser.parseFromString(musicXmlContent, 'application/xml');
  if (xmlDoc.querySelector('parsererror')) {
    throw new Error(`Invalid MusicXML content inside '${rootPath}': Document is not valid XML.`);
  }

  return {
    musicXmlContent,
    rootPath
  };
}
