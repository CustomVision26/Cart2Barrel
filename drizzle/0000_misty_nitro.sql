CREATE TABLE "profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"clerk_user_id" text NOT NULL,
	"email" text,
	"full_name" text,
	"phone" text,
	"address_line1" text,
	"address_line2" text,
	"city_or_town" text,
	"parish" text,
	"country" text DEFAULT 'Jamaica' NOT NULL,
	"profile_completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_clerk_user_id_unique" UNIQUE("clerk_user_id")
);
