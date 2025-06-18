// Verify Supabase Extensions
// This script generates SQL to check if the required extensions are available

const fs = require('fs');
const path = require('path');

// Main function
function main() {
  console.log('======================================');
  console.log('Supabase Extensions Verification SQL');
  console.log('======================================');
  
  // SQL to check extensions
  const extensionsCheckSql = `
-- Check if uuid-ossp extension is available (needed for uuid_generate_v4())
SELECT EXISTS (
  SELECT 1 FROM pg_available_extensions WHERE name = 'uuid-ossp'
) AS uuid_ossp_available;

-- Check if uuid-ossp extension is installed
SELECT EXISTS (
  SELECT 1 FROM pg_extension WHERE extname = 'uuid-ossp'
) AS uuid_ossp_installed;

-- Install uuid-ossp extension if needed
-- Uncomment the next line if the extension is available but not installed
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Check for other required capabilities
SELECT 
  version() AS postgres_version,
  current_setting('server_version_num') AS postgres_version_num,
  (SELECT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'jsonb_set'
  )) AS has_jsonb_support,
  (SELECT EXISTS (
    SELECT 1 FROM pg_roles WHERE rolname = 'authenticated'
  )) AS has_authenticated_role;
  `;
  
  // Create output directory
  const outputDir = path.join(__dirname, '..', 'migrations', 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  // Write SQL to file
  const outputFile = path.join(outputDir, 'check_extensions.sql');
  fs.writeFileSync(outputFile, extensionsCheckSql);
  console.log(`Extension check SQL written to: ${outputFile}`);
  
  // Also generate the extension installation SQL
  const installExtensionsSql = `
-- This SQL script installs the extensions required for the database tables

-- Install uuid-ossp extension (needed for uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable RLS on the database
ALTER DATABASE postgres SET ROLE authenticated;

-- Check if extensions were installed successfully
SELECT 
  extname AS extension_name,
  extversion AS version,
  'Extension is installed and ready' AS status
FROM pg_extension 
WHERE extname = 'uuid-ossp';
`;
  
  // Write installation SQL to file
  const installFile = path.join(outputDir, 'install_extensions.sql');
  fs.writeFileSync(installFile, installExtensionsSql);
  console.log(`Extension installation SQL written to: ${installFile}`);
  
  // Print the SQL for easy copy-paste
  console.log('\nExtension Check SQL:');
  console.log('-------------------');
  console.log(extensionsCheckSql);
  
  console.log('\nExtension Installation SQL:');
  console.log('--------------------------');
  console.log(installExtensionsSql);
  
  console.log('\nInstructions:');
  console.log('1. First run the check_extensions.sql in Supabase SQL Editor to verify what\'s available');
  console.log('2. If needed, run install_extensions.sql to install required extensions');
  console.log('3. Then run the table creation SQL to set up your database tables');
}

// Run the main function
main();