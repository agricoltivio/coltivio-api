-- The API connects as rls_client and switches with SET LOCAL ROLE, which does not apply the
-- target role's settings. The login role therefore carries the statement timeout that bounds
-- runaway queries such as oversized plot layer requests.
ALTER ROLE rls_client SET statement_timeout = '10s';
