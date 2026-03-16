
UPDATE auth.users 
SET email = 'cyrille@maisonaffluency.com', 
    email_confirmed_at = now(),
    updated_at = now()
WHERE id = '3106edd7-2854-4b59-a6b3-88a7fa8a5532' 
  AND email = 'cyrille@myaffluency.com';

UPDATE public.profiles 
SET email = 'cyrille@maisonaffluency.com' 
WHERE id = '3106edd7-2854-4b59-a6b3-88a7fa8a5532';
