
-- LYVOIRA demo data
-- Najprv spusti schema.sql
-- Potom spusti tento seed.sql

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

-- Demo obchodné a reklamačné podmienky
insert into public.policy_docs (
    shop_id,
    title,
    raw_text
)
select
    '11111111-1111-4111-8111-111111111111',
    'Demo obchodné a reklamačné podmienky',
    'LYVOIRA DEMO SHOP – UKÁŽKOVÉ PODMIENKY

Tieto pravidlá sú fiktívne a slúžia výhradne na demonštráciu funkcií aplikácie LYVOIRA.

1. REKLAMÁCIE
Zákazník môže podať reklamáciu pri poškodení, nefunkčnosti alebo inom nedostatku zakúpeného produktu.

2. PODANIE REKLAMÁCIE
Zákazník uvedie číslo objednávky, názov produktu a opis problému. Odporúča sa priložiť fotografiu alebo video poškodenia.

3. POSÚDENIE REKLAMÁCIE
Po prijatí reklamácie obchod preverí poskytnuté informácie. V prípade potreby môže zákazníka požiadať o doplnenie podkladov.

4. MOŽNOSTI VYBAVENIA
Podľa výsledku posúdenia môže byť navrhnutá oprava produktu, výmena produktu alebo vrátenie peňazí.

5. VRÁTENIE TOVARU
Zákazník môže požiadať o vrátenie produktu. Konkrétne podmienky a lehoty sa riadia platnými právnymi predpismi.

6. AI ASISTENT
AI asistent LYVOIRA poskytuje predbežné informácie, pomáha pripraviť reklamáciu a analyzovať priložené fotografie. Konečné rozhodnutie o reklamácii vykonáva obchod.

UPOZORNENIE: Ide o demo pravidlá, nie o skutočné obchodné podmienky ani právne poradenstvo.'
where not exists (
    select 1
    from public.policy_docs
    where shop_id = '11111111-1111-4111-8111-111111111111'
      and title = 'Demo obchodné a reklamačné podmienky'
);

-- Vytvorenie textových častí pre AI
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
  and d.title = 'Demo obchodné a reklamačné podmienky'
  and not exists (
      select 1
      from public.policy_chunks c
      where c.doc_id = d.id
  );

-- Demo objednávka
insert into public.orders (order_id, user_email)
values ('DEMO-1001', 'demo@example.com')
on conflict (order_id) do nothing;
