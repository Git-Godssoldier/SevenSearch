/**
 * Mastra vNext Utilities
 *
 * Export all vNext utilities from a central file for easier imports
 */

// Import event streaming utilities first
import { EventStreamWriter, EventType } from './stream-events';

// Re-export event streaming utilities
export {
  EventStreamWriter,
  EventType
};

// Export type for client code
export interface StepMap {
  id: string;
  clientStep: number;
  clientType: string;
  description: string;
}

// Export createStepEventHelpers directly
export const createStepEventHelpers = EventStreamWriter.createStepEventHelpers;

// Export runtime context utilities
export {
  createRuntimeContext,
  createRuntimeContextFromSession
} from './runtime-context';

// Export workflow creation utilities
export { createStep } from './step';

// Export E2B Scrapybara integration utilities
export {
  ScrabybaraProcessor,
  type ExtractedContent,
  type ProcessedContent
} from './e2b-scrapybara-integration';

// Export content processing utilities
export {
  extractThinkSections,
  extractCitations,
  cleanHTML,
  removeBannersAndAds
} from './content-processing';

// Export type for client code
export type {
  StepMap
} from './stream-events';