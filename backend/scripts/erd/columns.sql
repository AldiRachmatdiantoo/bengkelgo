-- Columns of every app table with PK / single-column UNIQUE markers (input for build-erd.py).
SELECT c.table_name, c.column_name, c.data_type, c.udt_name, c.is_nullable,
  COALESCE((SELECT 'PK' FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage k ON k.constraint_name = tc.constraint_name AND k.table_name = tc.table_name
            WHERE tc.table_name = c.table_name AND tc.constraint_type = 'PRIMARY KEY' AND k.column_name = c.column_name LIMIT 1), ''),
  COALESCE((SELECT 'UK' FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage k ON k.constraint_name = tc.constraint_name AND k.table_name = tc.table_name
            WHERE tc.table_name = c.table_name AND tc.constraint_type = 'UNIQUE' AND k.column_name = c.column_name
              AND (SELECT COUNT(*) FROM information_schema.key_column_usage k2 WHERE k2.constraint_name = tc.constraint_name) = 1 LIMIT 1), '')
FROM information_schema.columns c
JOIN information_schema.tables t ON t.table_name = c.table_name AND t.table_schema = 'public' AND t.table_type = 'BASE TABLE'
WHERE c.table_schema = 'public' AND c.table_name NOT IN ('spatial_ref_sys', 'schema_migrations')
ORDER BY c.table_name, c.ordinal_position;
