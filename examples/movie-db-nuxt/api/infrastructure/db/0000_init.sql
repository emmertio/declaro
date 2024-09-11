DO $$ BEGIN
 CREATE TYPE "public"."movie_role_type" AS ENUM('ACTOR', 'DIRECTOR', 'PRODUCER', 'OTHER');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 CREATE TYPE "public"."name_order" AS ENUM('FAMILY_FIRST', 'FAMILY_LAST');
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" varchar(256),
	"email" varchar(256)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "movie_roles" (
	"movie_id" integer NOT NULL,
	"person_id" integer NOT NULL,
	"role" "movie_role_type" NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "movies" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" varchar(255),
	"description" text,
	"release_date" date
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "people" (
	"id" serial PRIMARY KEY NOT NULL,
	"given_name" varchar(255),
	"family_name" varchar(255),
	"name_order" "name_order",
	"display_name" varchar(255) GENERATED ALWAYS AS (CASE WHEN name_order = 'FAMILY_FIRST' THEN "people"."family_name" || ' ' || "people"."given_name" ELSE "people"."given_name" || ' ' || "people"."family_name" END) STORED,
	"birth_year" integer
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "movie_roles" ADD CONSTRAINT "movie_roles_movie_id_movies_id_fk" FOREIGN KEY ("movie_id") REFERENCES "public"."movies"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "movie_roles" ADD CONSTRAINT "movie_roles_person_id_people_id_fk" FOREIGN KEY ("person_id") REFERENCES "public"."people"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "movie_person_idx" ON "movie_roles" USING btree ("movie_id","person_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "title_release_date_idx" ON "movies" USING btree ("title","release_date");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "display_name_idx" ON "people" USING btree ("display_name");