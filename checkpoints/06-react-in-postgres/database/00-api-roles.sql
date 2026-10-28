CREATE ROLE api_owner LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE ROLE analytics_executor LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
CREATE ROLE web_anon NOLOGIN;
CREATE ROLE web_user NOLOGIN;
CREATE ROLE api_authenticator LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE
  PASSWORD 'postgrest-local';
GRANT web_anon, web_user TO api_authenticator;
ALTER ROLE analytics_executor SET duckdb.force_execution = true;
ALTER ROLE analytics_executor SET default_transaction_read_only = on;
