CREATE TABLE "sorteo_regalos"."devices" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"participant_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sorteo_regalos"."exclusions" (
	"giver_id" uuid NOT NULL,
	"excluded_id" uuid NOT NULL,
	CONSTRAINT "exclusions_giver_id_excluded_id_pk" PRIMARY KEY("giver_id","excluded_id")
);
--> statement-breakpoint
CREATE TABLE "sorteo_regalos"."participants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"room_id" text NOT NULL,
	"name" text NOT NULL,
	"name_key" text NOT NULL,
	"code" text NOT NULL,
	"failed_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"assignment_sealed" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "participants_room_name_key" UNIQUE("room_id","name_key"),
	CONSTRAINT "participants_room_code" UNIQUE("room_id","code")
);
--> statement-breakpoint
CREATE TABLE "sorteo_regalos"."rooms" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"admin_secret_hash" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sorteo_regalos"."devices" ADD CONSTRAINT "devices_participant_id_participants_id_fk" FOREIGN KEY ("participant_id") REFERENCES "sorteo_regalos"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sorteo_regalos"."exclusions" ADD CONSTRAINT "exclusions_giver_id_participants_id_fk" FOREIGN KEY ("giver_id") REFERENCES "sorteo_regalos"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sorteo_regalos"."exclusions" ADD CONSTRAINT "exclusions_excluded_id_participants_id_fk" FOREIGN KEY ("excluded_id") REFERENCES "sorteo_regalos"."participants"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sorteo_regalos"."participants" ADD CONSTRAINT "participants_room_id_rooms_id_fk" FOREIGN KEY ("room_id") REFERENCES "sorteo_regalos"."rooms"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "rooms_expires_at_idx" ON "sorteo_regalos"."rooms" USING btree ("expires_at");