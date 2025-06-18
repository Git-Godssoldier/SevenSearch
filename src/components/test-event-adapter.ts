/**
 * Test Event Adapter
 * 
 * This script helps test the client-side event adapter implementation.
 * Run with: ts-node test-event-adapter.ts
 */

import fs from 'fs';
import path from 'path';
import { parseStreamChunk, createErrorFromChunk } from './vnext-event-adapter';

// Mock UI state for testing
interface UiState {
  steps: any[];
  currentStep: number;
  enhancedQuery: string | null;
  result: string | null;
  answerLoading: boolean;
  showAnswer: boolean;
  error: { type: string; message: string } | null;
}

/**
 * Simulates processing of events as they would be in the client
 */
async function testClientEventAdapter() {
  try {
    // Path to the test events file
    const eventsFile = path.join(__dirname, '../lib/mastra-vnext-utils/test-events.jsonl');
    if (!fs.existsSync(eventsFile)) {
      console.error(`Test events file not found: ${eventsFile}`);
      console.error('Run the test-event-stream.ts script first to generate test events');
      return;
    }
    
    // Read the test events
    const eventsData = fs.readFileSync(eventsFile, 'utf-8');
    const events = eventsData.split('\n').filter(Boolean);
    
    // Mock UI state
    const uiState: UiState = {
      steps: [],
      currentStep: 0,
      enhancedQuery: null,
      result: null,
      answerLoading: false,
      showAnswer: false,
      error: null
    };
    
    // Mock state update functions
    const setSteps = (steps: any[]) => {
      uiState.steps = steps;
      console.log('Updated steps:', JSON.stringify(steps, null, 2));
    };
    
    const setCurrentStep = (step: number) => {
      uiState.currentStep = step;
      console.log('Updated current step:', step);
    };
    
    const setEnhancedQuery = (query: string | null) => {
      uiState.enhancedQuery = query;
      console.log('Updated enhanced query:', query);
    };
    
    const setResult = (result: string | null) => {
      uiState.result = result;
      console.log('Updated result:', result ? `${result.substring(0, 50)}...` : null);
    };
    
    const setAnswerLoading = (loading: boolean) => {
      uiState.answerLoading = loading;
      console.log('Updated answer loading:', loading);
    };
    
    const setShowAnswer = (show: boolean) => {
      uiState.showAnswer = show;
      console.log('Updated show answer:', show);
    };
    
    const setError = (error: { type: string; message: string } | null) => {
      uiState.error = error;
      console.log('Updated error:', error);
    };
    
    // Reference to receivedStep4
    const receivedStep4 = { current: false };
    
    console.log('Testing event parsing and processing...');
    
    // Process each event
    let eventCount = 0;
    for (const eventStr of events) {
      eventCount++;
      console.log(`\nProcessing event ${eventCount}/${events.length}...`);
      
      try {
        // Parse the event
        const chunk = parseStreamChunk(eventStr);
        
        if (!chunk) {
          console.error('Failed to parse event:', eventStr);
          continue;
        }
        
        console.log('Parsed chunk:', JSON.stringify(chunk, null, 2));
        
        // Handle errors
        if (chunk.error) {
          const error = createErrorFromChunk(chunk);
          console.log('Error detected:', error);
          continue;
        }
        
        // For this test, we'll just log the chunks since we can't directly call
        // the processStreamChunk function in a non-React context
        console.log(`Event step: ${chunk.step}, type: ${chunk.type}`);
        
        // Log what would be shown to the user at this stage
        switch (chunk.step) {
          case 0:
            console.log('Workflow event', chunk.type);
            break;
          case 1:
            console.log('Enhancing query event');
            if (chunk.payload?.enhancedQuery) {
              console.log('Enhanced query:', chunk.payload.enhancedQuery);
            }
            break;
          case 2:
            console.log('Search event');
            if (chunk.type === 'branch_selected') {
              console.log('Selected branch:', chunk.payload?.branchId);
            }
            break;
          case 3:
            console.log('Reading event');
            if (chunk.payload?.link || chunk.payload?.url) {
              console.log('Reading link:', chunk.payload.link || chunk.payload.url);
            }
            break;
          case 5:
            console.log('Summary event');
            if (chunk.type === 'workflow_completed') {
              console.log('Search completed with metadata:', chunk.payload?.metadata);
            }
            break;
        }
      } catch (err) {
        console.error('Error processing event:', err);
      }
    }
    
    console.log('\nEvent processing complete. Processed', eventCount, 'events.');
  } catch (err) {
    console.error('Error testing event adapter:', err);
  }
}

// Run the test
testClientEventAdapter().catch(console.error);