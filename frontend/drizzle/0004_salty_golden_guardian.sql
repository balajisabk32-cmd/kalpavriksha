CREATE TABLE "practice_chapters" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"standard" smallint NOT NULL,
	"subject_id" text NOT NULL,
	"medium" text,
	"book" text,
	"term" smallint,
	"number" smallint NOT NULL,
	"title" text NOT NULL,
	"app_chapter_id" text,
	"app_chapter_manual" boolean DEFAULT false NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "practice_chapters_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "practice_progress" (
	"user_id" uuid NOT NULL,
	"set_id" integer NOT NULL,
	"item" smallint NOT NULL,
	"state" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_progress_user_id_set_id_item_pk" PRIMARY KEY("user_id","set_id","item")
);
--> statement-breakpoint
CREATE TABLE "practice_sets" (
	"id" serial PRIMARY KEY NOT NULL,
	"chapter_id" integer NOT NULL,
	"kind" text NOT NULL,
	"number" text DEFAULT '' NOT NULL,
	"title" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"mcq_count" integer DEFAULT 0 NOT NULL,
	"storage_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"source_path" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "practice_sets_source_path_unique" UNIQUE("source_path")
);
--> statement-breakpoint
ALTER TABLE "practice_progress" ADD CONSTRAINT "practice_progress_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_progress" ADD CONSTRAINT "practice_progress_set_id_practice_sets_id_fk" FOREIGN KEY ("set_id") REFERENCES "public"."practice_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "practice_sets" ADD CONSTRAINT "practice_sets_chapter_id_practice_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."practice_chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "practice_chapters_subject" ON "practice_chapters" USING btree ("subject_id","medium");--> statement-breakpoint
CREATE INDEX "practice_chapters_app" ON "practice_chapters" USING btree ("app_chapter_id");--> statement-breakpoint
CREATE INDEX "practice_sets_chapter" ON "practice_sets" USING btree ("chapter_id");