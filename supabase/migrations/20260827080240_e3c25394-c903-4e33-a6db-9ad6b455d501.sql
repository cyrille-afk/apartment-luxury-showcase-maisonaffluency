-- Make existing Veronese sub-designers visible on the public site
update public.designers
set trade_only = false, is_published = true
where founder = 'Veronese' and slug <> 'veronese';

-- Link the 4 designers that live under other identities
update public.designers set additional_founders = array_append(additional_founders, 'Veronese') where slug = 'bruno-moinard-editions' and not ('Veronese' = any(additional_founders));
update public.designers set additional_founders = array_append(additional_founders, 'Veronese') where slug = 'reda-amalou' and not ('Veronese' = any(additional_founders));
update public.designers set additional_founders = array_append(additional_founders, 'Veronese') where slug = 'sam-accoceberry' and not ('Veronese' = any(additional_founders));
update public.designers set additional_founders = array_append(additional_founders, 'Veronese') where slug = 'tristan-auer' and not ('Veronese' = any(additional_founders));