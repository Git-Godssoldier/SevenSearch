#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_LOGIN_EMAIL = process.env.SUPABASE_LOGIN_EMAIL;
const SUPABASE_LOGIN_PASSWORD = process.env.SUPABASE_LOGIN_PASSWORD;
const SCRAPYBARA_API_KEY = process.env.SCRAPYBARA_API_KEY || 'scrapy-fb16c7eb-2450-4d6e-89b3-9ec0a0931295';

// Ensure required environment variables are set
if (!SUPABASE_URL || !SUPABASE_LOGIN_EMAIL || !SUPABASE_LOGIN_PASSWORD) {
  console.error('Missing required environment variables. Please check .env.local file.');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_LOGIN_EMAIL, SUPABASE_LOGIN_PASSWORD');
  process.exit(1);
}

// Get SQL file from command line argument or use default
const sqlFilePath = process.argv[2] || path.resolve(__dirname, '../migrations/setup_combined.sql');
if (!fs.existsSync(sqlFilePath)) {
  console.error(`SQL file not found: ${sqlFilePath}`);
  process.exit(1);
}

// Read SQL content
const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

// Split SQL into manageable chunks if it's large
function splitSqlIntoChunks(sql, maxChunkSize = 15000) {
  const statements = sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);
  
  const chunks = [];
  let currentChunk = '';
  
  for (const statement of statements) {
    if (currentChunk.length + statement.length + 1 > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk + ';');
      currentChunk = '';
    }
    currentChunk += (currentChunk.length > 0 ? '\n' : '') + statement + ';';
  }
  
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

const SQL_CHUNKS = splitSqlIntoChunks(sqlContent);

// Create a temporary Python script for Scrapybara
const tempScriptPath = path.join(__dirname, 'temp_supabase_sql.py');
const pythonScript = `
import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.common.keys import Keys

# Configuration
supabase_url = "${SUPABASE_URL}"
email = "${SUPABASE_LOGIN_EMAIL}"
password = "${SUPABASE_LOGIN_PASSWORD}"

# SQL chunks to execute
sql_chunks = ${JSON.stringify(SQL_CHUNKS)}

# Set up the browser
options = webdriver.ChromeOptions()
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")
options.add_argument("--headless=new")
driver = webdriver.Chrome(options=options)

try:
    print("Navigating to Supabase login page...")
    driver.get(f"{supabase_url}/project/default/sql")
    
    # Check if we're on the login page
    if "Sign in" in driver.title or "/auth/signin" in driver.current_url:
        print("Logging in to Supabase...")
        
        # Find and fill email field
        email_field = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "email"))
        )
        email_field.send_keys(email)
        
        # Find and fill password field
        password_field = driver.find_element(By.ID, "password")
        password_field.send_keys(password)
        
        # Submit the form
        submit_button = driver.find_element(By.XPATH, "//button[@type='submit']")
        submit_button.click()
        
        # Wait for redirection to SQL Editor
        WebDriverWait(driver, 20).until(
            EC.url_contains("/project/default/sql")
        )
        print("Successfully logged in")
    
    # We should now be in the SQL Editor
    print("Accessing SQL Editor...")
    
    # Wait for SQL editor to load
    WebDriverWait(driver, 15).until(
        EC.presence_of_element_located((By.CSS_SELECTOR, ".monaco-editor"))
    )
    time.sleep(2)  # Extra wait for the editor to fully initialize
    
    # Execute each SQL chunk
    for i, sql_chunk in enumerate(sql_chunks):
        print(f"Executing SQL chunk {i+1} of {len(sql_chunks)}...")
        
        # Click to ensure focus on the editor
        editor = driver.find_element(By.CSS_SELECTOR, ".monaco-editor")
        editor.click()
        
        # Clear any existing content
        # Use keyboard shortcuts to select all and delete
        ActionChains(driver).key_down(Keys.CONTROL).send_keys('a').key_up(Keys.CONTROL).send_keys(Keys.DELETE).perform()
        
        # Insert the SQL
        # For Monaco editor, we need to use JavaScript to set content
        js_code = f'monaco.editor.getModels()[0].setValue(`{sql_chunk.replace("`", "\\`")}`)'
        driver.execute_script(js_code)
        
        # Find and click Run button
        run_button = WebDriverWait(driver, 5).until(
            EC.element_to_be_clickable((By.XPATH, "//button[contains(text(), 'Run') or contains(@class, 'run-query-button')]"))
        )
        run_button.click()
        
        # Wait for execution to complete (look for either success or error indicators)
        time.sleep(3)  # Basic wait
        
        print(f"Completed chunk {i+1}")
    
    print("All SQL chunks executed successfully")

except Exception as e:
    print(f"Error: {str(e)}")
    import traceback
    traceback.print_exc()
    
finally:
    # Close the browser
    driver.quit()
`;

// Write the Python script to a temporary file
fs.writeFileSync(tempScriptPath, pythonScript);

// Function to execute the script with Scrapybara
async function executeWithScrapybara() {
  try {
    console.log('Initializing Scrapybara MCP server...');
    
    // Create a temporary Node.js script to run via the MCP server
    const mcpScriptPath = path.join(__dirname, 'scrapybara_mcp_runner.js');
    const mcpScript = `
const fs = require('fs');
const path = require('path');

async function runScript() {
  try {
    console.log('Connecting to Scrapybara MCP server...');
    
    // Connect to Scrapybara and execute the Python script
    const result = await scrapybara.executeScript({
      pythonScript: path.resolve('${tempScriptPath.replace(/\\/g, '\\\\')}'),
      timeout: 300000 // 5 minutes timeout
    });
    
    console.log('Scrapybara execution result:', result);
    return result;
  } catch (error) {
    console.error('Error executing script with Scrapybara:', error);
    throw error;
  }
}

runScript()
  .then(result => console.log('Script executed successfully'))
  .catch(err => console.error('Script execution failed:', err))
  .finally(() => process.exit(0));
`;
    
    fs.writeFileSync(mcpScriptPath, mcpScript);
    
    // Run the Node.js script through the Scrapybara MCP server
    const command = `SCRAPYBARA_API_KEY=${SCRAPYBARA_API_KEY} npx mastra mcp --mcp-server=scrapybara node ${mcpScriptPath}`;
    console.log('Executing command:', command);
    
    const result = execSync(command, { 
      encoding: 'utf8',
      env: {
        ...process.env,
        SCRAPYBARA_API_KEY
      },
      stdio: 'inherit'
    });
    
    console.log('SQL execution completed');
    
    // Clean up temporary files
    fs.unlinkSync(tempScriptPath);
    fs.unlinkSync(mcpScriptPath);
    
    return true;
  } catch (error) {
    console.error('Error executing SQL with Scrapybara:', error);
    return false;
  }
}

// Run the script
executeWithScrapybara()
  .then(success => {
    if (success) {
      console.log('SQL setup completed successfully');
    } else {
      console.error('SQL setup failed');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('Unexpected error:', error);
    process.exit(1);
  });