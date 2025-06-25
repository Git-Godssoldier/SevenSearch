"use client";

import { useEffect, useState, useRef } from "react";
import {
  Loader2,
  ExternalLink,
  Search,
  BookOpen,
  Sparkles,
  Wand2, AlertCircle, XCircle
} from "lucide-react";
import { StreamButton } from "@/components/ui/stream-button"
import { quary } from "@/lib/clientCache"
import { useRouter } from "next/navigation"; // Use next/navigation for app router
import {
  processStreamChunk,
  parseStreamChunk,
  createErrorFromChunk
} from "@/components/vnext-event-adapter";

interface SearchResultsProps {
  searchId: string;
}

interface SearchStep {
  type: "enhancing" | "searching" | "reading" | "wrapping";
  content?: string;
  sources?: Array<{
    name: string;
    url: string;
  }>;
  enhancedQuery?: string;
  link?: string;
  contentBlocks?: number;
  summary?: string;
  error?: string;
  message?: string;
  enhancedQueryLoaded?: boolean;
  readingLinks?: Array<{
    name: string;
    url: string;
  }>;
  wrappingLoading?: boolean;
  streamUrl?: string;  // Add this line
}

interface SearchData {
  id: string;
  user_id?: string;
  query: string;
  enhanced_query?: string;
  sources: string | string[];
  summary: string;
  created_at?: string;
  completed_at?: string;
  completed: boolean;
}
function ErrorAlert({ message, onClose }: { message: string, onClose: () => void }) {
  return (
    <div className="relative bg-primary/10 border border-primary/20 rounded-lg p-4 mb-6 shadow-sm transition-all duration-200">
      <div className="flex items-start">
        <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center mr-3">
          <AlertCircle className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <h3 className="font-medium text-primary">Search Error</h3>
          <p className="text-sm text-primary/90 mt-1">{message}</p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-primary/70 hover:text-primary transition-colors duration-150 rounded-full h-8 w-8 flex items-center justify-center hover:bg-primary/10"
          >
            <XCircle className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
type SourceItem = string | { link: string };

export function SearchResults({ searchId }: SearchResultsProps) {
  const router = useRouter(); // Add router instance
  const [steps, setSteps] = useState<SearchStep[]>([
    { type: "enhancing", enhancedQueryLoaded: false },
  ]);
  const [isLoading, setIsLoading] = useState(true);
  const [result, setResult] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [enhancedQuery, setEnhancedQuery] = useState<string | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [answerLoading, setAnswerLoading] = useState(false);
  const [quickData, setQuickData] = useState<SearchData | null>(null);
  const [checkCompleted, setCheckCompleted] = useState(false);
  const [searchNotFound, setSearchNotFound] = useState(false);
  const [initialCheckComplete, setInitialCheckComplete] = useState(false);
  const [queryValue, setQueryValue] = useState<string | null>(null);
  const [error, setError] = useState<{ type: string; message: string } | null>(null);

  // Track if we've received the step 4 event
  const receivedStep4 = useRef(false);
  const isMounted = useRef(false);

  // Move the localStorage access to useEffect to ensure it only runs client-side
  useEffect(() => {
    const queryFromStorage = quary(searchId);
    setQueryValue(queryFromStorage || searchId); // Fallback to searchId if storage value is null
    setCheckCompleted(true);
  }, [searchId]);

  // First, check if the search already exists in the database
  useEffect(() => {
    if (!queryValue) return; // Don't proceed until we have a query value

    const checkIfCompleted = async () => {
      try {
        const response = await fetch(`/api/check-search?id=${searchId}`);

        if (!response.ok) {
          if (response.status === 404) {
            setQuickData(null);
            setSearchNotFound(true);
            setInitialCheckComplete(true);
            return;
          }
          throw new Error(`API returned ${response.status}`);
        }

        const data = await response.json();

        if (data && data.completed === true) {
          setQuickData(data);
          setSearchNotFound(false);
        } else {
          setQuickData(null);
          setSearchNotFound(false);
        }
        setInitialCheckComplete(true);
      } catch (error) {
        setQuickData(null);
        setSearchNotFound(false);
        setInitialCheckComplete(true);
      }
    };

    if (searchId) {
      checkIfCompleted();
    }
  }, [searchId, queryValue]);
  const dismissError = () => {
    setError(null);
  };

  // Main search logic - only runs if the previous check didn't find a completed search
  // Main search logic - only runs if the previous check didn't find a completed search
  useEffect(() => {
    if (!initialCheckComplete || !queryValue) {
      return; // Wait for the check to complete and query to be available
    }

    if (quickData) {
      setIsLoading(false);
      return;
    }

    isMounted.current = true;

    const fetchSearchData = async () => {
      try {
        // Make the API request - use the vNext endpoint
        const response = await fetch("/api/enhance-search", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ query: queryValue, searchId }),
        });

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        if (!reader) {
          console.error("Response body reader is null.");
          setError({
            type: "reader_error",
            message: "Failed to establish data stream. Please try again."
          });
          setIsLoading(false);
          return;
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) {
            setIsLoading(false);
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            if (part) {
              try {
                // Use our event adapter to parse and process chunks
                const chunk = parseStreamChunk(part);

                if (!chunk) continue;

                // Handle error messages from the server
                if (chunk.error) {
                  const errorObj = createErrorFromChunk(chunk);
                  setError(errorObj);

                  // We only need to handle authentication_failed now
                  if (chunk.errorType === "authentication_failed") {
                    setTimeout(() => {
                      router.push('/');
                    }, 2000);
                  }

                  setIsLoading(false);
                  return; // Stop processing the stream
                }

                // Use our adapter to process the event
                processStreamChunk(
                  chunk,
                  steps,
                  setSteps,
                  currentStep,
                  setCurrentStep,
                  enhancedQuery,
                  setEnhancedQuery,
                  setResult,
                  setAnswerLoading,
                  setShowAnswer,
                  receivedStep4,
                  setError
                );
              } catch (e) {
                console.error("Error processing stream chunk:", e, part);
              }
            }
          }
        }
      } catch (error) {
        console.error("Error fetching search data:", error);
        setError({
          type: "fetch_error",
          message: "Failed to connect to search service. Please try again later."
        });
        setIsLoading(false);
      }
    };

    fetchSearchData();

    // Cleanup function
    return () => {
      isMounted.current = false;
    };
  }, [searchId, queryValue, quickData, initialCheckComplete, router, currentStep, enhancedQuery, steps]);

  const getStepIcon = (type: string, isActive: boolean, index: number) => {
    if (isActive && isLoading && index === currentStep) {
      return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
    }

    switch (type) {
      case "enhancing":
        return <Wand2 className="h-5 w-5 text-primary" />;
      case "searching":
        return <Search className="h-5 w-5 text-primary" />;
      case "reading":
        return <BookOpen className="h-5 w-5 text-secondary" />;
      case "wrapping":
        return <Sparkles className="h-5 w-5 text-primary" />;
      default:
        return null;
    }
  };

  const getStepColor = (type: string, index: number) => {
    if (index === currentStep) {
      switch (type) {
        case "enhancing":
          return "border-primary/20 bg-primary/5";
        case "searching":
          return "border-primary/20 bg-primary/5";
        case "reading":
          return "border-secondary/20 bg-secondary/5";
        case "wrapping":
          return "border-primary/20 bg-primary/5";
        default:
          return "bg-surface";
      }
    } else {
      return "bg-surface";
    }
  };

  // Show a loading state if we're still initializing
  if (!initialCheckComplete || !queryValue) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Render the cached result if we have it
  if (quickData && quickData.completed) {

    return (
      <div className="space-y-6" data-testid="search-results-container">
        <h1 className="text-3xl font-bold text-text">{quickData.query}</h1>
        <div className="card">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h2 className="text-xl font-semibold mb-4 text-text">Answer</h2>
            <div className="text-text" dangerouslySetInnerHTML={{ __html: quickData.summary }}></div>

            <div className="mt-8 pt-4 border-t border-border">
              <h3 className="text-sm font-medium mb-2 text-text">Sources</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(typeof quickData.sources === 'string'
                  ? JSON.parse(quickData.sources)
                  : quickData.sources || []).map((source: SourceItem, index: number) => {
                    const url = typeof source === 'string' ? source : source.link;

                    return (
                      <SourceCard
                        key={index}
                        name={`Source ${index + 1}`}
                        url={url}
                        color={index % 2 === 0 ? "primary" : "secondary"}
                      />
                    );
                  })}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render the search in progress view
  return (
    <div className="space-y-6" data-testid="search-results-container">
      <h1 className="text-3xl font-bold text-text">{queryValue}</h1>
      {error && (
        <ErrorAlert
          message={error.message}
          onClose={dismissError}
        />
      )}

      <div className="space-y-6 mb-8">
        {steps.map((step, index) => (
          <div
            key={index}
            className={`rounded-lg border p-4 relative ${getStepColor(
              step.type,
              index
            )}`}
          >
            <div className="flex items-start gap-4">
              <div className="mt-1 h-10 w-10 flex-shrink-0 rounded-full bg-surface flex items-center justify-center">
                {getStepIcon(step.type, index === currentStep, index)}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-medium text-text">
                    {step.type === "enhancing" && "Enhancing your search term"}
                    {step.type === "searching" && "Searching the web"}
                    {step.type === "reading" && "Reading sources"}
                    {step.type === "wrapping" && "Synthesizing information"}
                  </h3>
                  <span className="text-xs text-muted">
                    Step {index + 1} of {steps.length}
                  </span>
                </div>
                <p className="text-sm text-muted mt-1">
                  {step.type === "enhancing" &&
                    "Optimizing your query for better results"}
                  {step.type === "searching" &&
                    `Finding relevant information about "${enhancedQuery || queryValue
                    }"`}
                  {step.type === "reading" &&
                    "Analyzing content from multiple sources"}
                  {step.type === "wrapping" && "Creating a comprehensive answer"}
                </p>

                {step.type === "enhancing" &&
                  step.enhancedQueryLoaded &&
                  step.enhancedQuery && (
                    <div className="mt-4 p-3 rounded-md bg-surface border border-primary/20">
                      <p className="text-xs font-medium text-muted mb-1">
                        Enhanced search term:
                      </p>
                      <p className="text-sm font-medium text-text">{step.enhancedQuery}</p>
                    </div>
                  )}

                {step.type === "searching" && step.streamUrl && (
                  <div className="mt-4 flex justify-end">
                    <StreamButton
                      streamUrl={step.streamUrl}
                      variant="outline"
                      size="sm"
                    />
                  </div>
                )}

                {step.type === "reading" && step.readingLinks && (
                  <div className="mt-4 space-y-2">
                    <h4 className="text-xs font-medium text-muted">
                      Links:
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {step.readingLinks.map((link, linkIndex) => (
                        <SourceCard
                          key={linkIndex}
                          name={`Source ${linkIndex + 1}`}
                          url={link.url}
                          color="secondary"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {step.type === "wrapping" && step.wrappingLoading && (
                  <div className="flex justify-center mt-4">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {showAnswer && (
        <div className="card" data-testid="search-results-container">
          <div className="prose prose-sm dark:prose-invert max-w-none">
            <h2 className="text-xl font-semibold mb-4 text-text">Answer</h2>
            {answerLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="text-text" dangerouslySetInnerHTML={{ __html: result || '' }}></div>
            )}

            {!answerLoading && result && (
              <div className="mt-8 pt-4 border-t border-border">
                <h3 className="text-sm font-medium mb-2 text-text">Sources</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {steps
                    .find(step => step.type === "reading")
                    ?.readingLinks?.map((link, index) => (
                      <SourceCard
                        key={index}
                        name={`Source ${index + 1}`}
                        url={link.url}
                        color={index % 2 === 0 ? "primary" : "secondary"}
                      />
                    ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SourceCard({
  name,
  url,
  color = "primary",
}: {
  name: string;
  url: string;
  color?: "primary" | "secondary";
}) {
  const getColorClass = () => {
    switch (color) {
      case "primary":
        return "bg-primary/10 text-primary";
      case "secondary":
        return "bg-secondary/10 text-secondary";
      default:
        return "bg-primary/10 text-primary";
    }
  };

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 p-3 rounded-lg bg-surface hover:bg-surface-2 transition-colors duration-200 border border-border"
    >
      <div className={`h-8 w-8 rounded-md ${getColorClass()} flex items-center justify-center`}>
        <ExternalLink className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate text-text">{name}</p>
        <p className="text-xs text-muted truncate">{url}</p>
      </div>
    </a>
  );
}
