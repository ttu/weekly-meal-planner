-- How many people the Household cooks for: the number a new Meal starts at.
-- Same 1..50 range as meal.servings, so the default is never one the Meal
-- editor would refuse. It is a default only; existing Meals keep their own.
alter table household
  add column size integer not null default 4 check (size between 1 and 50);
