// Split SQL By Table
// This script splits the combined SQL into separate files for each table

const fs = require('fs');
const path = require('path');

// Load the combined SQL file
const sqlFilePath = path.join(__dirname, '..', 'migrations', 'combined_tables.sql');

// Function to extract SQL for a specific table section
function extractTableSection(sql, tableName, nextTableName = null) {
  // Define the marker for this table section
  const startMarker = `-- ${tableName}. Create ${tableName.toLowerCase()} table`;
  
  // Define the end marker (either the next table section or end of file)
  const endMarker = nextTableName 
    ? `-- ${nextTableName}. Create ${nextTableName.toLowerCase()} table` 
    : null;
  
  // Find the start position
  const startPos = sql.indexOf(startMarker);
  if (startPos === -1) {
    console.error(`Could not find section for table: ${tableName.toLowerCase()}`);
    return '';
  }
  
  // Find the end position
  let endPos = endMarker ? sql.indexOf(endMarker) : sql.length;
  if (endPos === -1) {
    endPos = sql.length;
  }
  
  // Extract the section
  return sql.substring(startPos, endPos).trim();
}

// Main function
function main() {
  try {
    console.log('======================================');
    console.log('Split SQL By Table');
    console.log('======================================');
    
    // Check if the SQL file exists
    if (!fs.existsSync(sqlFilePath)) {
      console.error(`SQL file not found at ${sqlFilePath}`);
      process.exit(1);
    }
    
    // Read the SQL file
    const sql = fs.readFileSync(sqlFilePath, 'utf8');
    console.log(`Read SQL file: ${sqlFilePath}`);
    
    // List of table sections in order
    const tableSections = [
      { number: '1', name: 'users' },
      { number: '2', name: 'searches' },
      { number: '3', name: 'suspended_workflows' },
      { number: '4', name: 'tasks' },
      { number: '5', name: 'workflow_planning' }
    ];
    
    // Create output directory
    const outputDir = path.join(__dirname, '..', 'migrations', 'output', 'tables');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    // Extract and write each table section
    for (let i = 0; i < tableSections.length; i++) {
      const section = tableSections[i];
      const nextSection = i < tableSections.length - 1 ? tableSections[i + 1] : null;
      
      // Extract SQL for this table
      const tableSql = extractTableSection(
        sql, 
        section.number, 
        nextSection ? nextSection.number : null
      );
      
      if (tableSql) {
        // Write to file
        const outputFile = path.join(outputDir, `${section.number}_${section.name}.sql`);
        fs.writeFileSync(outputFile, tableSql);
        console.log(`Table ${section.name} SQL written to: ${outputFile}`);
      }
    }
    
    // Also create a combined script with proper order
    console.log('\nCreating execution order script...');
    
    // Generate a script that shows the recommended execution order
    let executionOrderScript = `-- Recommended SQL Execution Order
-- Run these scripts in the Supabase SQL Editor in this order

-- Step 1: Install required extensions
-- First run /migrations/output/check_extensions.sql to check what's available
-- Then run /migrations/output/install_extensions.sql if needed

-- Step 2: Create tables and related objects
`;

    // Add each table section
    tableSections.forEach(section => {
      executionOrderScript += `\n-- Create ${section.name} table and related objects\n`;
      executionOrderScript += `-- Run: /migrations/output/tables/${section.number}_${section.name}.sql\n`;
    });
    
    // Write execution order script
    const executionOrderFile = path.join(outputDir, '00_execution_order.txt');
    fs.writeFileSync(executionOrderFile, executionOrderScript);
    console.log(`Execution order guide written to: ${executionOrderFile}`);
    
    console.log('\nInstructions:');
    console.log('1. Check and install extensions first using the check_extensions.sql and install_extensions.sql');
    console.log('2. Follow the 00_execution_order.txt guide for creating tables in the correct order');
    console.log('3. For troubleshooting, you can execute each table\'s SQL separately');
    
  } catch (error) {
    console.error('An error occurred:', error);
    process.exit(1);
  }
}

// Run the main function
main();