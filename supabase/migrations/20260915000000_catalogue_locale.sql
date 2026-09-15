-- A Catalogue Meal exists once per Locale, because its name lives on the row
-- (ADR 0009 puts locale-independent identity on Ingredients, not Meals). Until
-- now nothing recorded which Locale a row was, so the Meal library listed every
-- Catalogue Meal twice — once in Finnish, once in English.
alter table meal
  add column locale text check (locale in ('fi', 'en'));

-- A Household Meal is written in whatever language its Household wrote it in
-- and is never filtered, so its locale stays NULL. A Catalogue Meal must
-- declare one.
alter table meal
  add constraint meal_catalogue_has_locale
  check ((household_id is null) = (locale is not null));

create index meal_catalogue_locale_idx on meal (locale) where household_id is null;
