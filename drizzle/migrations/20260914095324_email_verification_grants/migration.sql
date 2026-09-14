-- Drizzle does not model column grants. A column REVOKE is a no-op while the table grant stands.
REVOKE UPDATE ON public.profiles FROM authenticated;
--> statement-breakpoint
GRANT UPDATE (full_name) ON public.profiles TO authenticated;
--> statement-breakpoint
-- A changed address invalidates the verification, so the next API request sends a new verification mail
CREATE OR REPLACE FUNCTION public.update_profile()
RETURNS trigger
SET search_path = ''
AS $$
BEGIN
  UPDATE public.profiles
  SET (email, full_name) = (NEW.email, NEW.raw_user_meta_data->>'full_name')
  WHERE id = NEW.id;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    UPDATE public.profiles
    SET email_verified = false, verification_email_sent_at = NULL
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
