CREATE POLICY "Public approved Amar Donnersberg collaborations"
ON public.designer_curator_picks_public FOR SELECT TO anon, authenticated
USING (
 id IN ('11179934-a17e-4d81-9f49-b84c19b43a4a'::uuid, '6f7996bc-a985-45ec-8c31-bf97c4a71dd4'::uuid, 'b0578007-d436-4fac-866f-1964b459942a'::uuid)
 AND designer_id = '27ec2534-5f58-4294-b2e7-5bacf8b796d6'::uuid
 AND is_hidden IS NOT TRUE
);