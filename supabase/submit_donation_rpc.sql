-- Run in Supabase → SQL Editor (fixes RLS blocking donation INSERT permanently)
-- After this, the app uses RPC instead of direct insert.

CREATE OR REPLACE FUNCTION public.submit_donation(
  p_donor_name text,
  p_amount numeric,
  p_currency text,
  p_receipt_url text,
  p_admin_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
  cur text;
BEGIN
  IF p_donor_name IS NULL OR length(trim(p_donor_name)) = 0 THEN
    RAISE EXCEPTION 'donor_name required';
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid amount';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.admins WHERE user_id = p_admin_id) THEN
    RAISE EXCEPTION 'invalid admin';
  END IF;

  cur := lower(trim(coalesce(p_currency, 'usd')));
  IF cur NOT IN ('usd', 'try', 'syp') THEN
    cur := 'usd';
  END IF;

  INSERT INTO public.donations (donor_name, amount, currency, receipt_url, admin_id)
  VALUES (trim(p_donor_name), p_amount, cur, nullif(trim(p_receipt_url), ''), p_admin_id)
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_donation(text, numeric, text, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_donation(text, numeric, text, text, uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_donation(text, numeric, text, text, uuid) TO authenticated;
