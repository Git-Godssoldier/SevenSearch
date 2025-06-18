/**
 * Streaming utilities for Mastra vNext workflows
 */

// Polyfill for ai's StreamingTextResponse when using older versions
export class StreamingTextResponse extends Response {
  constructor(stream: ReadableStream, init?: ResponseInit) {
    const headers = new Headers(init?.headers);
    headers.set('Content-Type', 'text/plain; charset=utf-8');
    
    super(stream, {
      ...init,
      status: init?.status ?? 200,
      headers
    });
  }
  
  static fromReadableStream(stream: ReadableStream, init?: ResponseInit): StreamingTextResponse {
    return new StreamingTextResponse(stream, init);
  }
  
  static fromText(text: string, init?: ResponseInit): StreamingTextResponse {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(text));
        controller.close();
      }
    });
    
    return new StreamingTextResponse(stream, init);
  }
}

/**
 * Create a readable stream from an async generator
 */
export function createReadableStreamFromAsyncGenerator<T>(
  generator: AsyncGenerator<T, void, unknown>
): ReadableStream {
  return new ReadableStream({
    async pull(controller) {
      try {
        const { value, done } = await generator.next();
        
        if (done) {
          controller.close();
          return;
        }
        
        if (typeof value === 'string') {
          controller.enqueue(new TextEncoder().encode(value));
        } else if (value instanceof Uint8Array) {
          controller.enqueue(value);
        } else {
          controller.enqueue(
            new TextEncoder().encode(JSON.stringify(value))
          );
        }
      } catch (error) {
        controller.error(error);
      }
    }
  });
}