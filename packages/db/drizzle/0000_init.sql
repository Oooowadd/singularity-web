CREATE TYPE "public"."platform" AS ENUM('youtube', 'xhs');--> statement-breakpoint
CREATE TYPE "public"."agent" AS ENUM('clerk', 'muse', 'poet');--> statement-breakpoint
CREATE TYPE "public"."run_status" AS ENUM('pending', 'running', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."sop_type" AS ENUM('human', 'ai_reference', 'hottest');--> statement-breakpoint
CREATE TYPE "public"."custom_topic_status" AS ENUM('draft', 'analyzed', 'scripted');--> statement-breakpoint
CREATE TYPE "public"."drift_reason" AS ENUM('no_overlap', 'ai_markers', 'topic_substitution');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('zh', 'en');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"logto_id" text NOT NULL,
	"email" text NOT NULL,
	"display_name" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_logto_id_unique" UNIQUE("logto_id")
);
--> statement-breakpoint
CREATE TABLE "channels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"platform" "platform" NOT NULL,
	"platform_url" text NOT NULL,
	"platform_channel_id" text,
	"description" text,
	"competitors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "channels_user_slug_unique" UNIQUE("user_id","slug")
);
--> statement-breakpoint
CREATE TABLE "pipeline_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"agent" "agent" NOT NULL,
	"command" text NOT NULL,
	"status" "run_status" DEFAULT 'pending' NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"total" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"config_json" jsonb
);
--> statement-breakpoint
CREATE TABLE "clerk_sops" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"sop_type" "sop_type" NOT NULL,
	"language" text DEFAULT 'zh' NOT NULL,
	"content_md" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"run_id" uuid
);
--> statement-breakpoint
CREATE TABLE "clerk_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"platform_video_id" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"views" bigint,
	"duration_sec" integer,
	"thumbnail_url" text,
	"source_channel_name" text,
	"source_channel_id" text,
	"transcript" text,
	"thumbnail_description" text,
	"thumbnail_why_it_works" text,
	"opening_hook" text,
	"opening_hook_type" text,
	"hooks_throughout" text,
	"all_hook_types" text,
	"text_hook" text,
	"framework" text,
	"opening_structure" text,
	"script_structure" text,
	"storytelling_framework" text,
	"rehooks_used" text,
	"retention_pattern" text,
	"cta_placement" text,
	"key_takeaways" text,
	"verbatim_facts" jsonb,
	"analyzed_at" timestamp with time zone,
	"run_id" uuid,
	CONSTRAINT "clerk_videos_channel_video_unique" UNIQUE("channel_id","platform_video_id")
);
--> statement-breakpoint
CREATE TABLE "muse_ideas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"source_video_id" uuid,
	"idea_number" integer NOT NULL,
	"story_angle" text,
	"facts_and_data" text,
	"why_similar" text,
	"viral_trigger" text,
	"approved" boolean DEFAULT false NOT NULL,
	"scripted" boolean DEFAULT false NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"run_id" uuid,
	CONSTRAINT "muse_ideas_source_video_idea_unique" UNIQUE("source_video_id","idea_number")
);
--> statement-breakpoint
CREATE TABLE "muse_monitor_videos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"platform_video_id" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"source_channel_name" text,
	"published_at" timestamp with time zone,
	"duration_sec" integer,
	"transcript" text,
	"relevant" boolean,
	"topic_classification" text,
	"rejection_reason" text,
	"processed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"run_id" uuid,
	CONSTRAINT "muse_monitor_videos_channel_video_unique" UNIQUE("channel_id","platform_video_id")
);
--> statement-breakpoint
CREATE TABLE "poet_bible" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"name" text NOT NULL,
	"content" text NOT NULL,
	"source_idea" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poet_custom_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"topic" text NOT NULL,
	"references" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"story_angle" text,
	"facts_and_data" text,
	"verbatim_facts" text,
	"why_similar" text,
	"viral_trigger" text,
	"status" "custom_topic_status" DEFAULT 'draft' NOT NULL,
	"bible_id" uuid,
	"sop_id" uuid,
	"language" "language" DEFAULT 'zh' NOT NULL,
	"duration_minutes" integer,
	"target_word_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poet_drift_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"bible_id" uuid,
	"reason" "drift_reason" NOT NULL,
	"claimed_topic" text,
	"human_message" text,
	"detected_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "poet_scripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_id" uuid NOT NULL,
	"idea_id" uuid,
	"custom_topic_id" uuid,
	"bible_id" uuid,
	"sop_id" uuid,
	"script_text" text NOT NULL,
	"language" "language" NOT NULL,
	"word_count" integer,
	"duration_minutes" integer,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"run_id" uuid,
	CONSTRAINT "poet_scripts_exactly_one_source" CHECK (("poet_scripts"."idea_id" IS NULL) <> ("poet_scripts"."custom_topic_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "channels" ADD CONSTRAINT "channels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clerk_sops" ADD CONSTRAINT "clerk_sops_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clerk_sops" ADD CONSTRAINT "clerk_sops_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clerk_videos" ADD CONSTRAINT "clerk_videos_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clerk_videos" ADD CONSTRAINT "clerk_videos_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muse_ideas" ADD CONSTRAINT "muse_ideas_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muse_ideas" ADD CONSTRAINT "muse_ideas_source_video_id_muse_monitor_videos_id_fk" FOREIGN KEY ("source_video_id") REFERENCES "public"."muse_monitor_videos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muse_ideas" ADD CONSTRAINT "muse_ideas_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muse_monitor_videos" ADD CONSTRAINT "muse_monitor_videos_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muse_monitor_videos" ADD CONSTRAINT "muse_monitor_videos_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poet_bible" ADD CONSTRAINT "poet_bible_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poet_custom_topics" ADD CONSTRAINT "poet_custom_topics_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poet_custom_topics" ADD CONSTRAINT "poet_custom_topics_bible_id_poet_bible_id_fk" FOREIGN KEY ("bible_id") REFERENCES "public"."poet_bible"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poet_custom_topics" ADD CONSTRAINT "poet_custom_topics_sop_id_clerk_sops_id_fk" FOREIGN KEY ("sop_id") REFERENCES "public"."clerk_sops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poet_drift_events" ADD CONSTRAINT "poet_drift_events_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poet_drift_events" ADD CONSTRAINT "poet_drift_events_bible_id_poet_bible_id_fk" FOREIGN KEY ("bible_id") REFERENCES "public"."poet_bible"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poet_scripts" ADD CONSTRAINT "poet_scripts_channel_id_channels_id_fk" FOREIGN KEY ("channel_id") REFERENCES "public"."channels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poet_scripts" ADD CONSTRAINT "poet_scripts_idea_id_muse_ideas_id_fk" FOREIGN KEY ("idea_id") REFERENCES "public"."muse_ideas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poet_scripts" ADD CONSTRAINT "poet_scripts_custom_topic_id_poet_custom_topics_id_fk" FOREIGN KEY ("custom_topic_id") REFERENCES "public"."poet_custom_topics"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poet_scripts" ADD CONSTRAINT "poet_scripts_bible_id_poet_bible_id_fk" FOREIGN KEY ("bible_id") REFERENCES "public"."poet_bible"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poet_scripts" ADD CONSTRAINT "poet_scripts_sop_id_clerk_sops_id_fk" FOREIGN KEY ("sop_id") REFERENCES "public"."clerk_sops"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "poet_scripts" ADD CONSTRAINT "poet_scripts_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "channels_user_id_idx" ON "channels" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "pipeline_runs_channel_status_idx" ON "pipeline_runs" USING btree ("channel_id","status");--> statement-breakpoint
CREATE INDEX "clerk_sops_channel_id_idx" ON "clerk_sops" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "clerk_videos_channel_id_idx" ON "clerk_videos" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "muse_ideas_queue_idx" ON "muse_ideas" USING btree ("channel_id","approved","scripted");--> statement-breakpoint
CREATE INDEX "muse_monitor_videos_channel_id_idx" ON "muse_monitor_videos" USING btree ("channel_id");--> statement-breakpoint
CREATE INDEX "poet_scripts_channel_id_idx" ON "poet_scripts" USING btree ("channel_id");