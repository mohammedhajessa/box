-- Run this in Supabase → SQL Editor if donation fails with:
-- "new row violates row-level security policy"
--
-- Fixes (1) inserting into public.donations as anon (public form)
--     (2) uploading to Storage bucket "receipts" as anon

-- ========== 1) public.donations: allow INSERT for anon + authenticated ==========
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "donations_insert" ON public.donations;
DROP POLICY IF EXISTS "donations_insert_public" ON public.donations;
DROP POLICY IF EXISTS "donations_insert_anon" ON public.donations;
DROP POLICY IF EXISTS "donations_insert_authenticated" ON public.donations;

CREATE POLICY "donations_insert_anon"
  ON public.donations FOR INSERT TO anon
  WITH CHECK (true);

CREATE POLICY "donations_insert_authenticated"
  ON public.donations FOR INSERT TO authenticated
  WITH CHECK (true);

GRANT INSERT ON public.donations TO anon;
GRANT INSERT ON public.donations TO authenticated;

-- ========== 2) storage.objects: allow anon INSERT into bucket "receipts" ==========
-- Run this block if the error happens while UPLOADING the image (before "success").
-- If you already have an INSERT policy for anon on this bucket, you can skip this part.

DROP POLICY IF EXISTS "receipts_insert_anon" ON storage.objects;

CREATE POLICY "receipts_insert_anon"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'receipts');

-- ========== 3) Donation row via RPC (bypasses table RLS — required by the app) ==========
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
