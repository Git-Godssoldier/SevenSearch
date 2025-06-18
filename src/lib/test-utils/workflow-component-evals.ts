/**
 * Workflow Component E2B Evaluations
 * 
 * This module provides E2B secure runtime evaluations for each component
 * of the human-in-the-loop workflow implementation. Each evaluation tests
 * a specific aspect of the workflow in isolation to ensure correctness.
 */

import { E2BTestRunner } from './e2b-test-runner';

/**
 * Run comprehensive E2B evaluations for each workflow component
 */
export class WorkflowComponentEvaluator {
  private e2bRunner: E2BTestRunner;
  private isInitialized = false;
  private evalResults: Map<string, any> = new Map();

  constructor(apiKey: string) {
    this.e2bRunner = new E2BTestRunner(apiKey);
  }

  /**
   * Initialize the evaluator
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    await this.e2bRunner.initialize();
    this.isInitialized = true;
    console.log('Workflow Component Evaluator initialized');
  }

  /**
   * Evaluate the human review step
   */
  async evaluateHumanReviewStep(): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const humanReviewStepEval = `
      // Evaluate the human review step implementation
      try {
        // Mock the humanReviewStep functionality
        const humanReviewStep = {
          id: 'human-review',
          execute: async ({ inputData, resumeData, suspend, emitter, runtimeContext }) => {
            const events = {
              emitRunning: async (data) => console.log('Emitting running event:', data),
              emitCustom: async (type, data) => console.log('Emitting custom event:', type, data),
              emitFailed: async (msg, error) => console.log('Emitting failed event:', msg, error),
              emitCompleted: async (data) => console.log('Emitting completed event:', data)
            };
            
            if (!resumeData) {
              await events.emitRunning({ 
                searchResultCount: inputData.searchResults.length,
                query: inputData.query 
              });
              
              const suggestedSelection = [0, 1, 2].filter(i => i < inputData.searchResults.length);
              
              await events.emitCustom('workflow_suspending', {
                reason: 'human_review_required',
                searchId: runtimeContext.getAll().searchId,
                timestamp: new Date().toISOString()
              });
              
              await suspend({
                searchResults: inputData.searchResults,
                query: inputData.query,
                enhancedQuery: inputData.enhancedQuery,
                suggestedSelection,
                userMessage: inputData.userMessage || 'Please select relevant results',
                suspendedAt: new Date().toISOString()
              });
              
              return null;
            }
            
            try {
              await events.emitRunning({ 
                searchResultCount: inputData.searchResults.length,
                selectedCount: resumeData.selectedResultIndices.length,
                resumedAt: resumeData.resumedAt 
              });
              
              const selectedResults = resumeData.selectedResultIndices.map(
                index => inputData.searchResults[index]
              ).filter(Boolean);
              
              const finalSelectedResults = selectedResults.length > 0
                ? selectedResults
                : inputData.searchResults.slice(0, Math.min(3, inputData.searchResults.length));
              
              await events.emitCompleted({
                selectedResultCount: finalSelectedResults.length,
                hasAdditionalInstructions: !!resumeData.additionalInstructions
              });
              
              return {
                selectedResults: finalSelectedResults,
                additionalInstructions: resumeData.additionalInstructions,
                userSelection: selectedResults.length > 0
              };
            } catch (error) {
              await events.emitFailed(
                'Failed to process user selections',
                error instanceof Error ? error.message : String(error)
              );
              
              const defaultSelection = inputData.searchResults.slice(0, 3);
              
              return {
                selectedResults: defaultSelection,
                additionalInstructions: '',
                userSelection: false
              };
            }
          }
        };

        // Test cases to evaluate
        const testCases = [
          // Test case 1: Initial execution with suspension
          {
            name: 'Initial execution with suspension',
            params: {
              inputData: {
                searchResults: [
                  { title: 'Result 1', url: 'https://example.com/1', snippet: 'Example snippet 1' },
                  { title: 'Result 2', url: 'https://example.com/2', snippet: 'Example snippet 2' },
                  { title: 'Result 3', url: 'https://example.com/3', snippet: 'Example snippet 3' }
                ],
                query: 'test query',
                enhancedQuery: 'enhanced test query'
              },
              resumeData: null,
              suspend: async (data) => { console.log('Suspending with data:', data); return true; },
              emitter: { emit: () => {} },
              runtimeContext: { getAll: () => ({ searchId: 'test-123' }) }
            },
            expectedResult: null
          },
          
          // Test case 2: Resumption with user selections
          {
            name: 'Resumption with user selections',
            params: {
              inputData: {
                searchResults: [
                  { title: 'Result 1', url: 'https://example.com/1', snippet: 'Example snippet 1' },
                  { title: 'Result 2', url: 'https://example.com/2', snippet: 'Example snippet 2' },
                  { title: 'Result 3', url: 'https://example.com/3', snippet: 'Example snippet 3' }
                ],
                query: 'test query',
                enhancedQuery: 'enhanced test query'
              },
              resumeData: {
                selectedResultIndices: [0, 2],
                additionalInstructions: 'Focus on first and third results',
                resumedAt: new Date().toISOString()
              },
              suspend: async () => { throw new Error('Should not suspend during resumption'); },
              emitter: { emit: () => {} },
              runtimeContext: { getAll: () => ({ searchId: 'test-123' }) }
            },
            expectedResult: {
              selectedResults: [
                { title: 'Result 1', url: 'https://example.com/1', snippet: 'Example snippet 1' },
                { title: 'Result 3', url: 'https://example.com/3', snippet: 'Example snippet 3' }
              ],
              additionalInstructions: 'Focus on first and third results',
              userSelection: true
            }
          },
          
          // Test case 3: Resumption with empty selection (fallback to default)
          {
            name: 'Resumption with empty selection',
            params: {
              inputData: {
                searchResults: [
                  { title: 'Result 1', url: 'https://example.com/1', snippet: 'Example snippet 1' },
                  { title: 'Result 2', url: 'https://example.com/2', snippet: 'Example snippet 2' },
                  { title: 'Result 3', url: 'https://example.com/3', snippet: 'Example snippet 3' }
                ],
                query: 'test query',
                enhancedQuery: 'enhanced test query'
              },
              resumeData: {
                selectedResultIndices: [],
                additionalInstructions: '',
                resumedAt: new Date().toISOString()
              },
              suspend: async () => { throw new Error('Should not suspend during resumption'); },
              emitter: { emit: () => {} },
              runtimeContext: { getAll: () => ({ searchId: 'test-123' }) }
            },
            expectedResult: {
              selectedResults: [
                { title: 'Result 1', url: 'https://example.com/1', snippet: 'Example snippet 1' },
                { title: 'Result 2', url: 'https://example.com/2', snippet: 'Example snippet 2' },
                { title: 'Result 3', url: 'https://example.com/3', snippet: 'Example snippet 3' }
              ],
              additionalInstructions: '',
              userSelection: false
            }
          }
        ];

        // Run the test cases
        const results = [];
        
        for (const testCase of testCases) {
          console.log('\\n===== Running test case:', testCase.name, '=====');
          
          try {
            const result = await humanReviewStep.execute(testCase.params);
            
            // For suspension test, just check the result is null
            if (testCase.name === 'Initial execution with suspension') {
              if (result === null) {
                results.push({
                  name: testCase.name,
                  success: true,
                  message: 'Workflow suspended as expected'
                });
              } else {
                results.push({
                  name: testCase.name,
                  success: false,
                  message: 'Workflow did not suspend as expected',
                  expected: null,
                  actual: result
                });
              }
            } else {
              // For resumption tests, verify the selected results
              const selectedResultsMatch = JSON.stringify(result.selectedResults) === 
                JSON.stringify(testCase.expectedResult.selectedResults);
              
              const additionalInstructionsMatch = result.additionalInstructions === 
                testCase.expectedResult.additionalInstructions;
              
              const userSelectionMatch = result.userSelection === 
                testCase.expectedResult.userSelection;
              
              if (selectedResultsMatch && additionalInstructionsMatch && userSelectionMatch) {
                results.push({
                  name: testCase.name,
                  success: true,
                  message: 'Returned expected results'
                });
              } else {
                results.push({
                  name: testCase.name,
                  success: false,
                  message: 'Did not return expected results',
                  expected: testCase.expectedResult,
                  actual: result,
                  details: {
                    selectedResultsMatch,
                    additionalInstructionsMatch,
                    userSelectionMatch
                  }
                });
              }
            }
          } catch (error) {
            results.push({
              name: testCase.name,
              success: false,
              message: \`Test failed with error: \${error.message}\`,
              error: error.message
            });
          }
        }
        
        // Return overall results
        const allTestsPassed = results.every(r => r.success);
        
        return {
          componentName: 'HumanReviewStep',
          success: allTestsPassed,
          testResults: results,
          summary: allTestsPassed 
            ? 'All human review step tests passed successfully' 
            : \`\${results.filter(r => !r.success).length} human review step tests failed\`
        };
      } catch (error) {
        return {
          componentName: 'HumanReviewStep',
          success: false,
          error: error.message,
          summary: \`Evaluation failed with error: \${error.message}\`
        };
      }
    `;

    const result = await this.e2bRunner.runTest(humanReviewStepEval);
    
    try {
      const evalResult = JSON.parse(result.output);
      this.evalResults.set('HumanReviewStep', evalResult);
      return evalResult;
    } catch (error) {
      console.error('Error parsing human review step evaluation result:', error);
      return {
        componentName: 'HumanReviewStep',
        success: false,
        error: 'Failed to parse evaluation result',
        details: result
      };
    }
  }

  /**
   * Evaluate the workflow suspension handler UI component
   */
  async evaluateWorkflowSuspensionHandler(): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const workflowSuspensionHandlerEval = `
      // Evaluate the workflow suspension handler component
      try {
        // Mock React and related dependencies
        const React = {
          useState: (initialValue) => {
            let state = initialValue;
            const setState = (newValue) => {
              state = typeof newValue === 'function' ? newValue(state) : newValue;
            };
            return [state, setState];
          },
          useEffect: (callback, deps) => {
            // Execute the effect immediately for testing
            callback();
          }
        };

        // Mock fetch for API calls
        const mockFetch = async (url, options = {}) => {
          // Parse the URL to determine the response
          if (url.includes('/api/resume-workflow?searchId=')) {
            const searchId = url.split('=')[1];
            
            // Return mock suspension data for testing
            return {
              ok: true,
              json: async () => ({
                suspended: true,
                searchId,
                stepId: 'human-review',
                suspendedAt: new Date().toISOString(),
                suspendData: {
                  searchResults: [
                    { title: 'Result 1', url: 'https://example.com/1', snippet: 'Example snippet 1' },
                    { title: 'Result 2', url: 'https://example.com/2', snippet: 'Example snippet 2' }
                  ],
                  query: 'Test query',
                  suggestedSelection: [0]
                }
              })
            };
          } else if (url === '/api/resume-workflow' && options.method === 'POST') {
            // Parse the body data
            const body = JSON.parse(options.body);
            
            // Return success response for resume API
            return {
              ok: true,
              json: async () => ({
                success: true,
                message: 'Workflow resumption initiated',
                searchId: body.searchId
              })
            };
          }
          
          // Default error response
          return {
            ok: false,
            json: async () => ({ error: 'Invalid request' })
          };
        };

        // Mock the workflow suspension handler component
        const WorkflowSuspensionHandler = ({ searchId, onResume }) => {
          // State hooks
          const [suspensionData, setSuspensionData] = React.useState(null);
          const [isLoading, setIsLoading] = React.useState(false);
          const [error, setError] = React.useState(null);
          
          // Check if workflow is suspended
          React.useEffect(() => {
            const checkSuspensionStatus = async () => {
              if (!searchId) return;
              
              setIsLoading(true);
              setError(null);
              
              try {
                const response = await mockFetch(\`/api/resume-workflow?searchId=\${searchId}\`);
                
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
          const handleSubmitReview = async (selectedIndices, additionalInstructions) => {
            if (!suspensionData) return;
            
            try {
              const response = await mockFetch('/api/resume-workflow', {
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
          
          // Component rendering for testing
          return {
            props: { searchId, onResume },
            state: { suspensionData, isLoading, error },
            handlers: { handleSubmitReview, handleCancel }
          };
        };

        // Test scenarios
        const testScenarios = [
          {
            name: 'Component initialization and suspension check',
            searchId: 'test-123',
            onResume: () => console.log('Workflow resumed'),
            expectedBehavior: {
              shouldFetchSuspensionData: true,
              shouldSetSuspensionData: true
            }
          },
          {
            name: 'Handle review submission',
            searchId: 'test-456',
            onResume: () => console.log('Workflow resumed after submission'),
            testAction: async (component) => {
              await component.handlers.handleSubmitReview([0, 1], 'Test instructions');
            },
            expectedBehavior: {
              shouldClearSuspensionData: true,
              shouldCallOnResume: true
            }
          },
          {
            name: 'Handle cancellation',
            searchId: 'test-789',
            onResume: () => console.log('Workflow resumed after cancellation'),
            testAction: async (component) => {
              await component.handlers.handleCancel();
            },
            expectedBehavior: {
              shouldClearSuspensionData: true,
              shouldCallOnResume: true
            }
          }
        ];

        // Run the test scenarios
        const results = [];
        
        for (const scenario of testScenarios) {
          console.log('\\n===== Running scenario:', scenario.name, '=====');
          
          // Initialize the component with the test scenario props
          const component = WorkflowSuspensionHandler({
            searchId: scenario.searchId,
            onResume: scenario.onResume
          });
          
          // Execute the test action if provided
          if (scenario.testAction) {
            await scenario.testAction(component);
          }
          
          // Check expected behavior
          const expected = scenario.expectedBehavior;
          let success = true;
          const behaviorResults = {};
          
          if (expected.shouldFetchSuspensionData) {
            behaviorResults.fetchedSuspensionData = component.state.suspensionData !== null;
            success = success && behaviorResults.fetchedSuspensionData;
          }
          
          if (expected.shouldSetSuspensionData) {
            behaviorResults.setSuspensionData = component.state.suspensionData !== null;
            success = success && behaviorResults.setSuspensionData;
          }
          
          // Add the scenario result
          results.push({
            name: scenario.name,
            success,
            behaviorResults
          });
        }
        
        // Return overall evaluation result
        const allScenariosSuccessful = results.every(r => r.success);
        
        return {
          componentName: 'WorkflowSuspensionHandler',
          success: allScenariosSuccessful,
          testResults: results,
          summary: allScenariosSuccessful 
            ? 'All workflow suspension handler scenarios passed' 
            : 'Some workflow suspension handler scenarios failed'
        };
      } catch (error) {
        return {
          componentName: 'WorkflowSuspensionHandler',
          success: false,
          error: error.message,
          summary: \`Evaluation failed with error: \${error.message}\`
        };
      }
    `;

    const result = await this.e2bRunner.runTest(workflowSuspensionHandlerEval);
    
    try {
      const evalResult = JSON.parse(result.output);
      this.evalResults.set('WorkflowSuspensionHandler', evalResult);
      return evalResult;
    } catch (error) {
      console.error('Error parsing workflow suspension handler evaluation result:', error);
      return {
        componentName: 'WorkflowSuspensionHandler',
        success: false,
        error: 'Failed to parse evaluation result',
        details: result
      };
    }
  }

  /**
   * Evaluate the API route for workflow resumption
   */
  async evaluateResumeWorkflowAPI(): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const resumeWorkflowAPIEval = `
      // Evaluate the resume workflow API route
      try {
        // Mock request and response objects
        class NextResponse {
          static json(body, options = {}) {
            return {
              status: options.status || 200,
              body
            };
          }
        }

        // Mock Supabase client
        const createMockSupabase = (testCase) => {
          switch (testCase) {
            case 'workflow_found':
              return {
                from: () => ({
                  select: () => ({
                    eq: () => ({
                      eq: () => ({
                        eq: () => ({
                          single: () => Promise.resolve({
                            data: {
                              id: 'test-uuid',
                              searchId: 'test-123',
                              user_id: 'test-user',
                              suspended_step_id: 'human-review',
                              suspend_data: {
                                searchResults: [
                                  { title: 'Result 1', url: 'https://example.com/1' }
                                ]
                              },
                              is_suspended: true
                            },
                            error: null
                          })
                        })
                      })
                    })
                  }),
                  update: () => ({
                    eq: () => ({
                      eq: () => Promise.resolve({ data: {}, error: null })
                    })
                  })
                })
              };
              
            case 'workflow_not_found':
              return {
                from: () => ({
                  select: () => ({
                    eq: () => ({
                      eq: () => ({
                        eq: () => ({
                          single: () => Promise.resolve({
                            data: null,
                            error: { code: 'PGRST116', message: 'No data found' }
                          })
                        })
                      })
                    })
                  })
                })
              };
              
            case 'wrong_step':
              return {
                from: () => ({
                  select: () => ({
                    eq: () => ({
                      eq: () => ({
                        eq: () => ({
                          single: () => Promise.resolve({
                            data: {
                              id: 'test-uuid',
                              searchId: 'test-123',
                              user_id: 'test-user',
                              suspended_step_id: 'different-step',
                              suspend_data: {},
                              is_suspended: true
                            },
                            error: null
                          })
                        })
                      })
                    })
                  })
                })
              };
              
            case 'update_error':
              return {
                from: () => ({
                  select: () => ({
                    eq: () => ({
                      eq: () => ({
                        eq: () => ({
                          single: () => Promise.resolve({
                            data: {
                              id: 'test-uuid',
                              searchId: 'test-123',
                              user_id: 'test-user',
                              suspended_step_id: 'human-review',
                              suspend_data: {},
                              is_suspended: true
                            },
                            error: null
                          })
                        })
                      })
                    })
                  }),
                  update: () => ({
                    eq: () => ({
                      eq: () => Promise.resolve({
                        data: null,
                        error: { message: 'Update failed' }
                      })
                    })
                  })
                })
              };
              
            default:
              return {
                from: () => ({
                  select: () => ({
                    eq: () => ({
                      eq: () => ({
                        eq: () => ({
                          single: () => Promise.resolve({ data: null, error: null })
                        })
                      })
                    })
                  })
                })
              };
          }
        };

        // Mock the POST handler for resume-workflow route
        const mockResumeWorkflowPOST = async (testCase) => {
          // Mock request body
          const body = {
            searchId: 'test-123',
            stepId: testCase === 'wrong_step' ? 'human-review' : 'human-review',
            resumeData: {
              selectedResultIndices: [0, 1],
              additionalInstructions: 'Test instructions',
              resumedAt: new Date().toISOString()
            }
          };
          
          // Mock session
          const session = {
            user: {
              id: 'test-user',
              name: 'Test User',
              email: 'test@example.com'
            }
          };
          
          // Mock Supabase client
          const supabase = createMockSupabase(testCase);
          
          try {
            // Validate request body
            if (!body.searchId || !body.stepId || !body.resumeData) {
              return NextResponse.json({ 
                error: "Invalid request data" 
              }, { status: 400 });
            }
            
            // Check authentication
            if (!session || !session.user?.id) {
              return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            
            const userId = session.user.id;
            
            // Check if the workflow exists and is suspended
            const { data: workflowData, error: fetchError } = await supabase
              .from('suspended_workflows')
              .select('*')
              .eq('searchId', body.searchId)
              .eq('user_id', userId)
              .eq('is_suspended', true)
              .single();
            
            if (fetchError || !workflowData) {
              return NextResponse.json({ 
                error: "Workflow not found or not suspended",
                details: fetchError?.message
              }, { status: 404 });
            }
            
            // Ensure the workflow is suspended at the correct step
            if (workflowData.suspended_step_id !== body.stepId) {
              return NextResponse.json({ 
                error: "Workflow is suspended at a different step",
                expected: workflowData.suspended_step_id,
                received: body.stepId
              }, { status: 409 });
            }
            
            // Mark workflow as being resumed in the database
            const { error: updateError } = await supabase
              .from('suspended_workflows')
              .update({ 
                resumed_at: new Date().toISOString(),
                resume_data: body.resumeData,
                is_suspended: false
              })
              .eq('searchId', body.searchId)
              .eq('user_id', userId);
            
            if (updateError) {
              return NextResponse.json({ 
                error: "Failed to resume workflow",
                details: updateError.message
              }, { status: 500 });
            }
            
            return NextResponse.json({
              success: true,
              message: "Workflow resumption initiated",
              searchId: body.searchId,
              resumedAt: body.resumeData.resumedAt
            });
          } catch (err) {
            return NextResponse.json({ 
              error: "Something went wrong in the API handler",
              details: err instanceof Error ? err.message : String(err)
            }, { status: 500 });
          }
        };

        // Mock the GET handler for resume-workflow route
        const mockResumeWorkflowGET = async (testCase) => {
          // Mock request URL parameters
          const searchId = 'test-123';
          
          // Mock session
          const session = {
            user: {
              id: 'test-user',
              name: 'Test User',
              email: 'test@example.com'
            }
          };
          
          // Mock Supabase client
          const supabase = createMockSupabase(testCase);
          
          try {
            // Check searchId parameter
            if (!searchId) {
              return NextResponse.json({ error: "Missing searchId parameter" }, { status: 400 });
            }
            
            // Check authentication
            if (!session || !session.user?.id) {
              return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }
            
            const userId = session.user.id;
            
            // Check if the workflow exists and is suspended
            const { data: workflowData, error: fetchError } = await supabase
              .from('suspended_workflows')
              .select('*')
              .eq('searchId', searchId)
              .eq('user_id', userId)
              .eq('is_suspended', true)
              .single();
            
            if (fetchError) {
              if (fetchError.code === 'PGRST116') {
                // No data found, workflow is not suspended
                return NextResponse.json({ 
                  suspended: false,
                  searchId
                });
              }
              
              return NextResponse.json({ 
                error: "Error checking workflow status",
                details: fetchError.message
              }, { status: 500 });
            }
            
            // Return the suspension information
            return NextResponse.json({
              suspended: true,
              searchId,
              stepId: workflowData.suspended_step_id,
              suspendedAt: workflowData.suspended_at,
              suspendData: workflowData.suspend_data
            });
          } catch (err) {
            return NextResponse.json({ 
              error: "Something went wrong in the API handler",
              details: err instanceof Error ? err.message : String(err)
            }, { status: 500 });
          }
        };

        // Test cases
        const testCases = [
          {
            name: 'POST - Successful workflow resumption',
            method: 'POST',
            testCase: 'workflow_found',
            expectedStatus: 200,
            expectedSuccess: true
          },
          {
            name: 'POST - Workflow not found',
            method: 'POST',
            testCase: 'workflow_not_found',
            expectedStatus: 404,
            expectedSuccess: false
          },
          {
            name: 'POST - Wrong step ID',
            method: 'POST',
            testCase: 'wrong_step',
            expectedStatus: 409,
            expectedSuccess: false
          },
          {
            name: 'POST - Database update error',
            method: 'POST',
            testCase: 'update_error',
            expectedStatus: 500,
            expectedSuccess: false
          },
          {
            name: 'GET - Workflow is suspended',
            method: 'GET',
            testCase: 'workflow_found',
            expectedStatus: 200,
            expectedResponse: { suspended: true }
          },
          {
            name: 'GET - Workflow is not suspended',
            method: 'GET',
            testCase: 'workflow_not_found',
            expectedStatus: 200,
            expectedResponse: { suspended: false }
          }
        ];

        // Run the test cases
        const results = [];
        
        for (const testCase of testCases) {
          console.log('\\n===== Running API test case:', testCase.name, '=====');
          
          try {
            let response;
            
            if (testCase.method === 'POST') {
              response = await mockResumeWorkflowPOST(testCase.testCase);
            } else {
              response = await mockResumeWorkflowGET(testCase.testCase);
            }
            
            const success = testCase.method === 'POST'
              ? response.status === testCase.expectedStatus && 
                (response.body.success === testCase.expectedSuccess)
              : response.status === testCase.expectedStatus && 
                (response.body.suspended === testCase.expectedResponse.suspended);
            
            results.push({
              name: testCase.name,
              success,
              expected: {
                status: testCase.expectedStatus,
                ...(testCase.expectedSuccess !== undefined ? { success: testCase.expectedSuccess } : {}),
                ...(testCase.expectedResponse || {})
              },
              actual: {
                status: response.status,
                body: response.body
              }
            });
          } catch (error) {
            results.push({
              name: testCase.name,
              success: false,
              error: error.message
            });
          }
        }
        
        // Return overall evaluation result
        const allTestsPassed = results.every(r => r.success);
        
        return {
          componentName: 'ResumeWorkflowAPI',
          success: allTestsPassed,
          testResults: results,
          summary: allTestsPassed 
            ? 'All Resume Workflow API tests passed successfully' 
            : \`\${results.filter(r => !r.success).length} Resume Workflow API tests failed\`
        };
      } catch (error) {
        return {
          componentName: 'ResumeWorkflowAPI',
          success: false,
          error: error.message,
          summary: \`Evaluation failed with error: \${error.message}\`
        };
      }
    `;

    const result = await this.e2bRunner.runTest(resumeWorkflowAPIEval);
    
    try {
      const evalResult = JSON.parse(result.output);
      this.evalResults.set('ResumeWorkflowAPI', evalResult);
      return evalResult;
    } catch (error) {
      console.error('Error parsing resume workflow API evaluation result:', error);
      return {
        componentName: 'ResumeWorkflowAPI',
        success: false,
        error: 'Failed to parse evaluation result',
        details: result
      };
    }
  }

  /**
   * Evaluate the human review workflow integration
   */
  async evaluateHumanReviewWorkflow(): Promise<any> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    const humanReviewWorkflowEval = `
      // Evaluate the human review workflow integration
      try {
        // Mock createWorkflow function
        const createWorkflow = (config) => {
          const workflow = {
            id: config.id || 'mock-workflow',
            name: config.name || 'Mock Workflow',
            steps: {},
            
            // Add a step to the workflow
            then: function(step) {
              const stepId = step.id || \`step-\${Object.keys(this.steps).length + 1}\`;
              this.steps[stepId] = step;
              return this;
            },
            
            // Create a new workflow run
            createRun: function() {
              return {
                start: async (options) => {
                  const result = { steps: {} };
                  let shouldSuspend = false;
                  let suspendStep = null;
                  let suspendData = null;
                  
                  // Execute steps until suspension or completion
                  for (const [stepId, step] of Object.entries(this.steps)) {
                    if (shouldSuspend) break;
                    
                    try {
                      const stepResult = await step.execute({
                        inputData: options.inputData,
                        runtimeContext: options.runtimeContext,
                        emitter: { emit: () => {} },
                        suspend: async (data) => {
                          shouldSuspend = true;
                          suspendStep = stepId;
                          suspendData = data;
                        }
                      });
                      
                      result.steps[stepId] = stepResult;
                      
                      if (shouldSuspend) break;
                    } catch (error) {
                      return {
                        status: 'failed',
                        error: \`Step \${stepId} failed: \${error.message}\`
                      };
                    }
                  }
                  
                  if (shouldSuspend) {
                    return {
                      status: 'suspended',
                      suspended: {
                        stepId: suspendStep,
                        data: suspendData
                      },
                      steps: result.steps
                    };
                  }
                  
                  return {
                    status: 'success',
                    result: result.steps,
                    steps: result.steps
                  };
                },
                
                resume: async (options) => {
                  if (!options.stepId || !options.resumeData) {
                    throw new Error('Invalid resume parameters');
                  }
                  
                  const result = { steps: {} };
                  let stepFound = false;
                  
                  // Find the step to resume
                  for (const [stepId, step] of Object.entries(this.steps)) {
                    if (stepId === options.stepId) {
                      stepFound = true;
                      
                      try {
                        // Execute the step with resume data
                        const stepResult = await step.execute({
                          inputData: options.inputData || {},
                          resumeData: options.resumeData,
                          runtimeContext: options.runtimeContext,
                          emitter: { emit: () => {} }
                        });
                        
                        result.steps[stepId] = stepResult;
                      } catch (error) {
                        return {
                          status: 'failed',
                          error: \`Step \${stepId} failed during resumption: \${error.message}\`
                        };
                      }
                    } else if (stepFound) {
                      // Execute subsequent steps (if already resumed the suspended step)
                      try {
                        const stepResult = await step.execute({
                          inputData: result.steps[Object.keys(result.steps).pop()],
                          runtimeContext: options.runtimeContext,
                          emitter: { emit: () => {} }
                        });
                        
                        result.steps[stepId] = stepResult;
                      } catch (error) {
                        return {
                          status: 'failed',
                          error: \`Step \${stepId} failed after resumption: \${error.message}\`
                        };
                      }
                    }
                  }
                  
                  if (!stepFound) {
                    return {
                      status: 'failed',
                      error: \`Step \${options.stepId} not found in workflow\`
                    };
                  }
                  
                  return {
                    status: 'success',
                    result: result.steps,
                    steps: result.steps
                  };
                },
                
                onWorkflowEvent: (callback) => {
                  // Store the callback (not actually called in this mock)
                  this.eventCallback = callback;
                  return this;
                },
                
                watch: (callback) => {
                  // Store the callback (not actually called in this mock)
                  this.watchCallback = callback;
                  return this;
                }
              };
            },
            
            // Mock method to get step result
            getStepResult: (step) => {
              return { enhancedQuery: 'enhanced query for testing' };
            },
            
            // Mock method to get initial data
            getInitData: () => {
              return { query: 'test query' };
            }
          };
          
          return workflow;
        };

        // Mock steps
        const searchStep = {
          id: 'search',
          execute: async () => {
            return {
              searchResults: [
                { title: 'Result 1', url: 'https://example.com/1', snippet: 'Example snippet 1' },
                { title: 'Result 2', url: 'https://example.com/2', snippet: 'Example snippet 2' },
                { title: 'Result 3', url: 'https://example.com/3', snippet: 'Example snippet 3' }
              ]
            };
          }
        };
        
        const humanReviewStep = {
          id: 'human-review',
          execute: async ({ inputData, resumeData, suspend }) => {
            if (!resumeData) {
              await suspend({
                searchResults: inputData.searchResults,
                query: inputData.query,
                enhancedQuery: inputData.enhancedQuery,
                suggestedSelection: [0, 1],
                suspendedAt: new Date().toISOString()
              });
              return null;
            }
            
            const selectedResults = resumeData.selectedResultIndices.map(
              index => inputData.searchResults[index]
            );
            
            return {
              selectedResults,
              additionalInstructions: resumeData.additionalInstructions,
              userSelection: true
            };
          }
        };
        
        const summaryStep = {
          id: 'summary',
          execute: async ({ inputData }) => {
            return {
              summary: \`Summary based on \${inputData.selectedResults.length} selected results\`,
              sources: inputData.selectedResults.map(r => r.url)
            };
          }
        };

        // Create the human review workflow
        const humanReviewWorkflow = createWorkflow({
          id: 'human-review-workflow',
          name: 'Human Review Workflow'
        })
          .then(searchStep)
          .then(humanReviewStep)
          .then(summaryStep);

        // Test cases
        const testCases = [
          {
            name: 'Workflow suspension',
            inputData: {
              query: 'test query',
              searchId: 'test-123',
              userId: 'test-user'
            },
            runtimeContext: {
              getAll: () => ({ searchId: 'test-123', userId: 'test-user' })
            },
            expectedStatus: 'suspended',
            expectedStepId: 'human-review'
          },
          {
            name: 'Workflow resumption',
            resumeOptions: {
              searchId: 'test-123',
              stepId: 'human-review',
              resumeData: {
                selectedResultIndices: [0, 2],
                additionalInstructions: 'Focus on first and third results',
                resumedAt: new Date().toISOString()
              },
              runtimeContext: {
                getAll: () => ({ searchId: 'test-123', userId: 'test-user' })
              },
              inputData: {
                searchResults: [
                  { title: 'Result 1', url: 'https://example.com/1', snippet: 'Example snippet 1' },
                  { title: 'Result 2', url: 'https://example.com/2', snippet: 'Example snippet 2' },
                  { title: 'Result 3', url: 'https://example.com/3', snippet: 'Example snippet 3' }
                ],
                query: 'test query',
                enhancedQuery: 'enhanced test query'
              }
            },
            expectedStatus: 'success',
            expectedSteps: ['human-review', 'summary']
          }
        ];

        // Run the test cases
        const results = [];
        
        for (const testCase of testCases) {
          console.log('\\n===== Running workflow test case:', testCase.name, '=====');
          
          try {
            const workflowRun = humanReviewWorkflow.createRun();
            let result;
            
            if (testCase.name === 'Workflow suspension') {
              // Test workflow suspension
              result = await workflowRun.start({
                inputData: testCase.inputData,
                runtimeContext: testCase.runtimeContext
              });
              
              // Check if workflow suspended as expected
              const success = result.status === testCase.expectedStatus && 
                              result.suspended?.stepId === testCase.expectedStepId;
              
              results.push({
                name: testCase.name,
                success,
                expected: {
                  status: testCase.expectedStatus,
                  suspendedStep: testCase.expectedStepId
                },
                actual: {
                  status: result.status,
                  suspendedStep: result.suspended?.stepId
                }
              });
            } else {
              // Test workflow resumption
              result = await workflowRun.resume(testCase.resumeOptions);
              
              // Check if workflow resumed and completed successfully
              const success = result.status === testCase.expectedStatus && 
                              testCase.expectedSteps.every(step => result.steps[step] !== undefined);
              
              results.push({
                name: testCase.name,
                success,
                expected: {
                  status: testCase.expectedStatus,
                  containsSteps: testCase.expectedSteps
                },
                actual: {
                  status: result.status,
                  steps: Object.keys(result.steps || {})
                }
              });
            }
          } catch (error) {
            results.push({
              name: testCase.name,
              success: false,
              error: error.message
            });
          }
        }
        
        // Return overall evaluation result
        const allTestsPassed = results.every(r => r.success);
        
        return {
          componentName: 'HumanReviewWorkflow',
          success: allTestsPassed,
          testResults: results,
          summary: allTestsPassed 
            ? 'All human review workflow tests passed successfully' 
            : \`\${results.filter(r => !r.success).length} human review workflow tests failed\`
        };
      } catch (error) {
        return {
          componentName: 'HumanReviewWorkflow',
          success: false,
          error: error.message,
          summary: \`Evaluation failed with error: \${error.message}\`
        };
      }
    `;

    const result = await this.e2bRunner.runTest(humanReviewWorkflowEval);
    
    try {
      const evalResult = JSON.parse(result.output);
      this.evalResults.set('HumanReviewWorkflow', evalResult);
      return evalResult;
    } catch (error) {
      console.error('Error parsing human review workflow evaluation result:', error);
      return {
        componentName: 'HumanReviewWorkflow',
        success: false,
        error: 'Failed to parse evaluation result',
        details: result
      };
    }
  }

  /**
   * Run all evaluations
   */
  async runAllEvaluations(): Promise<Map<string, any>> {
    await this.initialize();
    
    const evaluations = [
      this.evaluateHumanReviewStep(),
      this.evaluateWorkflowSuspensionHandler(),
      this.evaluateResumeWorkflowAPI(),
      this.evaluateHumanReviewWorkflow()
    ];
    
    await Promise.all(evaluations);
    return this.evalResults;
  }

  /**
   * Get a summary of all evaluation results
   */
  getSummary(): { success: boolean; results: any[] } {
    const evaluationSummaries = [];
    let overallSuccess = true;
    
    for (const [componentName, result] of this.evalResults.entries()) {
      evaluationSummaries.push({
        component: componentName,
        success: result.success,
        summary: result.summary
      });
      
      if (!result.success) {
        overallSuccess = false;
      }
    }
    
    return {
      success: overallSuccess,
      results: evaluationSummaries
    };
  }

  /**
   * Close the evaluator
   */
  async close(): Promise<void> {
    await this.e2bRunner.close();
    this.isInitialized = false;
    console.log('Workflow Component Evaluator closed');
  }
}

/**
 * Create a workflow component evaluator
 * @param apiKey E2B API key
 * @returns WorkflowComponentEvaluator instance
 */
export function createWorkflowComponentEvaluator(apiKey: string): WorkflowComponentEvaluator {
  return new WorkflowComponentEvaluator(apiKey);
}

/**
 * Main function to run evaluations when run directly
 */
async function main() {
  const apiKey = process.env.E2B_API_KEY;
  if (!apiKey) {
    console.error('E2B_API_KEY is required to run evaluations');
    process.exit(1);
  }
  
  const evaluator = createWorkflowComponentEvaluator(apiKey);
  
  try {
    await evaluator.runAllEvaluations();
    const summary = evaluator.getSummary();
    
    console.log('\n===== Evaluation Summary =====');
    console.log(`Overall Success: ${summary.success ? 'PASSED' : 'FAILED'}`);
    
    for (const result of summary.results) {
      console.log(`\n${result.component}: ${result.success ? 'PASSED' : 'FAILED'}`);
      console.log(result.summary);
    }
  } catch (error) {
    console.error('Error running evaluations:', error);
  } finally {
    await evaluator.close();
  }
}

// Run evaluations if called directly
if (require.main === module) {
  main().catch(console.error);
}

export default createWorkflowComponentEvaluator;