# LYVOIRA — presný inventár Supabase (export metadát)

> Zdroj: používateľkou dodaný export 656 záznamov. Tento export obsahuje **štruktúru a oprávnenia**, nie obsah tabuliek (INSERT dáta).

## 15 pôvodných tabuliek a ich stĺpce

### `chat_photo` — 9 stĺpcov

| Stĺpec | Databázový typ | NOT NULL | Default |
|---|---|---|---|
| `bucket` | `text` | nie | `—` |
| `created_at` | `timestamptz` | nie | `now()` |
| `id` | `uuid` | áno | `gen_random_uuid()` |
| `message_id` | `int8` | nie | `—` |
| `meta` | `jsonb` | nie | `—` |
| `mime` | `text` | nie | `—` |
| `object_key` | `text` | nie | `—` |
| `shop_id` | `uuid` | nie | `—` |
| `url` | `text` | nie | `—` |

### `claim_events` — 6 stĺpcov

| Stĺpec | Databázový typ | NOT NULL | Default |
|---|---|---|---|
| `claim_id` | `uuid` | áno | `—` |
| `created_at` | `timestamptz` | áno | `now()` |
| `created_by` | `text` | nie | `—` |
| `id` | `int8` | áno | `nextval('claim_events_id_seq'::regclass)` |
| `payload` | `jsonb` | áno | `'{}'::jsonb` |
| `type` | `text` | áno | `—` |

### `claim_photo` — 8 stĺpcov

| Stĺpec | Databázový typ | NOT NULL | Default |
|---|---|---|---|
| `bucket` | `text` | nie | `—` |
| `claim_id` | `uuid` | nie | `—` |
| `created_at` | `timestamptz` | nie | `now()` |
| `id` | `uuid` | áno | `gen_random_uuid()` |
| `mime` | `text` | nie | `—` |
| `object_key` | `text` | nie | `—` |
| `size_bytes` | `int8` | nie | `—` |
| `url` | `text` | nie | `—` |

### `claims` — 17 stĺpcov

| Stĺpec | Databázový typ | NOT NULL | Default |
|---|---|---|---|
| `admin_reply` | `text` | nie | `—` |
| `admin_reply_at` | `timestamptz` | nie | `—` |
| `ai_assessment` | `text` | nie | `—` |
| `attachments` | `jsonb` | nie | `—` |
| `created_at` | `timestamptz` | nie | `now()` |
| `description` | `text` | nie | `—` |
| `id` | `uuid` | áno | `gen_random_uuid()` |
| `order_id` | `text` | nie | `—` |
| `product_id` | `text` | nie | `—` |
| `purchase_date` | `date` | nie | `—` |
| `shop_id` | `uuid` | nie | `—` |
| `status` | `text` | nie | `'new'::text` |
| `updated_at` | `timestamptz` | nie | `now()` |
| `user_email` | `text` | nie | `—` |
| `user_id` | `text` | nie | `—` |
| `user_name` | `text` | nie | `—` |
| `verdict` | `jsonb` | nie | `—` |

### `claims_photo` — 8 stĺpcov

| Stĺpec | Databázový typ | NOT NULL | Default |
|---|---|---|---|
| `bucket` | `text` | áno | `'claim-files'::text` |
| `claim_id` | `uuid` | nie | `—` |
| `created_at` | `timestamptz` | áno | `now()` |
| `id` | `int8` | áno | `nextval('claims_photo_id_seq'::regclass)` |
| `mime` | `text` | nie | `—` |
| `object_key` | `text` | nie | `—` |
| `size_bytes` | `int8` | nie | `—` |
| `url` | `text` | áno | `—` |

### `messages` — 9 stĺpcov

| Stĺpec | Databázový typ | NOT NULL | Default |
|---|---|---|---|
| `conversation_id` | `text` | nie | `—` |
| `created_at` | `timestamptz` | nie | `now()` |
| `file_url` | `text` | nie | `—` |
| `id` | `int8` | áno | `—` |
| `language` | `text` | nie | `'sk'::text` |
| `message` | `text` | nie | `—` |
| `sender` | `text` | nie | `—` |
| `shop_id` | `uuid` | nie | `—` |
| `user_id` | `text` | áno | `—` |

### `policy_chunks` — 8 stĺpcov

| Stĺpec | Databázový typ | NOT NULL | Default |
|---|---|---|---|
| `chunk_index` | `int4` | nie | `—` |
| `created_at` | `timestamptz` | nie | `now()` |
| `doc_id` | `uuid` | nie | `—` |
| `embedding` | `vector` | nie | `—` |
| `id` | `uuid` | áno | `gen_random_uuid()` |
| `position` | `int4` | nie | `—` |
| `shop_id` | `uuid` | nie | `—` |
| `text` | `text` | nie | `—` |

### `policy_docs` — 6 stĺpcov

| Stĺpec | Databázový typ | NOT NULL | Default |
|---|---|---|---|
| `created_at` | `timestamptz` | nie | `now()` |
| `id` | `uuid` | áno | `gen_random_uuid()` |
| `raw_text` | `text` | áno | `—` |
| `shop_id` | `uuid` | nie | `—` |
| `source_url` | `text` | nie | `—` |
| `title` | `text` | nie | `—` |

### `products` — 16 stĺpcov

| Stĺpec | Databázový typ | NOT NULL | Default |
|---|---|---|---|
| `brand` | `text` | nie | `—` |
| `category` | `text` | nie | `—` |
| `created_at` | `timestamptz` | nie | `now()` |
| `currency` | `text` | nie | `'EUR'::text` |
| `external_id` | `text` | nie | `—` |
| `id` | `uuid` | áno | `gen_random_uuid()` |
| `main_image_url` | `text` | nie | `—` |
| `name` | `text` | áno | `—` |
| `price_cents` | `int4` | nie | `0` |
| `return_window_days` | `int4` | nie | `—` |
| `shop_id` | `uuid` | nie | `—` |
| `sku` | `text` | nie | `—` |
| `slug` | `text` | nie | `—` |
| `specs` | `jsonb` | nie | `—` |
| `url` | `text` | nie | `—` |
| `warranty_months` | `int4` | nie | `—` |

### `shop_policies` — 6 stĺpcov

| Stĺpec | Databázový typ | NOT NULL | Default |
|---|---|---|---|
| `body` | `text` | áno | `—` |
| `created_at` | `timestamptz` | áno | `now()` |
| `id` | `uuid` | áno | `gen_random_uuid()` |
| `lang` | `text` | áno | `'sk'::text` |
| `shop_id` | `uuid` | áno | `—` |
| `title` | `text` | nie | `—` |

### `shop_settings` — 12 stĺpcov

| Stĺpec | Databázový typ | NOT NULL | Default |
|---|---|---|---|
| `answer_style` | `text` | nie | `'concise'::text` |
| `color_primary` | `text` | nie | `'#7c3aed'::text` |
| `color_secondary` | `text` | nie | `'#ec4899'::text` |
| `created_at` | `timestamptz` | nie | `now()` |
| `default_language` | `text` | nie | `'sk'::text` |
| `fallback_language` | `text` | nie | `'en'::text` |
| `logo_url` | `text` | nie | `—` |
| `message_templates` | `jsonb` | nie | `—` |
| `opening_hours` | `jsonb` | nie | `—` |
| `shop_id` | `uuid` | áno | `—` |
| `tone` | `text` | nie | `'neutral'::text` |
| `updated_at` | `timestamptz` | nie | `now()` |

### `shop_theme` — 3 stĺpcov

| Stĺpec | Databázový typ | NOT NULL | Default |
|---|---|---|---|
| `shop_id` | `uuid` | áno | `—` |
| `theme_key` | `text` | áno | `—` |
| `updated_at` | `timestamptz` | áno | `now()` |

### `shop_themes` — 3 stĺpcov

| Stĺpec | Databázový typ | NOT NULL | Default |
|---|---|---|---|
| `shop_id` | `uuid` | áno | `—` |
| `theme_key` | `text` | áno | `—` |
| `updated_at` | `timestamptz` | nie | `now()` |

### `shops` — 7 stĺpcov

| Stĺpec | Databázový typ | NOT NULL | Default |
|---|---|---|---|
| `created_at` | `timestamptz` | nie | `now()` |
| `domain` | `text` | nie | `—` |
| `id` | `uuid` | áno | `gen_random_uuid()` |
| `name` | `text` | áno | `—` |
| `plan` | `text` | áno | `'pro'::text` |
| `slug` | `text` | áno | `—` |
| `support_email` | `text` | nie | `—` |

### `theme_presets` — 4 stĺpcov

| Stĺpec | Databázový typ | NOT NULL | Default |
|---|---|---|---|
| `created_at` | `timestamptz` | áno | `now()` |
| `name` | `text` | áno | `—` |
| `palette` | `jsonb` | áno | `—` |
| `theme_key` | `text` | áno | `—` |

## Väzby, obmedzenia, indexy, RLS, buckety, triggery

Kompletné originálne definície vrátane všetkých 29 constraints, 26 indexov, 15 RLS stavov, 4 pôvodných policies, 5 bucketov, 2 triggerov, 116 funkcií a 315 grantov sú zachované v `SUPABASE_METADATA_EXPORT.csv`.

### Bezpečnostné rozdiely medzi exportom a novou schémou

- V pôvodnej databáze je RLS vypnuté na 13/15 tabuľkách. Nová schéma zapína RLS na všetkých 16 tabuľkách vrátane novej `orders`.
- Pôvodné široké policies a grants **nie sú zámerne kopírované**; bez bezpečných serverových ciest nebudú všetky operácie fungovať.
- V pôvodnom exporte je `vector` v schéme `public`, nie `extensions`. Schéma používa `public.vector(1536)`.
- `orders` v exporte **nie je**. Je to dodatočná demo tabuľka navrhnutá podľa `/api/orders/verify` s `order_id` a `user_email`.
- `claim_photo` a `claims_photo` sú dve odlišné pôvodné tabuľky. Žiadna sa nevymazáva.
- `shop_theme` a `shop_themes` sú dve odlišné pôvodné tabuľky. Žiadna sa nevymazáva.
- Storage buckets sa vytvárajú ako súkromné, aj keď pôvodný export obsahoval 2 verejné.

### Čo export neobsahuje

Konkrétne záznamy (riadky) obchodov, produktov, pravidiel, reklamácií, správ ani objednávok; seed dáta preto nemožno presne rekonštruovať. Export neobsahuje ani bezpečné pravidlá pre celý tok anonymného chatu.

### Reprodukovateľnosť

Použi `supabase/schema.sql` iba na **novej prázdnej databáze**. Vytvor testovací obchod a bezpečné demo dáta osobitne. Následne otestuj jednotlivé API endpointy. Schéma nie je integračne otestovaná.
