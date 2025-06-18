import { EventStreamWriter } from '../mastra-vnext-utils/stream-events';
import { E2BTestRunner, createE2BTestRunner } from './e2b-test-runner';
import { EventEmitter } from 'events';

/**
 * Event Stream Test Suite
 * Tests the EventStreamWriter and event handling functionality
 */
export class EventStreamTests {
  private e2bRunner: E2BTestRunner;
  private events: EventEmitter;
  private capturedEvents: any[] = [];

  constructor(e2bApiKey: string) {
    this.e2bRunner = createE2BTestRunner(e2bApiKey);
    this.events = new EventEmitter();
    
    // Capture all events for verification
    this.events.on('watch', (event) => {
      this.capturedEvents.push(event);
    });
    
    this.events.on('workflow', (event) => {
      this.capturedEvents.push(event);
    });
    
    this.events.on('branch', (event) => {
      this.capturedEvents.push(event);
    });
    
    this.events.on('custom', (event) => {
      this.capturedEvents.push(event);
    });
  }

  /**
   * Reset captured events
   */
  resetEvents() {
    this.capturedEvents = [];
  }

  /**
   * Get captured events
   */
  getCapturedEvents() {
    return [...this.capturedEvents];
  }

  /**
   * Test EventStreamWriter basic functionality
   */
  async testEventStreamWriter() {
    const testCode = `
      // Test event stream writer creation and basic functionality
      const eventStreamWriter = new EventStreamWriter();
      
      // Test converting step event to update
      const stepEvent = {
        type: 'watch',
        payload: {
          currentStep: {
            id: 'test-step',
            status: 'running',
            payload: { message: 'Test message' }
          }
        },
        eventTimestamp: new Date()
      };
      
      const update = eventStreamWriter.convertEventToUpdate(stepEvent);
      
      if (!update) {
        throw new Error('Failed to convert step event to update');
      }
      
      if (update.step !== 1) {
        throw new Error('Step number not correctly identified');
      }
      
      if (update.type !== 'status') {
        throw new Error('Update type not correctly identified');
      }
      
      return "Event stream writer basic functionality test passed";
    `;
    
    return await this.e2bRunner.runTest(testCode);
  }

  /**
   * Test event helper creation
   */
  async testEventHelpers() {
    const writer = new EventStreamWriter();
    const stepId = 'test-step';
    
    // Create event helpers
    const events = EventStreamWriter.createStepEventHelpers(this.events, stepId);
    
    // Test running event
    await events.emitRunning({ message: 'Step started' });
    
    // Test progress event
    await events.emitProgress(50, 'Half done');
    
    // Test custom event
    await events.emitCustom('test_event', { value: 123 });
    
    // Test completed event
    await events.emitCompleted({ message: 'Step completed' });
    
    // Verify events were captured
    const runningEvent = this.capturedEvents.find(
      e => e.type === 'watch' && e.payload?.currentStep?.status === 'running'
    );
    
    const progressEvent = this.capturedEvents.find(
      e => e.type === 'watch' && e.payload?.currentStep?.payload?.progress === 50
    );
    
    const customEvent = this.capturedEvents.find(
      e => e.type === 'custom' && e.payload?.event === 'test_event'
    );
    
    const completedEvent = this.capturedEvents.find(
      e => e.type === 'watch' && e.payload?.currentStep?.status === 'completed'
    );
    
    const failingTests = [];
    
    if (!runningEvent) failingTests.push('Running event not captured');
    if (!progressEvent) failingTests.push('Progress event not captured');
    if (!customEvent) failingTests.push('Custom event not captured');
    if (!completedEvent) failingTests.push('Completed event not captured');
    
    if (failingTests.length > 0) {
      throw new Error(`Event helpers test failed: ${failingTests.join(', ')}`);
    }
    
    return {
      success: true,
      message: 'Event helpers test passed',
      eventCount: this.capturedEvents.length
    };
  }
  
  /**
   * Run all tests
   */
  async runAllTests() {
    try {
      await this.e2bRunner.initialize();
      
      const results = [];
      
      // Test EventStreamWriter
      const writerResult = await this.testEventStreamWriter();
      results.push({ name: 'EventStreamWriter', ...writerResult });
      
      // Test event helpers
      this.resetEvents();
      try {
        const helpersResult = await this.testEventHelpers();
        results.push({ 
          name: 'EventHelpers', 
          success: true,
          output: JSON.stringify(helpersResult),
          executionTime: 0
        });
      } catch (error) {
        results.push({ 
          name: 'EventHelpers', 
          success: false,
          output: '',
          error: error instanceof Error ? error.message : String(error),
          executionTime: 0
        });
      }
      
      return results;
    } finally {
      await this.e2bRunner.close();
    }
  }
}

/**
 * Run the event stream tests
 * @param e2bApiKey E2B API key
 */
export async function runEventStreamTests(e2bApiKey: string) {
  const tests = new EventStreamTests(e2bApiKey);
  return await tests.runAllTests();
}

export default runEventStreamTests;