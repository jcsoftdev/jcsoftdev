ALTER TABLE "projects" ADD COLUMN "hero_media_id" uuid;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_hero_media_id_media_id_fk" FOREIGN KEY ("hero_media_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "projects_portfolio_sort_idx" ON "projects" USING btree ("featured_order","started_at");