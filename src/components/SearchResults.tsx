import { SearchResult } from '@/lib/mastra/types';

interface SearchResultsProps {
  results: SearchResult[];
  isLoading: boolean;
}

export default function SearchResults({ results, isLoading }: SearchResultsProps) {
  if (isLoading) {
    return <p className="text-center">Loading...</p>;
  }

  if (results.length === 0) {
    return <p className="text-center">No results found.</p>;
  }

  return (
    <div className="space-y-4">
      {results.map((result, index) => (
        <div key={index} className="p-4 border rounded-lg">
          <h2 className="text-xl font-bold">
            <a href={result.url} target="_blank" rel="noopener noreferrer">
              {result.title}
            </a>
          </h2>
          <p className="text-sm text-gray-500">{result.source}</p>
          <p className="mt-2">{result.snippet}</p>
        </div>
      ))}
    </div>
  );
}
