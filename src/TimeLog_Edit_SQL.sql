-- Focus Flow: safely edit an existing time-log entry, preserving other entries.
-- Run in the EXISTING Focus Flow Supabase SQL Editor after focus_timelog_shared.sql.
create or replace function public.focus_timelog_edit_entry(
  p_entry_id text,
  p_activity text,
  p_started_at timestamptz,
  p_ended_at timestamptz,
  p_expected_started_at timestamptz,
  p_expected_ended_at timestamptz
) returns jsonb
language plpgsql security definer
set search_path = pg_catalog, public
as $function$
declare
  v_uid uuid := auth.uid();
  v_updated integer;
begin
  if v_uid is null then raise exception 'Login required' using errcode='28000'; end if;
  if length(trim(coalesce(p_activity,''))) < 1 or length(trim(p_activity)) > 100 then
    raise exception 'Invalid activity';
  end if;
  if p_started_at is null or p_ended_at is null or p_ended_at <= p_started_at
     or p_ended_at > clock_timestamp() + interval '1 day'
     or p_started_at < clock_timestamp() - interval '10 years' then
    raise exception 'Invalid start or end time';
  end if;
  update public.focus_timelog_entries
  set activity = trim(p_activity), started_at = p_started_at, ended_at = p_ended_at
  where user_id = v_uid and entry_id = p_entry_id
    and started_at = p_expected_started_at and ended_at = p_expected_ended_at;
  get diagnostics v_updated = row_count;
  if v_updated <> 1 then
    raise exception 'This entry has already changed or no longer exists. Refresh and try again.';
  end if;
  return public.focus_timelog_action('read');
end;
$function$;
revoke all on function public.focus_timelog_edit_entry(text,text,timestamptz,timestamptz,timestamptz,timestamptz) from public, anon;
grant execute on function public.focus_timelog_edit_entry(text,text,timestamptz,timestamptz,timestamptz,timestamptz) to authenticated;
