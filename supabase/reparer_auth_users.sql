DO $$
DECLARE colonne TEXT;
BEGIN
  FOREACH colonne IN ARRAY ARRAY[
    'confirmation_token', 'recovery_token', 'email_change',
    'email_change_token_new', 'email_change_token_current',
    'phone_change', 'phone_change_token', 'reauthentication_token'
  ] LOOP
    IF EXISTS (SELECT 1 FROM information_schema.columns
               WHERE table_schema = 'auth' AND table_name = 'users'
                 AND column_name = colonne) THEN
      EXECUTE format('UPDATE auth.users SET %I = %L WHERE %I IS NULL',
                     colonne, '', colonne);
    END IF;
  END LOOP;
END $$;
