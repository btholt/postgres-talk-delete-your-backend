-- Checkpoint 05 | Read-only.
SELECT rolname, rolsuper, rolinherit
FROM pg_roles
WHERE rolname IN ('api_authenticator', 'web_anon', 'web_user', 'api_owner')
ORDER BY rolname;
