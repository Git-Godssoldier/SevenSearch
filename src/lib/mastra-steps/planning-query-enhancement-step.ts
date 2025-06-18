import { z } from 'zod';
import { createStep, type WorkflowContext } from '../mastra-types';
import { GoogleGenerativeAI } from '@google/generative-ai';
import {
  PlanningInputSchema,
  PlanningAndEnhancedQueryOutputSchema,
  type StreamChunkOutputSchema
} from '../mastra-schemas';

/**
 * Planning and Query Enhancement Step
 * 
 * Uses Gemini Pro to analyze queries, enhance them for better search results,
 * and create structured research plans with sub-questions.
 */
export const planningAndQueryEnhancementStep = createStep({
  name: 'PlanningAndQueryEnhancementStep',
  inputSchema: PlanningInputSchema,
  outputSchema: PlanningAndEnhancedQueryOutputSchema,
  async execute({ data, context }: { data: z.infer<typeof PlanningInputSchema>, context: WorkflowContext }) {
    const { originalQuery } = data;
    const { GEMINI_API_KEY, pushUpdateToClient, searchId, userId } = context;

    console.log(`[MastraStep: ${this.name}] Started for searchId: ${searchId}, query: "${originalQuery}"`);
    pushUpdateToClient({
      step: 1, 
      type: 'planning_started',
      payload: { query: originalQuery },
    });

    // Validate API key
    if (!GEMINI_API_KEY) {
      console.error(`[MastraStep: ${this.name}] Missing GEMINI_API_KEY`);
      pushUpdateToClient({
        step: 1, 
        type: 'error',
        payload: { message: 'Missing Gemini API key required for query enhancement' },
        error: true,
        errorType: 'missing_api_key',
      });
      
      // Return simplified enhancement as fallback
      return createSimplifiedEnhancement(originalQuery);
    }

    // For very simple queries, skip enhancement
    if (isSimpleQuery(originalQuery)) {
      console.log(`[MastraStep: ${this.name}] Query "${originalQuery}" is simple, skipping enhancement`);
      
      pushUpdateToClient({
        step: 1,
        type: 'planning_completed',
        payload: { 
          enhancedQuery: originalQuery,
          subQuestionsCount: 0,
          simplified: true
        },
      });
      
      return {
        enhancedQuery: originalQuery,
        subQuestions: [],
        researchPlan: `Direct search for: ${originalQuery}`
      };
    }

    // Setup Gemini client
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({
      model: "gemini-pro",
      systemInstruction: generateSystemPrompt(originalQuery)
    });

    try {
      // Configure generation parameters
      const generationConfig = {
        temperature: 0.3,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 1024,
        responseMimeType: "application/json"
      };

      // Define expected response schema
      const jsonSchema = {
        type: "object",
        properties: {
          enhancedQuery: { type: "string" },
          subQuestions: { 
            type: "array", 
            items: { type: "string" } 
          },
          researchPlan: { type: "string" },
          complexity: { type: "number" }
        },
        required: ["enhancedQuery", "subQuestions", "researchPlan"]
      };

      // Create a chat session to ensure structured response
      const chatSession = model.startChat({
        generationConfig,
        safetySettings: [],
      } as any);

      // Create the user query message
      const userMessage = generateUserMessage(originalQuery);
      
      // Execute the request with retry logic
      let result;
      let retryCount = 0;
      const MAX_RETRIES = 2;
      
      while (retryCount <= MAX_RETRIES) {
        try {
          result = await chatSession.sendMessage(userMessage);
          break; // Success, exit retry loop
        } catch (error) {
          retryCount++;
          console.error(`[MastraStep: ${this.name}] Retry ${retryCount}/${MAX_RETRIES}: ${error}`);
          
          if (retryCount > MAX_RETRIES) {
            throw error; // Max retries reached
          }
          
          // Wait before retrying
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
        }
      }
      
      if (!result) {
        throw new Error('Failed to get response from Gemini after multiple retries');
      }
      
      const responseText = result.response.text();

      // Parse JSON response
      let parsedResponse;
      try {
        // Try to parse the entire text as JSON
        parsedResponse = JSON.parse(responseText);
      } catch (parseError) {
        // If that fails, try to extract JSON using regex
        try {
          const jsonMatch = responseText.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            parsedResponse = JSON.parse(jsonMatch[0]);
          } else {
            throw new Error('No valid JSON found in response');
          }
        } catch (extractError) {
          console.error(`[MastraStep: ${this.name}] Error extracting JSON:`, extractError);
          throw parseError; // Re-throw original error
        }
      }

      // Validate parsed response has required fields
      if (!parsedResponse || !parsedResponse.enhancedQuery || !Array.isArray(parsedResponse.subQuestions)) {
        throw new Error('Invalid response structure from Gemini');
      }

      console.log(`[MastraStep: ${this.name}] Enhanced query: "${parsedResponse.enhancedQuery}"`);
      
      // Send update to client
      pushUpdateToClient({
        step: 1,
        type: 'planning_completed',
        payload: { 
          enhancedQuery: parsedResponse.enhancedQuery,
          subQuestionsCount: parsedResponse.subQuestions.length,
          complexity: parsedResponse.complexity || calculateQueryComplexity(originalQuery)
        },
      });

      return {
        enhancedQuery: parsedResponse.enhancedQuery,
        subQuestions: parsedResponse.subQuestions,
        researchPlan: parsedResponse.researchPlan,
        complexity: parsedResponse.complexity || calculateQueryComplexity(originalQuery)
      };
    } catch (error) {
      console.error(`[MastraStep: ${this.name}] Error during query enhancement:`, error);
      
      pushUpdateToClient({
        step: 1,
        type: 'error',
        payload: { 
          message: 'Failed to enhance query',
          error: error instanceof Error ? error.message : String(error)
        },
        error: true,
        errorType: 'gemini_error',
      });

      // Return a fallback result using simplified enhancement
      return createSimplifiedEnhancement(originalQuery);
    }
  },
});

/**
 * Generate system prompt tailored to query characteristics
 */
function generateSystemPrompt(query: string): string {
  // Detect query type to customize prompt
  const isResearchQuery = /research|study|analysis|investigate|explore|examine/i.test(query);
  const isTechnicalQuery = /code|programming|software|hardware|algorithm|technology|implementation/i.test(query);
  const isHealthQuery = /health|medical|disease|symptom|treatment|medicine|doctor|hospital/i.test(query);
  const isHistoricalQuery = /history|historical|ancient|century|period|era|timeline/i.test(query);
  
  // Build domain-specific additions to prompt
  let domainSpecificGuidance = '';
  
  if (isResearchQuery) {
    domainSpecificGuidance += `
- Focus on identifying key research concepts, methodologies, and terminology
- Consider search modifiers like "research paper", "study", "journal", "meta-analysis"
- Sub-questions should address different aspects of the research topic
`;
  }
  
  if (isTechnicalQuery) {
    domainSpecificGuidance += `
- Include relevant technical terminology, frameworks, and libraries
- Consider version numbers, programming languages, and platforms
- Add specific error messages or technical identifiers if applicable
- Sub-questions should address implementation details, alternatives, and debugging
`;
  }
  
  if (isHealthQuery) {
    domainSpecificGuidance += `
- Focus on medical terminology and authoritative sources
- Consider adding search modifiers for reliable sources like .gov or .edu
- Clearly differentiate between symptoms, conditions, and treatments
- Sub-questions should address diagnosis, treatment options, and prevention
`;
  }
  
  if (isHistoricalQuery) {
    domainSpecificGuidance += `
- Include specific time periods, dates, locations, and historical figures
- Consider search modifiers like "primary source", "historical account", "archive"
- Sub-questions should address different time periods, perspectives, or aspects
`;
  }
  
  // Build the core system prompt
  const basePrompt = `You are an expert Search Query Optimization Specialist and Research Planner. Your task is to:

1. Analyze the user's query to understand their real information need
2. Formulate a precise, effective enhanced search query
3. Break down complex queries into 3-5 specific sub-questions
4. Create a strategic research plan with clear steps
5. Assess query complexity on a scale from 0.1 to 1.0

The enhanced query should:
- Be concise yet comprehensive (typically 5-15 words)
- Include essential keywords and modifiers
- Remove unnecessary filler words
- Add domain-specific terminology when appropriate
- Use advanced search operators when helpful (site:, filetype:, etc.)
- Be optimized for web search

${domainSpecificGuidance}

For the subQuestions:
- Create 2-5 specific sub-questions that would help build a comprehensive answer
- Focus on different aspects of the main query
- Ensure each sub-question is directly relevant
- Make sub-questions clear and concise

For the research plan:
- Outline 3-5 specific steps or areas to investigate
- Prioritize the most relevant sources or information types
- Identify potential challenges or areas requiring deeper investigation
- Consider alternative perspectives or approaches
- Be specific to the query domain

For complexity:
- Rate from 0.1 (very simple) to 1.0 (highly complex)
- Base on factors like abstractness, domain specificity, potential for multiple interpretations, etc.

Provide your response in JSON format with these fields:
- enhancedQuery: The optimized search query
- subQuestions: Array of specific sub-questions
- researchPlan: A strategic plan with clear steps
- complexity: A number from 0.1 to 1.0 indicating query complexity`;

  return basePrompt;
}

/**
 * Generate user message based on query type
 */
function generateUserMessage(query: string): string {
  // Base message
  let message = `Please analyze this query and provide an enhanced version for web search, along with sub-questions and a research plan: "${query}"`;
  
  // For longer queries, add clarification to focus on key concepts
  if (query.length > 80) {
    message += "\n\nThis is a complex query, so please focus on extracting key concepts and organizing a structured approach.";
  }
  
  // For multi-part queries, add clarification
  if (query.includes("?") && query.split("?").length > 2) {
    message += "\n\nNote that this query contains multiple questions. Please incorporate all aspects into your enhanced query or split them logically into sub-questions.";
  }
  
  return message;
}

/**
 * Check if query is too simple to warrant enhancement
 */
function isSimpleQuery(query: string): boolean {
  // Skip enhancement for very short or simple queries
  if (query.length < 5) return true;
  
  // Words count check (1-2 word queries are often simple)
  const wordCount = query.split(/\s+/).filter(word => word.length > 0).length;
  if (wordCount <= 2 && query.length < 20) return true;
  
  // Simple questions like "what is X"
  if (/^(what is|who is|when is|where is|how to|define)\s+\w+\??$/i.test(query)) return true;
  
  return false;
}

/**
 * Create simplified query enhancement as fallback
 */
function createSimplifiedEnhancement(query: string): z.infer<typeof PlanningAndEnhancedQueryOutputSchema> {
  // Simple enhancements
  let enhancedQuery = query.trim();
  
  // Remove filler words
  enhancedQuery = enhancedQuery.replace(/\b(the|a|an|and|or|but|to|with|is|are|was|were|in|on|at|for|of)\b/gi, ' ');
  
  // Remove excessive whitespace
  enhancedQuery = enhancedQuery.replace(/\s+/g, ' ').trim();
  
  // Add quotes if phrase search would be beneficial
  const words = enhancedQuery.split(/\s+/);
  if (words.length >= 3 && words.length <= 5 && !enhancedQuery.includes('"')) {
    enhancedQuery = `"${enhancedQuery}"`;
  }
  
  // Calculate query complexity
  const complexity = calculateQueryComplexity(query);
  
  // Generate sub-questions for complex queries
  const subQuestions = generateSubQuestions(query, complexity);
  
  return {
    enhancedQuery: enhancedQuery || query, // Fallback to original if empty
    subQuestions,
    researchPlan: `Search for information about ${query} from multiple reliable sources.`
  };
}

/**
 * Calculate query complexity based on multiple factors
 */
function calculateQueryComplexity(query: string): number {
  let complexity = 0.3; // Base complexity
  
  // Length factor
  const length = query.length;
  complexity += length > 100 ? 0.3 : length > 50 ? 0.2 : length > 20 ? 0.1 : 0;
  
  // Word count factor
  const wordCount = query.split(/\s+/).length;
  complexity += wordCount > 15 ? 0.2 : wordCount > 8 ? 0.1 : 0;
  
  // Question complexity
  const questionWords = (query.match(/\b(how|why|what|where|when|who|which)\b/gi) || []).length;
  complexity += questionWords > 1 ? 0.2 : questionWords > 0 ? 0.1 : 0;
  
  // "How" and "Why" questions tend to be more complex
  complexity += /\b(how|why)\b/i.test(query) ? 0.1 : 0;
  
  // Presence of comparison indicators
  complexity += /\b(compare|versus|vs\.?|difference|similarities|better|worse|pros|cons)\b/i.test(query) ? 0.2 : 0;
  
  // Presence of abstract or conceptual terms
  complexity += /\b(philosophy|concept|theory|meaning|purpose|ethics|moral|implications|impact|effect)\b/i.test(query) ? 0.2 : 0;
  
  // Technical or specialized vocabulary
  complexity += /\b(algorithm|implementation|framework|methodology|protocol|architecture|infrastructure)\b/i.test(query) ? 0.2 : 0;
  
  // Cap complexity at 1.0
  return Math.min(1.0, complexity);
}

/**
 * Generate simplified sub-questions if needed
 */
function generateSubQuestions(query: string, complexity: number): string[] {
  // Only generate sub-questions for moderately complex queries
  if (complexity < 0.5) return [];
  
  const subQuestions: string[] = [];
  
  // Try to extract entities and concepts
  const words = query.split(/\s+/).filter(w => w.length > 3);
  
  // If there are multiple entities or concepts, create sub-questions about them
  if (words.length >= 4) {
    // Focus on the main entity
    const mainEntity = words[0];
    subQuestions.push(`What is ${mainEntity}?`);
    
    // Add definition question for second entity if present
    if (words.length > 4) {
      const secondEntity = words[Math.floor(words.length / 2)];
      if (secondEntity !== mainEntity) {
        subQuestions.push(`What is ${secondEntity}?`);
      }
    }
    
    // Add relation question
    if (words.length > 5) {
      subQuestions.push(`How are ${words[0]} and ${words[Math.floor(words.length / 2)]} related?`);
    }
  }
  
  // For very complex queries, add more structured questions
  if (complexity > 0.7) {
    // Add a question about history/background
    subQuestions.push(`What is the history or background of ${words[0]}?`);
    
    // Add a question about advantages/disadvantages
    subQuestions.push(`What are the advantages and disadvantages of ${words[0]}?`);
  }
  
  return subQuestions.slice(0, 3); // Limit to at most 3 sub-questions
}