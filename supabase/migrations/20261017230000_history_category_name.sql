-- History must not follow the master. A line item already snapshots weight,
-- price_per_kg and value, but its display name was still joined live from
-- waste_categories, so renaming a category rewrote the labels of past
-- weighings, reports and shipment notes. Snapshot the name with the line.
alter table public.deposit_items add column if not exists category_name text;
alter table public.shipment_items add column if not exists category_name text;

-- Existing rows: the current master name is the best value available.
update public.deposit_items i set category_name = c.name
  from public.waste_categories c
  where c.id = i.category_id and i.category_name is null;
update public.shipment_items i set category_name = c.name
  from public.waste_categories c
  where c.id = i.category_id and i.category_name is null;

-- Every line carries its own name from here on (the FK still points at the
-- master for regrouping/reporting by current category).
alter table public.deposit_items alter column category_name set not null;
alter table public.shipment_items alter column category_name set not null;
