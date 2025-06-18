# Mastra vNext Event Streaming System

This directory contains the implementation of the Mastra vNext event streaming system for Q Search. This system handles real-time streaming updates from workflow execution to the client UI.

## Key Components

### EventStreamWriter

The `EventStreamWriter` class is the core component that converts vNext events into client-friendly format. It:

- Transforms workflow step events into client UI events
- Handles event throttling to prevent overwhelming the client
- Provides error handling and custom event support
- Maps between vNext step IDs and client step numbers

### Event Helpers

The `createStepEventHelpers` utility creates a set of helper functions for emitting events from vNext steps, making it easier to maintain consistent event formats:

- `emitRunning`: Emit a step running event
- `emitCompleted`: Emit a step completion event
- `emitFailed`: Emit a step failure event
- `emitProgress`: Emit a progress update event
- `emitCustom`: Emit a custom event

### Client-Side Adapter

The `vnext-event-adapter.ts` module in the components directory provides utilities for the client-side to process events:

- `processStreamChunk`: Main function to process events and update UI state
- `parseStreamChunk`: Parse raw event data
- `createErrorFromChunk`: Extract error information from event chunks

## Event Types

Events can be of the following types:

- **Step Events**: Emitted during step execution (running, completed, failed)
- **Workflow Events**: Emitted for workflow status changes (started, completed, failed)
- **Branch Events**: Emitted when workflow branches are selected
- **Progress Events**: Emitted to show progress updates
- **Custom Events**: Emitted for specific events like link scraping or results found

## Usage Examples

### Emitting Events from Steps

```typescript
// In a vNext step implementation
const events = EventStreamWriter.createStepEventHelpers(emitter, 'step-id');

// Emit running status
await events.emitRunning({ message: "Starting step" });

// Emit progress
await events.emitProgress(50, "Halfway done");

// Emit custom event
await events.emitCustom(EventType.LINK_SCRAPED, { url: "https://example.com" });

// Emit completion
await events.emitCompleted({ result: "Step complete" });
```

### API Route Usage

```typescript
// In API route handler
const { readable, writable } = new TransformStream();
const streamWriter = new EventStreamWriter(writable);

// Set up event handlers
workflowRun.watch(event => {
  streamWriter.processEvent(event);
});

workflowRun.on('branch:selected', (branchEvent) => {
  streamWriter.processEvent({
    type: 'branch',
    payload: branchEvent
  });
});

// Return the stream to the client
return new StreamingTextResponse(readable);
```

## Testing

Use the provided testing utilities to verify the event system:

- `test-event-stream.ts`: Generate test events
- `test-event-adapter.ts`: Test client-side event processing

Run the test scripts with:

```bash
# Generate test events
npx ts-node src/lib/mastra-vnext-utils/test-event-stream.ts

# Test client-side adapter
npx ts-node src/components/test-event-adapter.ts
```