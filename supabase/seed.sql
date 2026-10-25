
-- LYVOIRA demo data
-- Spúšťať iba v novej testovacej Supabase
-- Najprv spusti schema.sql

insert into public.shops (
    id,
    slug,
    name,
    support_email,
    plan
)
values (
    '11111111-1111-4111-8111-111111111111',
    'lyvoira-demo',
    'LYVOIRA Demo Shop',
    'demo@example.com',
    'pro'
)
on conflict (id) do nothing;

insert into public.policy_docs (
    shop_id,
    title,
    raw_text
)
select
    '11111111-1111-4111-8111-111111111111',
    'Demo obchodné podmienky',
    'Zákazník môže požiadať o reklamáciu poškodeného produktu. K reklamácii odporúčame priložiť fotografiu produktu a opis problému. Toto sú iba fiktívne pravidlá určené na testovanie aplikácie.'
where not exists (
    select 1
    from public.policy_docs
    where shop_id = '11111111-1111-4111-8111-111111111111'
      and title = 'Demo obchodné podmienky'
);

insert into public.policy_chunks (
    shop_id,
    doc_id,
    chunk_index,
    position,
    text
)
select
    d.shop_id,
    d.id,
    0,
    0,
    d.raw_text
from public.policy_docs d
where d.shop_id = '11111111-1111-4111-8111-111111111111'
  and d.title = 'Demo obchodné podmienky'
  and not exists (
      select 1
      from public.policy_chunks c
      where c.doc_id = d.id
  );

insert into public.orders (order_id, user_email)
values ('DEMO-1001', 'demo@example.com')
on conflict (order_id) do nothing;
