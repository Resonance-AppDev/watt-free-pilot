-- R15 REVIEW CANDIDATE. Apply only with a tested staging worker and rollback plan.
-- Remove WATT's arbitrary 20/day AI job limit, retain room and consent protections.
-- This replaces only the existing trigger function; it does not drop its trigger.
create or replace function public.watt_ai_reply_job_budget_guard()
returns trigger
language plpgsql
security definer
set search_path to ''
as $function$
declare
  room_enabled boolean;
  member_count integer;
  consent_count integer;
  trigger_valid boolean;
begin
  if new.status <> 'pending' then
    raise exception 'JOB_MUST_START_PENDING';
  end if;
  perform 1 from public.watt_pilot_rooms where id=new.room_id for key share;
  perform 1 from public.watt_pilot_messages
    where id=new.trigger_message_id and room_id=new.room_id for key share;
  trigger_valid := found;
  select enabled into room_enabled
    from public.watt_room_ai_settings where room_id=new.room_id for update;
  if not coalesce(room_enabled,false) then
    raise exception 'ROOM_AI_DISABLED';
  end if;
  if not trigger_valid then
    raise exception 'TRIGGER_ROOM_MISMATCH';
  end if;
  select count(*) into member_count
    from public.watt_pilot_members where room_id=new.room_id;
  select count(*) into consent_count
    from public.watt_pilot_members m
    join public.watt_ai_member_consents c
      on c.room_id=m.room_id and c.user_id=m.user_id
    where m.room_id=new.room_id
      and c.allowed=true
      and c.consent_version='watt-ai-room-v1';
  if member_count=0 or member_count<>consent_count then
    raise exception 'ROOM_CONSENT_INCOMPLETE';
  end if;
  return new;
end
$function$;
-- Other legacy quota tables and functions are intentionally untouched.
-- Upstream provider limits, bounded concurrency, zero-cost verification and
-- idempotency must be implemented and tested before enabling the worker.
