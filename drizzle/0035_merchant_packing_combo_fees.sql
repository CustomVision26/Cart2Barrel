CREATE TABLE IF NOT EXISTS "merchant_packing_combo_fees" (
	"id" serial PRIMARY KEY NOT NULL,
	"barrel_count" integer NOT NULL,
	"bin_count" integer NOT NULL,
	"fee_cents" integer NOT NULL,
	"sort_index" integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "merchant_packing_combo_fees_barrel_bin_uidx"
	ON "merchant_packing_combo_fees" USING btree ("barrel_count","bin_count");

CREATE UNIQUE INDEX IF NOT EXISTS "merchant_packing_combo_fees_sort_uidx"
	ON "merchant_packing_combo_fees" USING btree ("sort_index");
