
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
  