create extension if not exists pgcrypto;
create table public.competitions(
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id),
 title text not null check(length(trim(title))>0),
 modality text not null check(modality in ('Corrida','Natação')),
 access_code text not null unique,
 status text not null default 'draft' check(status in ('draft','running','finished')),
 created_at timestamptz not null default now(), started_at timestamptz, finished_at timestamptz
);
create table public.participants(
 id uuid primary key default gen_random_uuid(),
 competition_id uuid not null references public.competitions(id),
 bib_number integer not null check(bib_number>0), display_name text,
 unique(competition_id,bib_number)
);
create table public.competition_events(
 id bigint generated always as identity primary key,
 competition_id uuid not null references public.competitions(id),
 client_event_id uuid not null, device_sequence bigint not null check(device_sequence>0),
 event_type text not null check(event_type in ('participant_added','start_all','participant_finished','competition_finished')),
 participant_number integer, elapsed_ms bigint check(elapsed_ms is null or elapsed_ms>=0),
 device_recorded_at timestamptz not null, server_recorded_at timestamptz not null default now(),
 payload jsonb not null default '{}'::jsonb,
 unique(competition_id,client_event_id), unique(competition_id,device_sequence)
);
create index on public.competition_events(competition_id,device_sequence);
alter table public.competitions enable row level security;
alter table public.participants enable row level security;
alter table public.competition_events enable row level security;
create policy owner_competitions_read on public.competitions for select to authenticated using(owner_id=auth.uid());
create policy owner_participants_read on public.participants for select to authenticated using(exists(select 1 from public.competitions c where c.id=competition_id and c.owner_id=auth.uid()));
create policy owner_events_read on public.competition_events for select to authenticated using(exists(select 1 from public.competitions c where c.id=competition_id and c.owner_id=auth.uid()));

create or replace function public.create_competition(p_title text,p_modality text)
returns table(competition_id uuid,access_code text)
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_id uuid;v_code text;
begin
 if auth.uid() is null then raise exception 'Autenticação obrigatória';end if;
 if p_modality not in ('Corrida','Natação') then raise exception 'Modalidade inválida';end if;
 if trim(coalesce(p_title,''))='' then raise exception 'Informe o título';end if;
 loop v_code:=upper(substr(encode(gen_random_bytes(5),'hex'),1,8));
 exit when not exists(select 1 from public.competitions where access_code=v_code);end loop;
 insert into public.competitions(owner_id,title,modality,access_code) values(auth.uid(),trim(p_title),p_modality) returning id into v_id;
 return query select v_id,v_code;
end $$;

create or replace function public.append_competition_event(
 p_competition_id uuid,p_client_event_id uuid,p_event_type text,p_device_sequence bigint,
 p_device_recorded_at timestamptz,p_participant_number integer default null,
 p_elapsed_ms bigint default null,p_payload jsonb default '{}'::jsonb
) returns bigint language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.competitions%rowtype;v_id bigint;v_prev bigint;
begin
 select * into c from public.competitions where id=p_competition_id and owner_id=auth.uid() for update;
 if not found then raise exception 'Competição não encontrada ou sem permissão';end if;
 select id into v_id from public.competition_events where competition_id=p_competition_id and client_event_id=p_client_event_id;
 if v_id is not null then return v_id;end if;
 if c.status='finished' then raise exception 'Competição encerrada';end if;
 select max(device_sequence) into v_prev from public.competition_events where competition_id=p_competition_id;
 if p_device_sequence<>coalesce(v_prev,0)+1 then raise exception 'Sequência fora de ordem';end if;
 if p_event_type='participant_added' then
  if c.status<>'draft' then raise exception 'Cadastro fechado';end if;
  insert into public.participants(competition_id,bib_number,display_name)
  values(p_competition_id,p_participant_number,nullif(trim(p_payload->>'display_name'),''));
 elsif p_event_type='start_all' then
  if c.status<>'draft' or not exists(select 1 from public.participants where competition_id=p_competition_id) then raise exception 'Não é possível iniciar';end if;
  update public.competitions set status='running',started_at=p_device_recorded_at where id=p_competition_id;
 elsif p_event_type='participant_finished' then
  if c.status<>'running' or p_participant_number is null or p_elapsed_ms is null then raise exception 'Chegada inválida';end if;
  if not exists(select 1 from public.participants where competition_id=p_competition_id and bib_number=p_participant_number) then raise exception 'Número não cadastrado';end if;
  if exists(select 1 from public.competition_events where competition_id=p_competition_id and event_type='participant_finished' and participant_number=p_participant_number) then raise exception 'Chegada já registrada';end if;
 elsif p_event_type='competition_finished' then
  if c.status<>'running' then raise exception 'Prova não está em andamento';end if;
  update public.competitions set status='finished',finished_at=p_device_recorded_at where id=p_competition_id;
 else raise exception 'Evento inválido';end if;
 insert into public.competition_events(competition_id,client_event_id,device_sequence,event_type,participant_number,elapsed_ms,device_recorded_at,payload)
 values(p_competition_id,p_client_event_id,p_device_sequence,p_event_type,p_participant_number,p_elapsed_ms,p_device_recorded_at,coalesce(p_payload,'{}'::jsonb))
 returning id into v_id;return v_id;
end $$;

create or replace function public.get_public_competition(p_access_code text)
returns jsonb language sql security definer set search_path=public,pg_temp as $$
 select jsonb_build_object('title',c.title,'modality',c.modality,'status',c.status,
 'participants',coalesce((select jsonb_agg(jsonb_build_object('number',p.bib_number,'name',p.display_name,'elapsed_ms',
 (select e.elapsed_ms from public.competition_events e where e.competition_id=c.id and e.event_type='participant_finished' and e.participant_number=p.bib_number order by e.device_sequence limit 1)) order by p.bib_number)
 from public.participants p where p.competition_id=c.id),'[]'::jsonb))
 from public.competitions c where c.access_code=upper(trim(p_access_code));
$$;

create or replace function public.reject_event_mutation() returns trigger language plpgsql as $$
begin raise exception 'Eventos são imutáveis';end $$;
create trigger immutable_events before update or delete on public.competition_events for each row execute function public.reject_event_mutation();

revoke all on function public.create_competition(text,text) from public;
revoke all on function public.append_competition_event(uuid,uuid,text,bigint,timestamptz,integer,bigint,jsonb) from public;
grant execute on function public.create_competition(text,text) to authenticated;
grant execute on function public.append_competition_event(uuid,uuid,text,bigint,timestamptz,integer,bigint,jsonb) to authenticated;
grant execute on function public.get_public_competition(text) to anon,authenticated;
