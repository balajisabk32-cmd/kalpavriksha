CREATE TABLE "chapter_pages" (
	"chapter_id" text NOT NULL,
	"textbook_id" integer NOT NULL,
	"start_page" smallint NOT NULL,
	"end_page" smallint NOT NULL,
	CONSTRAINT "chapter_pages_chapter_id_textbook_id_pk" PRIMARY KEY("chapter_id","textbook_id"),
	CONSTRAINT "chapter_pages_range" CHECK ("chapter_pages"."start_page" >= 1 and "chapter_pages"."end_page" >= "chapter_pages"."start_page")
);
--> statement-breakpoint
CREATE TABLE "content_units" (
	"id" serial PRIMARY KEY NOT NULL,
	"standard" smallint NOT NULL,
	"subject_id" text NOT NULL,
	"medium" text NOT NULL,
	"term" smallint,
	"unit_no" smallint,
	"title" text NOT NULL,
	"chapter_id" text,
	"match" text,
	"source" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_units_key" UNIQUE NULLS NOT DISTINCT("standard","subject_id","medium","term","unit_no")
);
--> statement-breakpoint
CREATE TABLE "textbooks" (
	"id" serial PRIMARY KEY NOT NULL,
	"standard" smallint NOT NULL,
	"subject_id" text NOT NULL,
	"medium" text NOT NULL,
	"term" smallint,
	"title" text NOT NULL,
	"storage_key" text NOT NULL,
	"size_bytes" bigint NOT NULL,
	"pages" smallint,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL,
	"uploaded_by" uuid,
	CONSTRAINT "textbooks_storage_key_unique" UNIQUE("storage_key")
);
--> statement-breakpoint
CREATE TABLE "videos" (
	"id" serial PRIMARY KEY NOT NULL,
	"unit_id" integer NOT NULL,
	"kind" text DEFAULT 'lesson' NOT NULL,
	"title" text NOT NULL,
	"youtube_id" text,
	"playlist_id" text,
	"position" smallint NOT NULL,
	"note" text,
	CONSTRAINT "videos_one_source" CHECK (("videos"."youtube_id" is null) <> ("videos"."playlist_id" is null))
);
--> statement-breakpoint
ALTER TABLE "chapter_pages" ADD CONSTRAINT "chapter_pages_textbook_id_textbooks_id_fk" FOREIGN KEY ("textbook_id") REFERENCES "public"."textbooks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "textbooks" ADD CONSTRAINT "textbooks_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "videos" ADD CONSTRAINT "videos_unit_id_content_units_id_fk" FOREIGN KEY ("unit_id") REFERENCES "public"."content_units"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_units_chapter_idx" ON "content_units" USING btree ("chapter_id");--> statement-breakpoint
CREATE INDEX "textbooks_subject_idx" ON "textbooks" USING btree ("standard","subject_id");--> statement-breakpoint
CREATE INDEX "videos_unit_idx" ON "videos" USING btree ("unit_id");