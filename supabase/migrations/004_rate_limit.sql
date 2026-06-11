-- Fixed-window rate limit buckets (service-role only; used by API routes).

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  bucket_key text PRIMARY KEY,
  window_start timestamptz NOT NULL DEFAULT now(),
  request_count integer NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS rate_limit_buckets_window_start_idx
  ON rate_limit_buckets (window_start);

ALTER TABLE rate_limit_buckets ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_bucket_key text,
  p_window_seconds integer,
  p_max_requests integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now timestamptz := now();
  v_window_start timestamptz;
  v_count integer;
  v_window_end timestamptz;
BEGIN
  IF p_window_seconds < 1 OR p_max_requests < 1 THEN
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', p_max_requests,
      'retry_after_seconds', 0
    );
  END IF;

  SELECT window_start, request_count
  INTO v_window_start, v_count
  FROM rate_limit_buckets
  WHERE bucket_key = p_bucket_key
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO rate_limit_buckets (bucket_key, window_start, request_count)
    VALUES (p_bucket_key, v_now, 1);
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', GREATEST(0, p_max_requests - 1),
      'retry_after_seconds', 0
    );
  END IF;

  v_window_end := v_window_start + make_interval(secs => p_window_seconds);

  IF v_now >= v_window_end THEN
    UPDATE rate_limit_buckets
    SET window_start = v_now, request_count = 1
    WHERE bucket_key = p_bucket_key;
    RETURN jsonb_build_object(
      'allowed', true,
      'remaining', GREATEST(0, p_max_requests - 1),
      'retry_after_seconds', 0
    );
  END IF;

  IF v_count >= p_max_requests THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'remaining', 0,
      'retry_after_seconds', GREATEST(
        1,
        EXTRACT(EPOCH FROM (v_window_end - v_now))::integer
      )
    );
  END IF;

  UPDATE rate_limit_buckets
  SET request_count = request_count + 1
  WHERE bucket_key = p_bucket_key;

  RETURN jsonb_build_object(
    'allowed', true,
    'remaining', GREATEST(0, p_max_requests - v_count - 1),
    'retry_after_seconds', 0
  );
END;
$$;

REVOKE ALL ON FUNCTION check_rate_limit(text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION check_rate_limit(text, integer, integer) TO service_role;
