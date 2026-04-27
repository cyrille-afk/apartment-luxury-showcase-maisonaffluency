
-- ============================================================
-- 1. ENUMS
-- ============================================================
CREATE TYPE public.studio_role AS ENUM ('owner', 'admin', 'editor', 'viewer');

-- ============================================================
-- 2. CORE TABLES
-- ============================================================
CREATE TABLE public.studios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE,
  logo_url text,
  billing_email text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.studio_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role public.studio_role NOT NULL DEFAULT 'editor',
  invited_by uuid,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, user_id)
);

CREATE INDEX idx_studio_members_user ON public.studio_members(user_id);
CREATE INDEX idx_studio_members_studio ON public.studio_members(studio_id);

CREATE TABLE public.studio_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  studio_id uuid NOT NULL REFERENCES public.studios(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.studio_role NOT NULL DEFAULT 'editor',
  token text NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  invited_by uuid NOT NULL,
  accepted_at timestamptz,
  accepted_by uuid,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (studio_id, email)
);

CREATE INDEX idx_studio_invites_email ON public.studio_invites(lower(email));
CREATE INDEX idx_studio_invites_token ON public.studio_invites(token);

CREATE TABLE public.studio_project_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  -- NULL role means "explicitly hidden / no access" override
  role public.studio_role,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);

CREATE INDEX idx_studio_project_overrides_user ON public.studio_project_overrides(user_id);

-- ============================================================
-- 3. ADD studio_id TO EXISTING TABLES
-- ============================================================
ALTER TABLE public.projects               ADD COLUMN studio_id uuid REFERENCES public.studios(id) ON DELETE CASCADE;
ALTER TABLE public.trade_quotes           ADD COLUMN studio_id uuid REFERENCES public.studios(id) ON DELETE CASCADE;
ALTER TABLE public.client_boards          ADD COLUMN studio_id uuid REFERENCES public.studios(id) ON DELETE CASCADE;
ALTER TABLE public.order_timeline         ADD COLUMN studio_id uuid REFERENCES public.studios(id) ON DELETE CASCADE;
ALTER TABLE public.trade_custom_requests  ADD COLUMN studio_id uuid REFERENCES public.studios(id) ON DELETE CASCADE;

CREATE INDEX idx_projects_studio              ON public.projects(studio_id);
CREATE INDEX idx_trade_quotes_studio          ON public.trade_quotes(studio_id);
CREATE INDEX idx_client_boards_studio         ON public.client_boards(studio_id);
CREATE INDEX idx_order_timeline_studio        ON public.order_timeline(studio_id);
CREATE INDEX idx_trade_custom_requests_studio ON public.trade_custom_requests(studio_id);

-- ============================================================
-- 4. SECURITY DEFINER HELPERS
-- ============================================================

-- Returns the studio_id a user belongs to (first/primary). Most users will have one studio.
CREATE OR REPLACE FUNCTION public.get_user_studio_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT studio_id FROM public.studio_members WHERE user_id = _user_id;
$$;

-- Returns true if user has the given role (or higher) in the studio.
-- Hierarchy: owner > admin > editor > viewer
CREATE OR REPLACE FUNCTION public.has_studio_role(_user_id uuid, _studio_id uuid, _min_role public.studio_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.studio_members sm
    WHERE sm.user_id = _user_id
      AND sm.studio_id = _studio_id
      AND CASE _min_role
            WHEN 'viewer' THEN sm.role IN ('viewer','editor','admin','owner')
            WHEN 'editor' THEN sm.role IN ('editor','admin','owner')
            WHEN 'admin'  THEN sm.role IN ('admin','owner')
            WHEN 'owner'  THEN sm.role = 'owner'
          END
  );
$$;

-- Returns the effective role of a user on a specific project (override wins over studio role).
-- Returns NULL if the user has no access (explicitly hidden or not a member).
CREATE OR REPLACE FUNCTION public.effective_project_role(_user_id uuid, _project_id uuid)
RETURNS public.studio_role
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _project_studio uuid;
  _override_exists boolean;
  _override_role public.studio_role;
  _studio_role public.studio_role;
BEGIN
  SELECT studio_id INTO _project_studio FROM public.projects WHERE id = _project_id;
  IF _project_studio IS NULL THEN
    RETURN NULL;
  END IF;

  -- Override check
  SELECT true, role INTO _override_exists, _override_role
  FROM public.studio_project_overrides
  WHERE project_id = _project_id AND user_id = _user_id;

  IF _override_exists THEN
    -- NULL role = explicitly hidden
    RETURN _override_role;
  END IF;

  -- Fall back to studio role
  SELECT role INTO _studio_role
  FROM public.studio_members
  WHERE studio_id = _project_studio AND user_id = _user_id;

  RETURN _studio_role;
END;
$$;

-- Convenience: can the user access the project at all (read)?
CREATE OR REPLACE FUNCTION public.can_view_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.effective_project_role(_user_id, _project_id) IS NOT NULL
      OR public.has_role(_user_id, 'admin'::app_role);
$$;

-- Can the user edit (editor+) on this project?
CREATE OR REPLACE FUNCTION public.can_edit_project(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.effective_project_role(_user_id, _project_id) IN ('editor','admin','owner')
      OR public.has_role(_user_id, 'admin'::app_role);
$$;

-- Can the user access something owned by a studio (when there's no project context)?
CREATE OR REPLACE FUNCTION public.can_view_studio(_user_id uuid, _studio_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.studio_members WHERE studio_id = _studio_id AND user_id = _user_id
  ) OR public.has_role(_user_id, 'admin'::app_role);
$$;

CREATE OR REPLACE FUNCTION public.can_edit_studio(_user_id uuid, _studio_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.studio_members
    WHERE studio_id = _studio_id AND user_id = _user_id
      AND role IN ('editor','admin','owner')
  ) OR public.has_role(_user_id, 'admin'::app_role);
$$;

-- ============================================================
-- 5. BACKFILL: create personal studio for every existing trade user
-- ============================================================
DO $$
DECLARE
  r RECORD;
  new_studio_id uuid;
  studio_name text;
BEGIN
  FOR r IN
    SELECT DISTINCT u.user_id
    FROM (
      SELECT user_id FROM public.projects WHERE user_id IS NOT NULL
      UNION
      SELECT user_id FROM public.trade_quotes WHERE user_id IS NOT NULL
      UNION
      SELECT user_id FROM public.client_boards WHERE user_id IS NOT NULL
      UNION
      SELECT user_id FROM public.order_timeline WHERE user_id IS NOT NULL
      UNION
      SELECT user_id FROM public.trade_custom_requests WHERE user_id IS NOT NULL
    ) u
  LOOP
    SELECT
      COALESCE(
        NULLIF(TRIM(p.company), ''),
        NULLIF(TRIM(p.first_name) || '''s Studio', '''s Studio'),
        'My Studio'
      )
    INTO studio_name
    FROM public.profiles p WHERE p.id = r.user_id;

    IF studio_name IS NULL THEN studio_name := 'My Studio'; END IF;

    INSERT INTO public.studios (name, created_by) VALUES (studio_name, r.user_id)
    RETURNING id INTO new_studio_id;

    INSERT INTO public.studio_members (studio_id, user_id, role)
    VALUES (new_studio_id, r.user_id, 'owner');

    UPDATE public.projects              SET studio_id = new_studio_id WHERE user_id = r.user_id AND studio_id IS NULL;
    UPDATE public.trade_quotes          SET studio_id = new_studio_id WHERE user_id = r.user_id AND studio_id IS NULL;
    UPDATE public.client_boards         SET studio_id = new_studio_id WHERE user_id = r.user_id AND studio_id IS NULL;
    UPDATE public.order_timeline        SET studio_id = new_studio_id WHERE user_id = r.user_id AND studio_id IS NULL;
    UPDATE public.trade_custom_requests SET studio_id = new_studio_id WHERE user_id = r.user_id AND studio_id IS NULL;
  END LOOP;
END $$;

-- ============================================================
-- 6. RLS — STUDIOS / MEMBERS / INVITES / OVERRIDES
-- ============================================================
ALTER TABLE public.studios                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_invites           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.studio_project_overrides ENABLE ROW LEVEL SECURITY;

-- studios
CREATE POLICY "Members can view their studios" ON public.studios FOR SELECT
  USING (public.can_view_studio(auth.uid(), id));

CREATE POLICY "Anyone authenticated can create a studio" ON public.studios FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Owners and admins can update studio" ON public.studios FOR UPDATE
  USING (public.has_studio_role(auth.uid(), id, 'admin') OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Owners can delete studio" ON public.studios FOR DELETE
  USING (public.has_studio_role(auth.uid(), id, 'owner') OR public.has_role(auth.uid(), 'admin'::app_role));

-- studio_members
CREATE POLICY "Members can view fellow members" ON public.studio_members FOR SELECT
  USING (public.can_view_studio(auth.uid(), studio_id));

CREATE POLICY "Owners/admins can add members" ON public.studio_members FOR INSERT
  WITH CHECK (public.has_studio_role(auth.uid(), studio_id, 'admin') OR auth.uid() = user_id);

CREATE POLICY "Owners/admins can update member roles" ON public.studio_members FOR UPDATE
  USING (public.has_studio_role(auth.uid(), studio_id, 'admin'));

CREATE POLICY "Owners/admins or self can remove a member" ON public.studio_members FOR DELETE
  USING (public.has_studio_role(auth.uid(), studio_id, 'admin') OR auth.uid() = user_id);

-- studio_invites
CREATE POLICY "Members can view invites" ON public.studio_invites FOR SELECT
  USING (public.can_view_studio(auth.uid(), studio_id));

CREATE POLICY "Owners/admins can create invites" ON public.studio_invites FOR INSERT
  WITH CHECK (public.has_studio_role(auth.uid(), studio_id, 'admin') AND invited_by = auth.uid());

CREATE POLICY "Owners/admins can revoke invites" ON public.studio_invites FOR DELETE
  USING (public.has_studio_role(auth.uid(), studio_id, 'admin'));

-- studio_project_overrides
CREATE POLICY "Members can view overrides for their studio's projects" ON public.studio_project_overrides FOR SELECT
  USING (public.can_view_project(auth.uid(), project_id));

CREATE POLICY "Admins of project's studio manage overrides (insert)" ON public.studio_project_overrides FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND public.has_studio_role(auth.uid(), p.studio_id, 'admin')
    )
  );

CREATE POLICY "Admins of project's studio manage overrides (update)" ON public.studio_project_overrides FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND public.has_studio_role(auth.uid(), p.studio_id, 'admin')
    )
  );

CREATE POLICY "Admins of project's studio manage overrides (delete)" ON public.studio_project_overrides FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_id
        AND public.has_studio_role(auth.uid(), p.studio_id, 'admin')
    )
  );

-- ============================================================
-- 7. RLS — REWRITE EXISTING POLICIES TO BE STUDIO-AWARE
-- ============================================================

-- ---------- projects ----------
DROP POLICY IF EXISTS "Users can view their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can create their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can update their own projects" ON public.projects;
DROP POLICY IF EXISTS "Users can delete their own projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can view all projects" ON public.projects;

CREATE POLICY "View projects (studio members + admins)" ON public.projects FOR SELECT
  USING (public.can_view_project(auth.uid(), id));

CREATE POLICY "Create projects in own studio" ON public.projects FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (studio_id IS NULL OR public.has_studio_role(auth.uid(), studio_id, 'editor'))
  );

CREATE POLICY "Edit projects (editor+ on project or platform admin)" ON public.projects FOR UPDATE
  USING (public.can_edit_project(auth.uid(), id));

CREATE POLICY "Delete projects (admin/owner of studio or platform admin)" ON public.projects FOR DELETE
  USING (
    (studio_id IS NOT NULL AND public.has_studio_role(auth.uid(), studio_id, 'admin'))
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ---------- trade_quotes ----------
DROP POLICY IF EXISTS "Users can view their own quotes" ON public.trade_quotes;
DROP POLICY IF EXISTS "Users can create their own quotes" ON public.trade_quotes;
DROP POLICY IF EXISTS "Users can update their own quotes" ON public.trade_quotes;
DROP POLICY IF EXISTS "Users can delete their own quotes" ON public.trade_quotes;
DROP POLICY IF EXISTS "Admins can view all quotes" ON public.trade_quotes;
DROP POLICY IF EXISTS "Admins can update all quotes" ON public.trade_quotes;

CREATE POLICY "View quotes (studio + project access)" ON public.trade_quotes FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (project_id IS NOT NULL AND public.can_view_project(auth.uid(), project_id))
    OR (project_id IS NULL AND studio_id IS NOT NULL AND public.can_view_studio(auth.uid(), studio_id))
    OR (project_id IS NULL AND studio_id IS NULL AND user_id = auth.uid())
  );

CREATE POLICY "Create quotes (editor+ in studio)" ON public.trade_quotes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (studio_id IS NULL OR public.has_studio_role(auth.uid(), studio_id, 'editor'))
  );

CREATE POLICY "Update quotes (editor+ on project or studio, or platform admin)" ON public.trade_quotes FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (project_id IS NOT NULL AND public.can_edit_project(auth.uid(), project_id))
    OR (project_id IS NULL AND studio_id IS NOT NULL AND public.can_edit_studio(auth.uid(), studio_id))
    OR (project_id IS NULL AND studio_id IS NULL AND user_id = auth.uid())
  );

CREATE POLICY "Delete quotes (admin/owner of studio or platform admin)" ON public.trade_quotes FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (studio_id IS NOT NULL AND public.has_studio_role(auth.uid(), studio_id, 'admin'))
    OR (studio_id IS NULL AND user_id = auth.uid())
  );

-- ---------- client_boards ----------
DROP POLICY IF EXISTS "Users can view their own boards" ON public.client_boards;
DROP POLICY IF EXISTS "Users can create their own boards" ON public.client_boards;
DROP POLICY IF EXISTS "Users can update their own boards" ON public.client_boards;
DROP POLICY IF EXISTS "Users can delete their own boards" ON public.client_boards;
DROP POLICY IF EXISTS "Admins can view all boards" ON public.client_boards;

CREATE POLICY "View boards (studio + project access)" ON public.client_boards FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (project_id IS NOT NULL AND public.can_view_project(auth.uid(), project_id))
    OR (project_id IS NULL AND studio_id IS NOT NULL AND public.can_view_studio(auth.uid(), studio_id))
    OR (project_id IS NULL AND studio_id IS NULL AND user_id = auth.uid())
  );

CREATE POLICY "Create boards (editor+ in studio)" ON public.client_boards FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (studio_id IS NULL OR public.has_studio_role(auth.uid(), studio_id, 'editor'))
  );

CREATE POLICY "Update boards (editor+ on project or studio)" ON public.client_boards FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (project_id IS NOT NULL AND public.can_edit_project(auth.uid(), project_id))
    OR (project_id IS NULL AND studio_id IS NOT NULL AND public.can_edit_studio(auth.uid(), studio_id))
    OR (project_id IS NULL AND studio_id IS NULL AND user_id = auth.uid())
  );

CREATE POLICY "Delete boards (admin+ of studio or platform admin)" ON public.client_boards FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (studio_id IS NOT NULL AND public.has_studio_role(auth.uid(), studio_id, 'admin'))
    OR (studio_id IS NULL AND user_id = auth.uid())
  );

-- ---------- order_timeline ----------
DROP POLICY IF EXISTS "Users can view their own timelines" ON public.order_timeline;
DROP POLICY IF EXISTS "Users can create their own timelines" ON public.order_timeline;
DROP POLICY IF EXISTS "Users can update their own timelines" ON public.order_timeline;
DROP POLICY IF EXISTS "Users can delete their own timelines" ON public.order_timeline;
DROP POLICY IF EXISTS "Admins can view all timelines" ON public.order_timeline;
DROP POLICY IF EXISTS "Admins can update all timelines" ON public.order_timeline;

CREATE POLICY "View timelines (studio + project access)" ON public.order_timeline FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (project_id IS NOT NULL AND public.can_view_project(auth.uid(), project_id))
    OR (project_id IS NULL AND studio_id IS NOT NULL AND public.can_view_studio(auth.uid(), studio_id))
    OR (project_id IS NULL AND studio_id IS NULL AND user_id = auth.uid())
  );

CREATE POLICY "Create timelines (editor+ in studio)" ON public.order_timeline FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (studio_id IS NULL OR public.has_studio_role(auth.uid(), studio_id, 'editor'))
  );

CREATE POLICY "Update timelines (editor+ on project or studio)" ON public.order_timeline FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (project_id IS NOT NULL AND public.can_edit_project(auth.uid(), project_id))
    OR (project_id IS NULL AND studio_id IS NOT NULL AND public.can_edit_studio(auth.uid(), studio_id))
    OR (project_id IS NULL AND studio_id IS NULL AND user_id = auth.uid())
  );

CREATE POLICY "Delete timelines (admin+ of studio or platform admin)" ON public.order_timeline FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (studio_id IS NOT NULL AND public.has_studio_role(auth.uid(), studio_id, 'admin'))
    OR (studio_id IS NULL AND user_id = auth.uid())
  );

-- ---------- trade_custom_requests ----------
DROP POLICY IF EXISTS "Users can view their own custom requests" ON public.trade_custom_requests;
DROP POLICY IF EXISTS "Users can create their own custom requests" ON public.trade_custom_requests;
DROP POLICY IF EXISTS "Users can update their own custom requests" ON public.trade_custom_requests;
DROP POLICY IF EXISTS "Users can delete their own custom requests" ON public.trade_custom_requests;
DROP POLICY IF EXISTS "Admins can view all custom requests" ON public.trade_custom_requests;
DROP POLICY IF EXISTS "Admins can update all custom requests" ON public.trade_custom_requests;

CREATE POLICY "View custom requests (studio + project access)" ON public.trade_custom_requests FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (project_id IS NOT NULL AND public.can_view_project(auth.uid(), project_id))
    OR (project_id IS NULL AND studio_id IS NOT NULL AND public.can_view_studio(auth.uid(), studio_id))
    OR (project_id IS NULL AND studio_id IS NULL AND user_id = auth.uid())
  );

CREATE POLICY "Create custom requests (editor+ in studio)" ON public.trade_custom_requests FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (studio_id IS NULL OR public.has_studio_role(auth.uid(), studio_id, 'editor'))
  );

CREATE POLICY "Update custom requests (editor+ on project or studio)" ON public.trade_custom_requests FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (project_id IS NOT NULL AND public.can_edit_project(auth.uid(), project_id))
    OR (project_id IS NULL AND studio_id IS NOT NULL AND public.can_edit_studio(auth.uid(), studio_id))
    OR (project_id IS NULL AND studio_id IS NULL AND user_id = auth.uid())
  );

CREATE POLICY "Delete custom requests (admin+ of studio or platform admin)" ON public.trade_custom_requests FOR DELETE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (studio_id IS NOT NULL AND public.has_studio_role(auth.uid(), studio_id, 'admin'))
    OR (studio_id IS NULL AND user_id = auth.uid())
  );

-- ============================================================
-- 8. AUTO-ACCEPT INVITE ON SIGNUP / RESOLVE PENDING
-- ============================================================
CREATE OR REPLACE FUNCTION public.auto_accept_studio_invites()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  inv RECORD;
BEGIN
  FOR inv IN
    SELECT * FROM public.studio_invites
    WHERE lower(email) = lower(NEW.email)
      AND accepted_at IS NULL
      AND expires_at > now()
  LOOP
    INSERT INTO public.studio_members (studio_id, user_id, role, invited_by)
    VALUES (inv.studio_id, NEW.id, inv.role, inv.invited_by)
    ON CONFLICT (studio_id, user_id) DO NOTHING;

    UPDATE public.studio_invites
    SET accepted_at = now(), accepted_by = NEW.id
    WHERE id = inv.id;
  END LOOP;
  RETURN NEW;
END;
$$;

-- Run AFTER the existing handle_new_user trigger so the profile row exists
DROP TRIGGER IF EXISTS auto_accept_studio_invites_trigger ON public.profiles;
CREATE TRIGGER auto_accept_studio_invites_trigger
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.auto_accept_studio_invites();

-- ============================================================
-- 9. updated_at trigger on studios
-- ============================================================
CREATE TRIGGER studios_updated_at
BEFORE UPDATE ON public.studios
FOR EACH ROW EXECUTE FUNCTION public.tms_set_updated_at();
