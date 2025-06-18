// Simple SQL Generator - No dependencies
// This script formats the combined SQL for easy copy-paste into Supabase SQL Editor

const fs = require('fs');
const path = require('path');

// Path to combined SQL file
const sqlFilePath = path.join(__dirname, '..', 'migrations', 'combined_tables.sql');

// Function to format SQL
function formatSql(sql) {
  // Split by semicolon to get individual statements
  const statements = sql
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);
  
  // Format each statement with numbering
  const numberedStatements = statements.map((stmt, index) => 
    `-- Statement ${index + 1} of ${statements.length}\n${stmt};`
  );
  
  return numberedStatements.join('\n\n');
}

// Function to split SQL into multiple parts
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

// Main function
function main() {
  try {
    console.log('======================================');
    console.log('Simple SQL Generator for Supabase');
    console.log('======================================');
    
    // Check if the SQL file exists
    if (!fs.existsSync(sqlFilePath)) {
      console.error(`SQL file not found at ${sqlFilePath}`);
      process.exit(1);
    }
    
    // Read the SQL file
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    console.log(`Read SQL file: ${sqlFilePath}`);
    
    // Format SQL for better readability
    const formattedSql = formatSql(sql);
    
    // Split SQL into chunks if needed
    const chunks = splitSqlIntoChunks(formattedSql);
    
    // Create output directory
    const outputDir = path.join(__dirname, '..', 'migrations', 'output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Write formatted SQL file
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
    
    // Print first 1000 characters of formatted SQL
    console.log('\nPreview of formatted SQL (first 1000 chars):');
    console.log('-------------------------------------------');
    console.log(formattedSql.substring(0, 1000) + '...');
    console.log('-------------------------------------------');
    
    console.log('\nInstructions:');
    console.log('1. Log in to your Supabase Dashboard');
    console.log('2. Navigate to the SQL Editor');
    console.log('3. Copy the SQL from the generated files');
    console.log('4. Paste into the SQL Editor and click "Run" to execute');
    console.log('\nIf using multiple chunks, execute them in order (part_1, part_2, etc.)');
    
  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  }
}

// Run the main function
main();