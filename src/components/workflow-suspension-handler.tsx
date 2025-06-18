'use client';

import { useState, useEffect } from 'react';
import { HumanReviewInteraction } from '@/components/ui/human-review-interaction';

interface WorkflowSuspensionHandlerProps {
  searchId: string;
  onResume: () => void;
}

export function WorkflowSuspensionHandler({ 
  searchId, 
  onResume 
}: WorkflowSuspensionHandlerProps) {
  // State for suspension details
  const [suspensionData, setSuspensionData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Check if workflow is suspended
  useEffect(() => {
    const checkSuspensionStatus = async () => {
      if (!searchId) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`/api/resume-workflow?searchId=${searchId}`);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to check workflow status');
        }
        
        const data = await response.json();
        
        if (data.suspended) {
          setSuspensionData({
            stepId: data.stepId,
            suspendData: data.suspendData
          });
        }
      } catch (err) {
        console.error('Error checking workflow suspension:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred');
      } finally {
        setIsLoading(false);
      }
    };
    
    checkSuspensionStatus();
  }, [searchId]);
  
  // Handle submission of human review
  const handleSubmitReview = async (selectedIndices: number[], additionalInstructions: string) => {
    if (!suspensionData) return;
    
    try {
      const response = await fetch('/api/resume-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          searchId,
          stepId: suspensionData.stepId,
          resumeData: {
            selectedResultIndices: selectedIndices,
            additionalInstructions: additionalInstructions || undefined,
            resumedAt: new Date().toISOString()
          }
        })
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to resume workflow');
      }
      
      // Clear suspension data and notify parent
      setSuspensionData(null);
      onResume();
      
    } catch (err) {
      console.error('Error resuming workflow:', err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred');
    }
  };
  
  // Handle cancellation
  const handleCancel = async () => {
    // Use default selections from the suggested values
    if (suspensionData && suspensionData.suspendData.suggestedSelection) {
      await handleSubmitReview(
        suspensionData.suspendData.suggestedSelection,
        'Use default selection'
      );
    } else {
      // Just close the UI if no suggested selections
      setSuspensionData(null);
      onResume();
    }
  };
  
  // If not suspended or after handling, render nothing
  if (!suspensionData) return null;
  
  // Show error if any
  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-300 rounded-md mx-auto max-w-xl my-4">
        <h3 className="text-red-800 font-medium">Error</h3>
        <p className="text-red-600">{error}</p>
        <button 
          className="mt-2 bg-red-100 hover:bg-red-200 text-red-800 px-4 py-2 rounded-md text-sm"
          onClick={() => setError(null)}
        >
          Dismiss
        </button>
      </div>
    );
  }
  
  // Show loading state
  if (isLoading) {
    return (
      <div className="p-4 bg-blue-50 border border-blue-300 rounded-md mx-auto max-w-xl my-4">
        <p className="text-blue-800">Checking workflow status...</p>
      </div>
    );
  }
  
  // Show human review interaction if the suspended step is human-review
  if (suspensionData.stepId === 'human-review') {
    return (
      <HumanReviewInteraction
        searchId={searchId}
        stepId={suspensionData.stepId}
        suspendData={suspensionData.suspendData}
        onSubmit={handleSubmitReview}
        onCancel={handleCancel}
      />
    );
  }
  
  // Generic suspension message for other step types
  return (
    <div className="p-4 bg-yellow-50 border border-yellow-300 rounded-md mx-auto max-w-xl my-4">
      <h3 className="text-yellow-800 font-medium">Workflow Suspended</h3>
      <p className="text-yellow-700">
        This workflow is currently suspended at step &quot;{suspensionData.stepId}&quot;.
      </p>
      <button 
        className="mt-2 bg-yellow-100 hover:bg-yellow-200 text-yellow-800 px-4 py-2 rounded-md text-sm"
        onClick={handleCancel}
      >
        Continue with defaults
      </button>
    </div>
  );
}

export default WorkflowSuspensionHandler;