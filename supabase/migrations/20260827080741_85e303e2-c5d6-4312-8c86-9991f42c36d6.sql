-- Remove duplicate roster entries: Veronese-specific rows (bruno-moinard, tristan-auer-veronese) already exist
update public.designers set additional_founders = array_remove(additional_founders, 'Veronese') where slug = 'bruno-moinard-editions';
update public.designers set additional_founders = array_remove(additional_founders, 'Veronese') where slug = 'tristan-auer';