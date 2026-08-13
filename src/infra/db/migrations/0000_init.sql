CREATE TABLE "groups" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"default_currency" text NOT NULL,
	"invite_code" text NOT NULL,
	CONSTRAINT "groups_invite_code_unique" UNIQUE("invite_code")
);
--> statement-breakpoint
ALTER TABLE "groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "members" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"user_id" text NOT NULL,
	"display_name" text NOT NULL,
	CONSTRAINT "members_group_id_user_id_unique" UNIQUE("group_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "members" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payment_bearers" (
	"payment_id" text NOT NULL,
	"member_id" text NOT NULL,
	CONSTRAINT "payment_bearers_pkey" PRIMARY KEY("payment_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "payment_bearers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"payer_member_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"occurred_on" date NOT NULL,
	"description" text NOT NULL,
	"recorded_by" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "payments" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "place_mappings" (
	"service" text NOT NULL,
	"place_id" text NOT NULL,
	"group_id" text NOT NULL,
	CONSTRAINT "place_mappings_pkey" PRIMARY KEY("service","place_id")
);
--> statement-breakpoint
ALTER TABLE "place_mappings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "transfers" (
	"id" text PRIMARY KEY NOT NULL,
	"group_id" text NOT NULL,
	"sender_member_id" text NOT NULL,
	"recipient_member_id" text NOT NULL,
	"amount" bigint NOT NULL,
	"currency" text NOT NULL,
	"occurred_on" date NOT NULL,
	"recorded_by" text NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"version" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
ALTER TABLE "transfers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"login_identifier" text NOT NULL,
	CONSTRAINT "users_login_identifier_unique" UNIQUE("login_identifier")
);
--> statement-breakpoint
ALTER TABLE "users" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_bearers" ADD CONSTRAINT "payment_bearers_payment_id_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."payments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_bearers" ADD CONSTRAINT "payment_bearers_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_payer_member_id_members_id_fk" FOREIGN KEY ("payer_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "place_mappings" ADD CONSTRAINT "place_mappings_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_group_id_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_sender_member_id_members_id_fk" FOREIGN KEY ("sender_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_recipient_member_id_members_id_fk" FOREIGN KEY ("recipient_member_id") REFERENCES "public"."members"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transfers" ADD CONSTRAINT "transfers_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "members_group_id_idx" ON "members" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "payments_group_id_idx" ON "payments" USING btree ("group_id");--> statement-breakpoint
CREATE INDEX "transfers_group_id_idx" ON "transfers" USING btree ("group_id");--> statement-breakpoint
CREATE POLICY "groups_deny_all" ON "groups" AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "members_deny_all" ON "members" AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "payment_bearers_deny_all" ON "payment_bearers" AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "payments_deny_all" ON "payments" AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "place_mappings_deny_all" ON "place_mappings" AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "transfers_deny_all" ON "transfers" AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);--> statement-breakpoint
CREATE POLICY "users_deny_all" ON "users" AS PERMISSIVE FOR ALL TO public USING (false) WITH CHECK (false);