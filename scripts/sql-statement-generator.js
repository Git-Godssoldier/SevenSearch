// SQL Statement Generator
// This script generates properly formatted SQL statements for manual execution in Supabase SQL Editor

const fs = require('fs');
const path = require('path');
const copyPaste = require('copy-paste');

// Load the combined SQL file
const sqlFilePath = path.join(__dirname, '..', 'migrations', 'combined_tables.sql');

// Function to format SQL for display
function formatSqlForDisplay(sql) {
  // Remove any existing comments
  let formattedSql = sql.replace(/--.*$/gm, '');
  
  // Add spacing around SQL syntax elements for better readability
  formattedSql = formattedSql
    .replace(/\s*CREATE\s+/gi, '\n\nCREATE ')
    .replace(/\s*ALTER\s+/gi, '\n\nALTER ')
    .replace(/\s*DROP\s+/gi, '\n\nDROP ')
    .replace(/\s*CREATE\s+OR\s+REPLACE\s+/gi, '\n\nCREATE OR REPLACE ')
    .replace(/\s*CREATE\s+POLICY\s+/gi, '\n\nCREATE POLICY ')
    .replace(/\s*CREATE\s+INDEX\s+/gi, '\n\nCREATE INDEX ')
    .replace(/\s*CREATE\s+TRIGGER\s+/gi, '\n\nCREATE TRIGGER ')
    .replace(/;/g, ';\n');
  
  // Split by semicolon to get individual statements
  const statements = formattedSql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);
  
  // Format each statement with numbering
  const numberedStatements = statements.map((stmt, index) => 
    `-- Statement ${index + 1} of ${statements.length}\n${stmt};`
  );
  
  return numberedStatements.join('\n\n');
}

// Function to split SQL into multiple parts if it's too large
function splitSqlIntoChunks(sql, maxChunkSize = 15000) {
  // Split by semicolon to get individual statements
  const statements = sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);
  
  const chunks = [];
  let currentChunk = '';
  
  for (const statement of statements) {
    const statementWithSemicolon = statement + ';';
    
    if (currentChunk.length + statementWithSemicolon.length > maxChunkSize) {
      chunks.push(currentChunk);
      currentChunk = statementWithSemicolon;
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + statementWithSemicolon;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
}

// Function to organize SQL by table
function organizeSqlByTable(sql) {
  // Regular expressions to identify different types of statements
  const createTableRegex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(?:public\.)?([a-zA-Z0-9_]+)/i;
  const alterTableRegex = /ALTER\s+TABLE\s+(?:public\.)?([a-zA-Z0-9_]+)/i;
  const createPolicyRegex = /CREATE\s+POLICY\s+\w+\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)/i;
  const createIndexRegex = /CREATE\s+INDEX\s+\w+\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)/i;
  const createTriggerRegex = /CREATE\s+TRIGGER\s+\w+\s+(?:BEFORE|AFTER|INSTEAD\s+OF)\s+\w+\s+ON\s+(?:public\.)?([a-zA-Z0-9_]+)/i;
  
  // Split SQL into individual statements
  const statements = sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0)
    .map(stmt => stmt + ';'); // Add semicolon back
  
  // Group statements by table
  const tableStatements = {};
  const otherStatements = [];
  
  for (const statement of statements) {
    let tableName = null;
    
    // Try to extract table name using various regex patterns
    const createMatch = statement.match(createTableRegex);
    const alterMatch = statement.match(alterTableRegex);
    const policyMatch = statement.match(createPolicyRegex);
    const indexMatch = statement.match(createIndexRegex);
    const triggerMatch = statement.match(createTriggerRegex);
    
    if (createMatch) tableName = createMatch[1];
    else if (alterMatch) tableName = alterMatch[1];
    else if (policyMatch) tableName = policyMatch[1];
    else if (indexMatch) tableName = indexMatch[1];
    else if (triggerMatch) tableName = triggerMatch[1];
    
    if (tableName) {
      if (!tableStatements[tableName]) {
        tableStatements[tableName] = [];
      }
      tableStatements[tableName].push(statement);
    } else {
      otherStatements.push(statement);
    }
  }
  
  // Format the output by table
  let result = '';
  
  for (const [tableName, statements] of Object.entries(tableStatements)) {
    result += `-- Table: ${tableName}\n\n`;
    result += statements.join('\n\n');
    result += '\n\n';
  }
  
  if (otherStatements.length > 0) {
    result += '-- Other statements\n\n';
    result += otherStatements.join('\n\n');
  }
  
  return result;
}

// Main function
function main() {
  try {
    console.log('======================================');
    console.log('SQL Statement Generator for Supabase');
    console.log('======================================');
    
    // Check if the SQL file exists
    if (!fs.existsSync(sqlFilePath)) {
      console.error(`SQL file not found at ${sqlFilePath}`);
      process.exit(1);
    }
    
    // Read the SQL file
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    console.log(`Read SQL file: ${sqlFilePath}`);
    
    // Format SQL by table
    const formattedByTable = organizeSqlByTable(sql);
    
    // Format SQL for better readability
    const formattedSql = formatSqlForDisplay(sql);
    
    // Split SQL into chunks if needed
    const chunks = splitSqlIntoChunks(formattedSql);
    
    // Create output directory
    const outputDir = path.join(__dirname, '..', 'migrations', 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write formatted SQL files
    const byTablePath = path.join(outputDir, 'sql_by_table.sql');
    fs.writeFileSync(byTablePath, formattedByTable);
    console.log(`SQL organized by table written to: ${byTablePath}`);
    
    const formattedPath = path.join(outputDir, 'formatted_sql.sql');
    fs.writeFileSync(formattedPath, formattedSql);
    console.log(`Formatted SQL written to: ${formattedPath}`);
    
    // Write SQL chunks if there are multiple
    if (chunks.length > 1) {
      console.log(`SQL split into ${chunks.length} chunks for easier execution:`);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunkPath = path.join(outputDir, `part_${i + 1}_of_${chunks.length}.sql`);
        fs.writeFileSync(chunkPath, chunks[i]);
        console.log(`  - Chunk ${i + 1} written to: ${chunkPath}`);
      }
    }
    
    // Copy the first chunk to clipboard for convenience
    if (copyPaste) {
      try {
        copyPaste.copy(chunks[0], () => {
          console.log('First SQL chunk copied to clipboard! You can now paste it into the Supabase SQL Editor.');
        });
      } catch (clipboardError) {
        console.log('Could not copy to clipboard. You can manually copy from the output files.');
      }
    }
    
    console.log('\nInstructions:');
    console.log('1. Log in to your Supabase Dashboard');
    console.log('2. Navigate to the SQL Editor');
    console.log('3. Paste the SQL from the clipboard or from the generated files');
    console.log('4. Click "Run" to execute the SQL statements');
    console.log('\nIf using multiple chunks, execute them in order (part_1, part_2, etc.)');
    
  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  }
}

// Check if copy-paste module is available
try {
  require.resolve('copy-paste');
} catch (e) {
  console.warn('The copy-paste package is not installed. Clipboard functionality will be disabled.');
  console.warn('If you want to enable clipboard functionality, run: npm install copy-paste');
  copyPaste = null;
}

// Run the main function
main();