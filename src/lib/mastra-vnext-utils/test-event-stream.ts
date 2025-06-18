/**
 * Test Event Stream Utility
 * 
 * This script helps test the event stream implementation for Mastra vNext integration.
 * Run with: ts-node test-event-stream.ts
 */

import { EventStreamWriter, EventType } from './stream-events';
import { createStep, createWorkflow, Mastra } from '@mastra/core';
import { ConsoleLogger } from '@mastra/loggers';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';

/**
 * Generate simulated events and write them to a file for testing
 */
async function generateTestEvents() {
  // Create an output stream to capture events
  const outputFile = path.join(__dirname, 'test-events.jsonl');
  const outputStream = fs.createWriteStream(outputFile);
  
  // Create a promise that resolves when the file is closed
  const streamClosed = new Promise<void>((resolve) => {
    outputStream.on('close', () => {
      resolve();
    });
  });
  
  // Create a TransformStream wrapper around the fs write stream
  const writable = new WritableStream({
    write(chunk) {
      return new Promise<void>((resolve, reject) => {
        outputStream.write(chunk, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    },
    close() {
      return new Promise<void>((resolve) => {
        outputStream.end(() => {
          console.log(`Events written to ${outputFile}`);
          resolve();
        });
      });
    }
  });
  
  // Create an event writer
  const eventWriter = new EventStreamWriter(writable);
  
  console.log(`Generating test events...`);
  
  // Simulate sending workflow events
  await eventWriter.sendWorkflowStarted("What is the capital of France?", "test-search-123");
  
  // Create mock step events
  const mockEnhancingStep = {
    type: 'watch',
    payload: {
      currentStep: {
        id: 'planning-query-enhancement',
        status: 'running',
        payload: { 
          query: "What is the capital of France?"
        }
      }
    },
    eventTimestamp: new Date()
  };
  
  const mockEnhancingCompleteStep = {
    type: 'watch',
    payload: {
      currentStep: {
        id: 'planning-query-enhancement',
        status: 'completed',
        payload: { 
          enhancedQuery: "capital of France",
          subQuestionsCount: 3,
          complexity: 0.4
        }
      }
    },
    eventTimestamp: new Date()
  };
  
  const mockSearchingStep = {
    type: 'watch',
    payload: {
      currentStep: {
        id: 'exa-search',
        status: 'running',
        payload: { 
          query: "capital of France"
        }
      }
    },
    eventTimestamp: new Date()
  };
  
  const mockSearchingCompleteStep = {
    type: 'watch',
    payload: {
      currentStep: {
        id: 'exa-search',
        status: 'completed',
        payload: { 
          results: [
            { url: "https://example.com/paris", title: "Paris - Capital of France" }
          ],
          resultCount: 1
        }
      }
    },
    eventTimestamp: new Date()
  };
  
  const mockReadingStep = {
    type: 'watch',
    payload: {
      currentStep: {
        id: 'scrape-webpage',
        status: 'running',
        payload: { 
          link: "https://example.com/paris",
          status: "started"
        }
      }
    },
    eventTimestamp: new Date()
  };
  
  const mockReadingCompleteStep = {
    type: 'watch',
    payload: {
      currentStep: {
        id: 'scrape-webpage',
        status: 'completed',
        payload: { 
          link: "https://example.com/paris",
          contentBlocks: 3,
          status: "completed"
        }
      }
    },
    eventTimestamp: new Date()
  };
  
  const mockSummaryStep = {
    type: 'watch',
    payload: {
      currentStep: {
        id: 'summary-step',
        status: 'running',
        payload: { 
          message: "Generating final summary..."
        }
      }
    },
    eventTimestamp: new Date()
  };
  
  const mockSummaryCompleteStep = {
    type: 'watch',
    payload: {
      currentStep: {
        id: 'summary-step',
        status: 'completed',
        payload: { 
          message: "Summary generation completed",
          generationComplete: true
        }
      }
    },
    eventTimestamp: new Date()
  };
  
  // Simulate branch selection event
  const mockBranchEvent = {
    type: 'branch',
    payload: {
      branchId: 'standard',
      condition: 'isSimpleQuery',
      result: true
    }
  };
  
  // Simulate progress events
  const mockProgressEvent = {
    type: 'progress',
    payload: {
      step: 'scrape-webpage',
      progress: 50,
      message: 'Halfway through scraping content'
    }
  };
  
  // Simulate custom events
  const mockCustomEvent = {
    type: 'custom',
    payload: {
      eventType: EventType.LINK_SCRAPED,
      data: {
        url: 'https://example.com/paris',
        status: 'completed',
        contentCount: 3
      },
      step: 'scrape-webpage'
    }
  };
  
  // Send events in sequence with small delays to simulate real execution
  await eventWriter.processEvent(mockEnhancingStep);
  await new Promise(resolve => setTimeout(resolve, 100));
  
  await eventWriter.processEvent(mockEnhancingCompleteStep);
  await new Promise(resolve => setTimeout(resolve, 200));
  
  await eventWriter.processEvent(mockBranchEvent);
  await new Promise(resolve => setTimeout(resolve, 100));
  
  await eventWriter.processEvent(mockSearchingStep);
  await new Promise(resolve => setTimeout(resolve, 300));
  
  await eventWriter.processEvent(mockProgressEvent);
  await new Promise(resolve => setTimeout(resolve, 200));
  
  await eventWriter.processEvent(mockSearchingCompleteStep);
  await new Promise(resolve => setTimeout(resolve, 200));
  
  await eventWriter.processEvent(mockReadingStep);
  await new Promise(resolve => setTimeout(resolve, 500));
  
  await eventWriter.processEvent(mockCustomEvent);
  await new Promise(resolve => setTimeout(resolve, 100));
  
  await eventWriter.processEvent(mockReadingCompleteStep);
  await new Promise(resolve => setTimeout(resolve, 300));
  
  await eventWriter.processEvent(mockSummaryStep);
  await new Promise(resolve => setTimeout(resolve, 400));
  
  await eventWriter.processEvent(mockSummaryCompleteStep);
  await new Promise(resolve => setTimeout(resolve, 200));
  
  await eventWriter.sendWorkflowCompleted("test-search-123", {
    enhancedQuery: "capital of France",
    searchPath: "standard",
    generationComplete: true
  });
  
  // Close the writer to flush all events
  await eventWriter.close();
  
  // Wait for the file to be closed
  await streamClosed;
  
  console.log(`Done generating test events. To test parsing, run: cat ${outputFile} | node -e "process.stdin.pipe(process.stdout)"`);
}

// Run the test generator
generateTestEvents().catch(console.error);