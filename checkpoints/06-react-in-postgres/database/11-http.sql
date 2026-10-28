CREATE EXTENSION omni_httpd WITH VERSION '0.4.11' CASCADE;
GRANT USAGE ON SCHEMA omni_http, omni_httpd TO web_renderer;

CREATE FUNCTION internal.http(request omni_httpd.http_request) RETURNS omni_httpd.http_outcome
LANGUAGE plpgsql SET search_path=pg_catalog,pg_temp AS $$
DECLARE asset internal.web_assets; project_id integer;
BEGIN
  IF left(request.path,5)='/api/' THEN
    RETURN omni_httpd.http_proxy('http://api:3001' || substr(request.path,5)
      || CASE WHEN coalesce(request.query_string,'')='' THEN '' ELSE '?' || request.query_string END,
      preserve_host => false);
  END IF;
  IF request.method NOT IN ('GET','HEAD') THEN
    RETURN omni_httpd.http_response('Method not allowed.', status=>405,
      headers=>ARRAY[omni_http.http_header('allow','GET, HEAD')]);
  END IF;
  IF request.path='/health' THEN
    RETURN omni_httpd.http_response(api.health()::text,
      headers=>ARRAY[omni_http.http_header('content-type','application/json')]);
  END IF;
  SELECT * INTO asset FROM internal.web_assets WHERE path=request.path;
  IF FOUND THEN
    RETURN omni_httpd.http_response(asset.content, headers=>ARRAY[
      omni_http.http_header('content-type',asset.content_type),
      omni_http.http_header('cache-control',
        CASE WHEN left(asset.path,8)='/assets/' THEN 'public, max-age=31536000, immutable' ELSE 'public, max-age=3600' END)]);
  END IF;
  IF request.path ~ '^/project/[1-9][0-9]{0,8}$' THEN
    project_id := split_part(request.path,'/',3)::integer;
    IF NOT EXISTS (SELECT FROM api.projects WHERE id=project_id) THEN
      RETURN omni_httpd.http_response('Project not found.', status=>404);
    END IF;
  ELSIF request.path NOT IN ('/','/index.html') THEN
    RETURN omni_httpd.http_response('Not found.', status=>404);
  END IF;
  RETURN omni_httpd.http_response(public.render_page(project_id), headers=>ARRAY[
    omni_http.http_header('content-type','text/html; charset=utf-8'),
    omni_http.http_header('cache-control','no-store'),
    omni_http.http_header('x-kickstopper-renderer','React 19 / plv8 / Postgres')]);
END $$;
ALTER FUNCTION internal.http(omni_httpd.http_request) OWNER TO web_renderer;
GRANT EXECUTE ON FUNCTION internal.http(omni_httpd.http_request) TO web_renderer;

UPDATE omni_httpd.handlers SET
  query='SELECT internal.http(request.*::omni_httpd.http_request) FROM request',
  role_name='web_renderer';
