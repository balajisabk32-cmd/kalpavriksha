CREATE TABLE "chapter_explanations" (
	"chapter_id" text NOT NULL,
	"medium" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"data" jsonb NOT NULL,
	"source" text DEFAULT 'gemini' NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone,
	CONSTRAINT "chapter_explanations_chapter_id_medium_pk" PRIMARY KEY("chapter_id","medium")
);
--> statement-breakpoint
ALTER TABLE "chapter_explanations" ADD CONSTRAINT "chapter_explanations_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;