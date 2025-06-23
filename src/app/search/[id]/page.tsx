"src/app/search/[id]/page.tsx"
import { Suspense } from "react"
import { SearchHeader } from "@/components/search-header"
import { SimpleSearchResults } from "@/components/simple-search-results"
import { getSearchById } from "@/lib/storage"
import { auth } from "@/lib/auth"
interface SearchPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function SearchPage({ params }: SearchPageProps) {
  const { id } = await params
  // Authentication is optional; allow anonymous users to view results
  const session = await auth().catch(() => null);
  const userId = session?.user?.id ?? "anonymous";

  // Try to get the search from the database, but don't fail if table doesn't exist
  try {
    await getSearchById(id, userId);
  } catch (error) {
    console.log('Search page: Database error (table may not exist):', error);
    // Continue without search data - the component will handle fetching
  }

  // Don't call notFound() - let the SimpleSearchResults component handle data fetching
  // This allows the page to load even when the database table doesn't exist

  return (
    <main className="flex min-h-screen flex-col">
      <SearchHeader pageid={id} />
      <div data-testid="search-results-container" className="flex-1 container max-w-4xl mx-auto px-4 py-6">
        <Suspense fallback={<SearchLoadingSkeleton />}>
          <SimpleSearchResults searchId={id} />
        </Suspense>
      </div>
    </main>
  )
}

function SearchLoadingSkeleton() {
  return (
    <div className="space-y-4 mt-4">
      <div className="h-6 w-full max-w-md bg-muted rounded animate-pulse"></div>
      <div className="space-y-2">
        <div className="h-4 w-full bg-muted rounded animate-pulse"></div>
        <div className="h-4 w-5/6 bg-muted rounded animate-pulse"></div>
        <div className="h-4 w-4/6 bg-muted rounded animate-pulse"></div>
      </div>
    </div>
  )
}
