
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
