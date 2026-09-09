-- ═══════════════════════════════════════════════════════════
-- Groups: leader-created, join requests, approval flow
-- ═══════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  leader_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_name text,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active')),
  created_at timestamptz DEFAULT now(),
  UNIQUE (group_id, user_id)
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "groups_read" ON public.groups;
CREATE POLICY "groups_read" ON public.groups FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "group_members_read" ON public.group_members;
CREATE POLICY "group_members_read" ON public.group_members FOR SELECT TO anon, authenticated USING (true);

-- Writes happen through the server (service key) only