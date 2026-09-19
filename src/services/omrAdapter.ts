import type { OmrMetadata } from '../types/hymn';

/**
 * Audiveris OMR Adapter Interface for Amharic Hymn Studio.
 * Designed for local execution via Windows desktop sidecar (Tauri / Python backend).
 */
export interface AudiverisConversionOptions {
  pdfFilePath: string;
  outputDir?: string;
  exportFormat?: 'mxl' | 'musicxml';
}

export interface AudiverisConversionResult {
  success: boolean;
  musicXmlContent?: string;
  outputFilePath?: string;
  errorMessage?: string;
  omrMetadata?: OmrMetadata;
}

export class AudiverisOmrAdapter {
  private static instance: AudiverisOmrAdapter;

  private constructor() {}

  public static getInstance(): AudiverisOmrAdapter {
    if (!AudiverisOmrAdapter.instance) {
      AudiverisOmrAdapter.instance = new AudiverisOmrAdapter();
    }
    return AudiverisOmrAdapter.instance;
  }

  /**
   * Checks if native desktop sidecar / CLI execution is available in current environment.
   * Browser-only React frontend returns false for security compliance.
   */
  public isNativeCliAvailable(): boolean {
    // In React/Vite web environment, native process execution is restricted for security.
    // Native execution will be enabled once Tauri sidecar or Python backend is connected.
    return false;
  }

  /**
   * Helper method outlining the Audiveris CLI execution command structure for Windows:
   * Example CLI command: `Audiveris -batch -export -output <outDir> <pdfPath>`
   */
  public getCliCommandTemplate(pdfPath: string, outputDir: string): string {
    return `Audiveris -batch -export -output "${outputDir}" "${pdfPath}"`;
  }
}

