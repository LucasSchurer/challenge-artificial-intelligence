-----------------------------------------------
-- 				USER 			
-----------------------------------------------
CREATE TABLE public."user" (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	username varchar NOT NULL,
	"password" varchar NOT NULL,
	profile_info jsonb NULL,
	CONSTRAINT user_pk PRIMARY KEY (id),
	CONSTRAINT user_unique UNIQUE (username)
);

-----------------------------------------------
-- 			KNOWLEDGE_BASE
-----------------------------------------------
CREATE TABLE public.knowledge_base (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	CONSTRAINT knowledge_base_pk PRIMARY KEY (id)
);

-----------------------------------------------
-- 			DOCUMENT
-----------------------------------------------
CREATE TABLE public."document" (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	document_type varchar NOT NULL,
	knowledge_base_id uuid NOT NULL,
	"data" bytea NOT NULL,
	document_extension varchar NOT NULL,
	CONSTRAINT document_pk PRIMARY KEY (id)
);

ALTER TABLE public."document" ADD CONSTRAINT document_knowledge_base_fk FOREIGN KEY (knowledge_base_id) REFERENCES public.knowledge_base(id) ON DELETE CASCADE;

-----------------------------------------------
-- 				CHUNK
-----------------------------------------------
CREATE TABLE public.chunk (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	document_id uuid NOT NULL,
	embedding public.vector NOT NULL,
	"content" varchar NULL,
	"index" int4 NOT NULL,
	CONSTRAINT chunk_pk PRIMARY KEY (id)
);

ALTER TABLE public.chunk ADD CONSTRAINT chunk_document_fk FOREIGN KEY (document_id) REFERENCES public."document"(id) ON DELETE CASCADE;
-----------------------------------------------
-- 				CHAT
-----------------------------------------------
CREATE TABLE public.chat (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	user_id uuid NOT NULL,
	"label" varchar DEFAULT 'New Chat'::character varying NOT NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT chat_pk PRIMARY KEY (id)
);

ALTER TABLE public.chat ADD CONSTRAINT chat_user_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

-----------------------------------------------
-- 				MESSAGE
-----------------------------------------------
CREATE TABLE public.message (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	chat_id uuid NOT NULL,
	text_content text NULL,
	dict_content jsonb NULL,
	content_type varchar NOT NULL,
	"role" varchar NOT NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT message_pk PRIMARY KEY (id)
);

ALTER TABLE public.message ADD CONSTRAINT message_chat_fk FOREIGN KEY (chat_id) REFERENCES public.chat(id) ON DELETE CASCADE;

-------------------------------------------------
-- 				AGENT
-------------------------------------------------
CREATE TABLE public.agent (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	"label" varchar NOT NULL,
	system_prompt varchar NOT NULL,
	output_format jsonb NULL,
	CONSTRAINT agent_pk PRIMARY KEY (id)
);

-----------------------------------------------
-- 				PLAN
-----------------------------------------------
CREATE TABLE public."plan" (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	title varchar NOT NULL,
	description varchar NULL,
	user_id uuid NOT NULL,
	created_at timestamptz DEFAULT now() NOT NULL,
	chat_id uuid NULL,
	status varchar DEFAULT 'creating_outline'::character varying NOT NULL,
	last_viewed_at timestamptz DEFAULT now() NOT NULL,
	CONSTRAINT plan_pk PRIMARY KEY (id)
);

ALTER TABLE public."plan" ADD CONSTRAINT plan_chat_fk FOREIGN KEY (chat_id) REFERENCES public.chat(id) ON DELETE CASCADE;
ALTER TABLE public."plan" ADD CONSTRAINT plan_user_fk FOREIGN KEY (user_id) REFERENCES public."user"(id) ON DELETE CASCADE;

-----------------------------------------------
-- 				MODULE
-----------------------------------------------
CREATE TABLE public."module" (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	plan_id uuid NOT NULL,
	title varchar NOT NULL,
	description varchar NULL,
	"order" int4 DEFAULT 1 NOT NULL,
	status varchar DEFAULT 'creating_outline'::character varying NOT NULL,
	CONSTRAINT module_pk PRIMARY KEY (id)
);

ALTER TABLE public."module" ADD CONSTRAINT module_plan_fk FOREIGN KEY (plan_id) REFERENCES public."plan"(id) ON DELETE CASCADE;

-----------------------------------------------
-- 				CONTENT
-----------------------------------------------
CREATE TABLE public."content" (
	id uuid DEFAULT gen_random_uuid() NOT NULL,
	content_type varchar NOT NULL,
	text_content text NULL,
	module_id uuid NOT NULL,
	title varchar NOT NULL,
	"order" int4 DEFAULT 0 NOT NULL,
	status varchar DEFAULT 'created'::character varying NOT NULL,
	description varchar NULL,
	source_document_id uuid NULL,
	CONSTRAINT content_pk PRIMARY KEY (id)
);

ALTER TABLE public."content" ADD CONSTRAINT content_document_fk FOREIGN KEY (source_document_id) REFERENCES public."document"(id) ON DELETE CASCADE;
ALTER TABLE public."content" ADD CONSTRAINT content_module_fk FOREIGN KEY (module_id) REFERENCES public."module"(id) ON DELETE CASCADE;