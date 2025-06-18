'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

interface SearchResult {
  title: string;
  url: string;
  snippet?: string;
}

interface HumanReviewProps {
  searchId: string;
  stepId: string;
  suspendData: {
    searchResults: SearchResult[];
    query: string;
    enhancedQuery?: string;
    suggestedSelection: number[];
    userMessage?: string;
  };
  onSubmit: (selectedIndices: number[], additionalInstructions: string) => Promise<void>;
  onCancel: () => void;
}

export function HumanReviewInteraction({
  searchId,
  stepId,
  suspendData,
  onSubmit,
  onCancel
}: HumanReviewProps) {
  const { searchResults, query, enhancedQuery, suggestedSelection, userMessage } = suspendData;
  
  // State for selected indices
  const [selectedIndices, setSelectedIndices] = useState<number[]>(suggestedSelection || []);
  
  // State for additional instructions
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  
  // State for submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Toggle selection for a result
  const toggleSelection = (index: number) => {
    if (selectedIndices.includes(index)) {
      setSelectedIndices(selectedIndices.filter(i => i !== index));
    } else {
      setSelectedIndices([...selectedIndices, index]);
    }
  };
  
  // Handle submission
  const handleSubmit = async () => {
    if (selectedIndices.length === 0) {
      alert('Please select at least one search result');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onSubmit(selectedIndices, additionalInstructions);
    } catch (error) {
      console.error('Error submitting human review:', error);
      alert('Failed to submit your selections. Please try again.');
      setIsSubmitting(false);
    }
  };
  
  return (
    <div className="w-full max-w-3xl mx-auto">
      <Card className="p-6 mb-8 bg-white shadow-md dark:bg-gray-800">
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Human Review Required</h2>
            <Button variant="outline" size="sm" onClick={onCancel}>
              Skip
            </Button>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {userMessage || 'Please select the most relevant search results to include in your answer:'}
          </p>
          
          <div className="bg-gray-50 dark:bg-gray-900 p-3 rounded-md">
            <p className="font-medium">Original Query: <span className="font-normal">{query}</span></p>
            {enhancedQuery && <p className="font-medium mt-1">Enhanced Query: <span className="font-normal">{enhancedQuery}</span></p>}
          </div>
          
          <Separator />
          
          <div className="space-y-4 mt-4">
            <p className="font-medium">Search Results ({searchResults.length})</p>
            
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {searchResults.map((result, index) => (
                <div 
                  key={index}
                  className={`p-4 rounded-md border transition-all ${
                    selectedIndices.includes(index) 
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/30' 
                      : 'border-gray-200 dark:border-gray-700'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-medium truncate">{result.title}</h3>
                    <Switch 
                      checked={selectedIndices.includes(index)}
                      onCheckedChange={() => toggleSelection(index)}
                      id={`select-${index}`}
                    />
                  </div>
                  
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate mb-2">
                    <a href={result.url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                      {result.url}
                    </a>
                  </p>
                  
                  {result.snippet && (
                    <p className="text-sm line-clamp-3">{result.snippet}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <Separator />
          
          <div className="space-y-2">
            <Label htmlFor="instructions">Additional Instructions (Optional)</Label>
            <Input 
              id="instructions"
              placeholder="Any specific instructions you want to provide..."
              value={additionalInstructions}
              onChange={(e) => setAdditionalInstructions(e.target.value)}
            />
          </div>
          
          <div className="flex justify-end space-x-3 mt-4">
            <Button variant="outline" onClick={onCancel} disabled={isSubmitting}>
              Skip
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={selectedIndices.length === 0 || isSubmitting}
            >
              {isSubmitting ? 'Submitting...' : 'Submit Selection'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

export default HumanReviewInteraction;