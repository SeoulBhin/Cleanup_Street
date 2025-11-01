--
-- PostgreSQL database dump
--

\restrict lvodD6jkpyFOwW40YDAAzwD5zSnj3gXO4PLINAQtZUoEldmqRY6Iyv46xYC61Je

-- Dumped from database version 16.10
-- Dumped by pg_dump version 16.10

-- Started on 2025-11-01 12:49:38

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 5 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: pg_database_owner
--

CREATE SCHEMA public;


ALTER SCHEMA public OWNER TO pg_database_owner;

--
-- TOC entry 5940 (class 0 OID 0)
-- Dependencies: 5
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: pg_database_owner
--

COMMENT ON SCHEMA public IS 'standard public schema';


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 234 (class 1259 OID 17641)
-- Name: alerts_master; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.alerts_master (
    alert_id bigint NOT NULL,
    message character varying(255) NOT NULL,
    target_type character varying(30),
    target_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT alerts_master_message_check CHECK ((char_length((message)::text) > 0))
);


ALTER TABLE public.alerts_master OWNER TO postgres;

--
-- TOC entry 5941 (class 0 OID 0)
-- Dependencies: 234
-- Name: TABLE alerts_master; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.alerts_master IS '알림 저장 테이블';


--
-- TOC entry 5942 (class 0 OID 0)
-- Dependencies: 234
-- Name: COLUMN alerts_master.alert_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.alerts_master.alert_id IS '알림 ID (PK)';


--
-- TOC entry 5943 (class 0 OID 0)
-- Dependencies: 234
-- Name: COLUMN alerts_master.message; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.alerts_master.message IS '알림 내용';


--
-- TOC entry 5944 (class 0 OID 0)
-- Dependencies: 234
-- Name: COLUMN alerts_master.target_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.alerts_master.target_type IS '알림 대상 (댓글 , 좋아요,)';


--
-- TOC entry 5945 (class 0 OID 0)
-- Dependencies: 234
-- Name: COLUMN alerts_master.target_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.alerts_master.target_id IS '알림 대상 ID';


--
-- TOC entry 5946 (class 0 OID 0)
-- Dependencies: 234
-- Name: COLUMN alerts_master.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.alerts_master.created_at IS '알림 생성 일';


--
-- TOC entry 233 (class 1259 OID 17640)
-- Name: alerts_master_alert_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.alerts_master_alert_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.alerts_master_alert_id_seq OWNER TO postgres;

--
-- TOC entry 5947 (class 0 OID 0)
-- Dependencies: 233
-- Name: alerts_master_alert_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.alerts_master_alert_id_seq OWNED BY public.alerts_master.alert_id;


--
-- TOC entry 226 (class 1259 OID 17535)
-- Name: comments; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.comments (
    comment_id bigint NOT NULL,
    post_id bigint NOT NULL,
    user_id bigint NOT NULL,
    content text NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.comments OWNER TO postgres;

--
-- TOC entry 5948 (class 0 OID 0)
-- Dependencies: 226
-- Name: TABLE comments; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.comments IS '게시글 댓글 정보 테이블';


--
-- TOC entry 5949 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN comments.comment_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.comments.comment_id IS '댓글 고유 ID (PK)';


--
-- TOC entry 5950 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN comments.post_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.comments.post_id IS '댓글이 달린 게시글 ID (FK)';


--
-- TOC entry 5951 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN comments.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.comments.user_id IS '댓글 작성자 ID (FK)';


--
-- TOC entry 5952 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN comments.content; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.comments.content IS '댓글 내용';


--
-- TOC entry 5953 (class 0 OID 0)
-- Dependencies: 226
-- Name: COLUMN comments.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.comments.created_at IS '댓글 작성 일';


--
-- TOC entry 225 (class 1259 OID 17534)
-- Name: comments_comment_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.comments_comment_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.comments_comment_id_seq OWNER TO postgres;

--
-- TOC entry 5954 (class 0 OID 0)
-- Dependencies: 225
-- Name: comments_comment_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.comments_comment_id_seq OWNED BY public.comments.comment_id;


--
-- TOC entry 237 (class 1259 OID 17673)
-- Name: email_verifications; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.email_verifications (
    id integer NOT NULL,
    email character varying(255) NOT NULL,
    code character varying(6) NOT NULL,
    purpose character varying(20) NOT NULL,
    verified boolean DEFAULT false NOT NULL,
    expires_at timestamp without time zone NOT NULL,
    created_at timestamp without time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.email_verifications OWNER TO postgres;

--
-- TOC entry 5955 (class 0 OID 0)
-- Dependencies: 237
-- Name: TABLE email_verifications; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.email_verifications IS '회원가입 및 비밀번호 찾기 시 이메일 인증 코드 저장 테이블';


--
-- TOC entry 5956 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN email_verifications.id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.email_verifications.id IS '고유 식별자 (PK)';


--
-- TOC entry 5957 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN email_verifications.email; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.email_verifications.email IS '인증 할 이메일';


--
-- TOC entry 5958 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN email_verifications.code; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.email_verifications.code IS '발급된 인증 코드';


--
-- TOC entry 5959 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN email_verifications.purpose; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.email_verifications.purpose IS '인증 목적 (회원가입, 비밀번호 재설정)';


--
-- TOC entry 5960 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN email_verifications.verified; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.email_verifications.verified IS '인증 성공 여부';


--
-- TOC entry 5961 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN email_verifications.expires_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.email_verifications.expires_at IS '인증 코드 만료 시간';


--
-- TOC entry 5962 (class 0 OID 0)
-- Dependencies: 237
-- Name: COLUMN email_verifications.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.email_verifications.created_at IS '인증 요청 생성 시간';


--
-- TOC entry 236 (class 1259 OID 17672)
-- Name: email_verifications_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.email_verifications_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.email_verifications_id_seq OWNER TO postgres;

--
-- TOC entry 5963 (class 0 OID 0)
-- Dependencies: 236
-- Name: email_verifications_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.email_verifications_id_seq OWNED BY public.email_verifications.id;


--
-- TOC entry 232 (class 1259 OID 17611)
-- Name: post_images; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.post_images (
    image_id bigint NOT NULL,
    post_id bigint NOT NULL,
    image_url character varying(500) NOT NULL,
    created_at timestamp without time zone DEFAULT now()
);


ALTER TABLE public.post_images OWNER TO postgres;

--
-- TOC entry 5964 (class 0 OID 0)
-- Dependencies: 232
-- Name: TABLE post_images; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.post_images IS '게시글 이미지 테이블';


--
-- TOC entry 5965 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN post_images.image_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.post_images.image_id IS '이미지 고유 ID (PK)';


--
-- TOC entry 5966 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN post_images.post_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.post_images.post_id IS '게시글 ID (FK)';


--
-- TOC entry 5967 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN post_images.image_url; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.post_images.image_url IS '이미지 URL 저장 경로';


--
-- TOC entry 5968 (class 0 OID 0)
-- Dependencies: 232
-- Name: COLUMN post_images.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.post_images.created_at IS '이미지 업로드 일';


--
-- TOC entry 231 (class 1259 OID 17610)
-- Name: post_images_image_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.post_images_image_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.post_images_image_id_seq OWNER TO postgres;

--
-- TOC entry 5969 (class 0 OID 0)
-- Dependencies: 231
-- Name: post_images_image_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.post_images_image_id_seq OWNED BY public.post_images.image_id;


--
-- TOC entry 228 (class 1259 OID 17561)
-- Name: post_reactions; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.post_reactions (
    reaction_id bigint NOT NULL,
    post_id bigint NOT NULL,
    user_id bigint NOT NULL,
    reaction_type character varying(20) NOT NULL,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT post_reactions_reaction_type_check CHECK (((reaction_type)::text = ANY ((ARRAY['LIKE'::character varying, 'DISLIKE'::character varying])::text[])))
);


ALTER TABLE public.post_reactions OWNER TO postgres;

--
-- TOC entry 5970 (class 0 OID 0)
-- Dependencies: 228
-- Name: TABLE post_reactions; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.post_reactions IS '게시글에 대해 사용자가 남긴 반응(좋아요 등)';


--
-- TOC entry 5971 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN post_reactions.reaction_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.post_reactions.reaction_id IS '리액션 고유 ID (PK)';


--
-- TOC entry 5972 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN post_reactions.post_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.post_reactions.post_id IS '게시글 ID (FK)';


--
-- TOC entry 5973 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN post_reactions.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.post_reactions.user_id IS '사용자 ID (FK)';


--
-- TOC entry 5974 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN post_reactions.reaction_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.post_reactions.reaction_type IS '리액션 타입 (좋아요만 둘지 싫어요도 같이 둘지 고민)';


--
-- TOC entry 5975 (class 0 OID 0)
-- Dependencies: 228
-- Name: COLUMN post_reactions.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.post_reactions.created_at IS '리액션 생성 일';


--
-- TOC entry 227 (class 1259 OID 17560)
-- Name: post_reactions_reaction_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.post_reactions_reaction_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.post_reactions_reaction_id_seq OWNER TO postgres;

--
-- TOC entry 5976 (class 0 OID 0)
-- Dependencies: 227
-- Name: post_reactions_reaction_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.post_reactions_reaction_id_seq OWNED BY public.post_reactions.reaction_id;


--
-- TOC entry 224 (class 1259 OID 17504)
-- Name: posts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.posts (
    post_id bigint NOT NULL,
    user_id bigint NOT NULL,
    title character varying(255) NOT NULL,
    content text,
    location public.geography(Point,4326),
    type character varying(20) NOT NULL,
    category character varying(20),
    status character varying(20) DEFAULT 'ACTIVE'::character varying,
    comment_count integer DEFAULT 0,
    created_at timestamp without time zone DEFAULT now(),
    updated_at timestamp without time zone DEFAULT now(),
    h3_index bigint,
    CONSTRAINT posts_category_check CHECK (((category)::text = ANY ((ARRAY['FREE'::character varying, 'TOPIC'::character varying, 'GROUP'::character varying, 'SHARING'::character varying])::text[]))),
    CONSTRAINT posts_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'RESOLVED'::character varying, 'DELETED'::character varying])::text[]))),
    CONSTRAINT posts_type_check CHECK (((type)::text = ANY ((ARRAY['REPORT'::character varying, 'NOTICE'::character varying, 'FREE'::character varying])::text[])))
);


ALTER TABLE public.posts OWNER TO postgres;

--
-- TOC entry 5977 (class 0 OID 0)
-- Dependencies: 224
-- Name: TABLE posts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.posts IS '커뮤니티 게시글 정보 테이블';


--
-- TOC entry 5978 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN posts.post_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.posts.post_id IS '게시글 고유 ID (PK)';


--
-- TOC entry 5979 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN posts.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.posts.user_id IS '작성자 ID (FK -> users)';


--
-- TOC entry 5980 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN posts.title; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.posts.title IS '게시글 제목';


--
-- TOC entry 5981 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN posts.content; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.posts.content IS '게시글 내용';


--
-- TOC entry 5982 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN posts.location; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.posts.location IS '게시글 위치 정보';


--
-- TOC entry 5983 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN posts.category; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.posts.category IS '카테고리';


--
-- TOC entry 5984 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN posts.status; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.posts.status IS '게시글 상태 (처리중, 처리완료)';


--
-- TOC entry 5985 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN posts.comment_count; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.posts.comment_count IS '댓글 수';


--
-- TOC entry 5986 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN posts.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.posts.created_at IS '게시글 생성 일';


--
-- TOC entry 5987 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN posts.updated_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.posts.updated_at IS '게시글 수정 일';


--
-- TOC entry 5988 (class 0 OID 0)
-- Dependencies: 224
-- Name: COLUMN posts.h3_index; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.posts.h3_index IS '공간 검색용 H3 인덱스';


--
-- TOC entry 223 (class 1259 OID 17503)
-- Name: posts_post_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.posts_post_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.posts_post_id_seq OWNER TO postgres;

--
-- TOC entry 5989 (class 0 OID 0)
-- Dependencies: 223
-- Name: posts_post_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.posts_post_id_seq OWNED BY public.posts.post_id;


--
-- TOC entry 230 (class 1259 OID 17583)
-- Name: reports; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.reports (
    report_id bigint NOT NULL,
    target_type character varying(20) NOT NULL,
    target_id bigint NOT NULL,
    user_id bigint NOT NULL,
    reason character varying(255),
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT reports_target_type_check CHECK (((target_type)::text = ANY ((ARRAY['POST'::character varying, 'COMMET'::character varying])::text[])))
);


ALTER TABLE public.reports OWNER TO postgres;

--
-- TOC entry 5990 (class 0 OID 0)
-- Dependencies: 230
-- Name: TABLE reports; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.reports IS '사용자 신고 테이블';


--
-- TOC entry 5991 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN reports.report_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.reports.report_id IS '신고 고유 ID (PK)';


--
-- TOC entry 5992 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN reports.target_type; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.reports.target_type IS '신고 대상 타입 (게시글, 사용자 댓글 등)';


--
-- TOC entry 5993 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN reports.target_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.reports.target_id IS '신고 대상 ID';


--
-- TOC entry 5994 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN reports.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.reports.user_id IS '신고한 사용자 ID';


--
-- TOC entry 5995 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN reports.reason; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.reports.reason IS '신고 사유';


--
-- TOC entry 5996 (class 0 OID 0)
-- Dependencies: 230
-- Name: COLUMN reports.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.reports.created_at IS '신고 생성 시각';


--
-- TOC entry 229 (class 1259 OID 17582)
-- Name: reports_report_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.reports_report_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.reports_report_id_seq OWNER TO postgres;

--
-- TOC entry 5997 (class 0 OID 0)
-- Dependencies: 229
-- Name: reports_report_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.reports_report_id_seq OWNED BY public.reports.report_id;


--
-- TOC entry 235 (class 1259 OID 17651)
-- Name: user_alerts; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.user_alerts (
    user_id bigint NOT NULL,
    alert_id bigint NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    delivered_at timestamp with time zone DEFAULT now() NOT NULL
);


ALTER TABLE public.user_alerts OWNER TO postgres;

--
-- TOC entry 5998 (class 0 OID 0)
-- Dependencies: 235
-- Name: TABLE user_alerts; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.user_alerts IS '사용자가 받은 알림 테이블';


--
-- TOC entry 5999 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN user_alerts.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_alerts.user_id IS '알림 수신자 사용자 ID';


--
-- TOC entry 6000 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN user_alerts.alert_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_alerts.alert_id IS '알림 ID (FK)';


--
-- TOC entry 6001 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN user_alerts.is_read; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_alerts.is_read IS '알림 읽음 여부';


--
-- TOC entry 6002 (class 0 OID 0)
-- Dependencies: 235
-- Name: COLUMN user_alerts.delivered_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.user_alerts.delivered_at IS '사용자에게 전달된 시간';


--
-- TOC entry 217 (class 1259 OID 16408)
-- Name: users; Type: TABLE; Schema: public; Owner: postgres
--

CREATE TABLE public.users (
    user_id bigint NOT NULL,
    username character varying(30) NOT NULL,
    email character varying(100) NOT NULL,
    password character varying(255) NOT NULL,
    role character varying(10) DEFAULT 'USER'::character varying,
    created_at timestamp without time zone DEFAULT now(),
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['USER'::character varying, 'ADMIN'::character varying])::text[])))
);


ALTER TABLE public.users OWNER TO postgres;

--
-- TOC entry 6003 (class 0 OID 0)
-- Dependencies: 217
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON TABLE public.users IS '서비스 사용자 계정 정보 테이블';


--
-- TOC entry 6004 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN users.user_id; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.user_id IS '회원 고유 ID (PK)';


--
-- TOC entry 6005 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN users.username; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.username IS '닉네임';


--
-- TOC entry 6006 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN users.email; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.email IS '사용자 이메일 (로그인 및 인증에 사용)';


--
-- TOC entry 6007 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN users.password; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.password IS '비밀번호(해쉬처리함)';


--
-- TOC entry 6008 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN users.role; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.role IS '사용자 권한 (USER, ADMIN)';


--
-- TOC entry 6009 (class 0 OID 0)
-- Dependencies: 217
-- Name: COLUMN users.created_at; Type: COMMENT; Schema: public; Owner: postgres
--

COMMENT ON COLUMN public.users.created_at IS '가입 일';


--
-- TOC entry 216 (class 1259 OID 16407)
-- Name: users_user_id_seq; Type: SEQUENCE; Schema: public; Owner: postgres
--

CREATE SEQUENCE public.users_user_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE public.users_user_id_seq OWNER TO postgres;

--
-- TOC entry 6010 (class 0 OID 0)
-- Dependencies: 216
-- Name: users_user_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: postgres
--

ALTER SEQUENCE public.users_user_id_seq OWNED BY public.users.user_id;


--
-- TOC entry 5714 (class 2604 OID 17644)
-- Name: alerts_master alert_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts_master ALTER COLUMN alert_id SET DEFAULT nextval('public.alerts_master_alert_id_seq'::regclass);


--
-- TOC entry 5706 (class 2604 OID 17538)
-- Name: comments comment_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments ALTER COLUMN comment_id SET DEFAULT nextval('public.comments_comment_id_seq'::regclass);


--
-- TOC entry 5718 (class 2604 OID 17676)
-- Name: email_verifications id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_verifications ALTER COLUMN id SET DEFAULT nextval('public.email_verifications_id_seq'::regclass);


--
-- TOC entry 5712 (class 2604 OID 17614)
-- Name: post_images image_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_images ALTER COLUMN image_id SET DEFAULT nextval('public.post_images_image_id_seq'::regclass);


--
-- TOC entry 5708 (class 2604 OID 17564)
-- Name: post_reactions reaction_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_reactions ALTER COLUMN reaction_id SET DEFAULT nextval('public.post_reactions_reaction_id_seq'::regclass);


--
-- TOC entry 5701 (class 2604 OID 17507)
-- Name: posts post_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts ALTER COLUMN post_id SET DEFAULT nextval('public.posts_post_id_seq'::regclass);


--
-- TOC entry 5710 (class 2604 OID 17586)
-- Name: reports report_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports ALTER COLUMN report_id SET DEFAULT nextval('public.reports_report_id_seq'::regclass);


--
-- TOC entry 5698 (class 2604 OID 16411)
-- Name: users user_id; Type: DEFAULT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users ALTER COLUMN user_id SET DEFAULT nextval('public.users_user_id_seq'::regclass);


--
-- TOC entry 5931 (class 0 OID 17641)
-- Dependencies: 234
-- Data for Name: alerts_master; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.alerts_master (alert_id, message, target_type, target_id, created_at) FROM stdin;
\.


--
-- TOC entry 5923 (class 0 OID 17535)
-- Dependencies: 226
-- Data for Name: comments; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.comments (comment_id, post_id, user_id, content, created_at) FROM stdin;
1	1	1	저도 확인했습니다. 심각하네요.	2025-09-26 02:04:52.315981
\.


--
-- TOC entry 5934 (class 0 OID 17673)
-- Dependencies: 237
-- Data for Name: email_verifications; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.email_verifications (id, email, code, purpose, verified, expires_at, created_at) FROM stdin;
1	gildong@example.com	241052	REGISTER	f	2025-10-13 20:31:06.058	2025-10-13 18:08:59.790748
8	rkdnah2s0608@gmail.com	854293	REGISTER	f	2025-10-13 20:39:37.706	2025-10-13 20:36:37.707126
5	rkdnahs0608@gmail.com	151142	REGISTER	f	2025-10-14 01:02:20.776	2025-10-13 20:28:22.194197
9	qusrmawls02@naver.com	360634	REGISTER	f	2025-10-14 11:53:25.709	2025-10-13 20:36:58.909165
12	qusrmawls02@naver.com	483660	RESET_PASSWORD	f	2025-10-14 12:43:55.799	2025-10-14 00:07:00.030946
\.


--
-- TOC entry 5929 (class 0 OID 17611)
-- Dependencies: 232
-- Data for Name: post_images; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.post_images (image_id, post_id, image_url, created_at) FROM stdin;
1	1	https://example.com/image1.jpg	2025-09-26 02:04:52.315981
\.


--
-- TOC entry 5925 (class 0 OID 17561)
-- Dependencies: 228
-- Data for Name: post_reactions; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.post_reactions (reaction_id, post_id, user_id, reaction_type, created_at) FROM stdin;
\.


--
-- TOC entry 5921 (class 0 OID 17504)
-- Dependencies: 224
-- Data for Name: posts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.posts (post_id, user_id, title, content, location, type, category, status, comment_count, created_at, updated_at, h3_index) FROM stdin;
1	1	쓰레기 무단투기 제보	공원 옆에 쓰레기가 많이 쌓여 있습니다.	0101000020E6100000D74FFF59F30360405B3FFD67CD8F4140	REPORT	\N	ACTIVE	0	2025-09-26 02:04:52.315981	2025-09-26 02:04:52.315981	\N
\.


--
-- TOC entry 5927 (class 0 OID 17583)
-- Dependencies: 230
-- Data for Name: reports; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.reports (report_id, target_type, target_id, user_id, reason, created_at) FROM stdin;
\.


--
-- TOC entry 5697 (class 0 OID 16745)
-- Dependencies: 219
-- Data for Name: spatial_ref_sys; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.spatial_ref_sys (srid, auth_name, auth_srid, srtext, proj4text) FROM stdin;
\.


--
-- TOC entry 5932 (class 0 OID 17651)
-- Dependencies: 235
-- Data for Name: user_alerts; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.user_alerts (user_id, alert_id, is_read, delivered_at) FROM stdin;
\.


--
-- TOC entry 5919 (class 0 OID 16408)
-- Dependencies: 217
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: postgres
--

COPY public.users (user_id, username, email, password, role, created_at) FROM stdin;
1	홍길동	hong@example.com	1234	USER	2025-09-26 02:04:52.315981
2	hong	hong@naver.com	$2b$10$.XnJsgSVCM5NzLM/5zErkebANFXSVzWKNVlgpRhvubqWXP0./u36G	USER	2025-10-10 17:57:48.95746
6	김명준	rkdnahs0608@gmail.com	$2b$10$jC8Fj52iY.f4T3PgsGEDPukvMPfOjmZFBfWdbzVo1MRkqEnFW2x.2	USER	2025-10-14 01:00:48.039271
\.


--
-- TOC entry 6011 (class 0 OID 0)
-- Dependencies: 233
-- Name: alerts_master_alert_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.alerts_master_alert_id_seq', 1, false);


--
-- TOC entry 6012 (class 0 OID 0)
-- Dependencies: 225
-- Name: comments_comment_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.comments_comment_id_seq', 1, true);


--
-- TOC entry 6013 (class 0 OID 0)
-- Dependencies: 236
-- Name: email_verifications_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.email_verifications_id_seq', 16, true);


--
-- TOC entry 6014 (class 0 OID 0)
-- Dependencies: 231
-- Name: post_images_image_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.post_images_image_id_seq', 1, true);


--
-- TOC entry 6015 (class 0 OID 0)
-- Dependencies: 227
-- Name: post_reactions_reaction_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.post_reactions_reaction_id_seq', 1, false);


--
-- TOC entry 6016 (class 0 OID 0)
-- Dependencies: 223
-- Name: posts_post_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.posts_post_id_seq', 1, true);


--
-- TOC entry 6017 (class 0 OID 0)
-- Dependencies: 229
-- Name: reports_report_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.reports_report_id_seq', 1, false);


--
-- TOC entry 6018 (class 0 OID 0)
-- Dependencies: 216
-- Name: users_user_id_seq; Type: SEQUENCE SET; Schema: public; Owner: postgres
--

SELECT pg_catalog.setval('public.users_user_id_seq', 7, true);


--
-- TOC entry 5751 (class 2606 OID 17650)
-- Name: alerts_master alerts_master_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.alerts_master
    ADD CONSTRAINT alerts_master_pkey PRIMARY KEY (alert_id);


--
-- TOC entry 5741 (class 2606 OID 17543)
-- Name: comments comments_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_pkey PRIMARY KEY (comment_id);


--
-- TOC entry 5758 (class 2606 OID 17682)
-- Name: email_verifications email_verifications_email_purpose_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_verifications
    ADD CONSTRAINT email_verifications_email_purpose_key UNIQUE (email, purpose);


--
-- TOC entry 5760 (class 2606 OID 17680)
-- Name: email_verifications email_verifications_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.email_verifications
    ADD CONSTRAINT email_verifications_pkey PRIMARY KEY (id);


--
-- TOC entry 5749 (class 2606 OID 17620)
-- Name: post_images post_images_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_images
    ADD CONSTRAINT post_images_pkey PRIMARY KEY (image_id);


--
-- TOC entry 5743 (class 2606 OID 17568)
-- Name: post_reactions post_reactions_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_reactions
    ADD CONSTRAINT post_reactions_pkey PRIMARY KEY (reaction_id);


--
-- TOC entry 5745 (class 2606 OID 17570)
-- Name: post_reactions post_reactions_post_id_user_id_reaction_type_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_reactions
    ADD CONSTRAINT post_reactions_post_id_user_id_reaction_type_key UNIQUE (post_id, user_id, reaction_type);


--
-- TOC entry 5739 (class 2606 OID 17518)
-- Name: posts posts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_pkey PRIMARY KEY (post_id);


--
-- TOC entry 5747 (class 2606 OID 17590)
-- Name: reports reports_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_pkey PRIMARY KEY (report_id);


--
-- TOC entry 5730 (class 2606 OID 17627)
-- Name: users uq_users_email; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uq_users_email UNIQUE (email);


--
-- TOC entry 5756 (class 2606 OID 17657)
-- Name: user_alerts user_alerts_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_alerts
    ADD CONSTRAINT user_alerts_pkey PRIMARY KEY (user_id, alert_id);


--
-- TOC entry 5732 (class 2606 OID 16418)
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- TOC entry 5734 (class 2606 OID 16416)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (user_id);


--
-- TOC entry 5737 (class 1259 OID 17533)
-- Name: idx_posts_location; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_posts_location ON public.posts USING gist (location);


--
-- TOC entry 5752 (class 1259 OID 17670)
-- Name: idx_user_alerts_unread_partial; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_alerts_unread_partial ON public.user_alerts USING btree (user_id, alert_id) WHERE (is_read = false);


--
-- TOC entry 5753 (class 1259 OID 17668)
-- Name: idx_user_alerts_user_delivered; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_alerts_user_delivered ON public.user_alerts USING btree (user_id, delivered_at DESC);


--
-- TOC entry 5754 (class 1259 OID 17669)
-- Name: idx_user_alerts_user_isread; Type: INDEX; Schema: public; Owner: postgres
--

CREATE INDEX idx_user_alerts_user_isread ON public.user_alerts USING btree (user_id, is_read);


--
-- TOC entry 5762 (class 2606 OID 17544)
-- Name: comments comments_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(post_id) ON DELETE CASCADE;


--
-- TOC entry 5763 (class 2606 OID 17549)
-- Name: comments comments_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.comments
    ADD CONSTRAINT comments_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- TOC entry 5767 (class 2606 OID 17621)
-- Name: post_images post_images_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_images
    ADD CONSTRAINT post_images_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(post_id) ON DELETE CASCADE;


--
-- TOC entry 5764 (class 2606 OID 17571)
-- Name: post_reactions post_reactions_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_reactions
    ADD CONSTRAINT post_reactions_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.posts(post_id) ON DELETE CASCADE;


--
-- TOC entry 5765 (class 2606 OID 17576)
-- Name: post_reactions post_reactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.post_reactions
    ADD CONSTRAINT post_reactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- TOC entry 5761 (class 2606 OID 17519)
-- Name: posts posts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.posts
    ADD CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- TOC entry 5766 (class 2606 OID 17591)
-- Name: reports reports_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.reports
    ADD CONSTRAINT reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id);


--
-- TOC entry 5768 (class 2606 OID 17663)
-- Name: user_alerts user_alerts_alert_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_alerts
    ADD CONSTRAINT user_alerts_alert_id_fkey FOREIGN KEY (alert_id) REFERENCES public.alerts_master(alert_id) ON DELETE CASCADE;


--
-- TOC entry 5769 (class 2606 OID 17658)
-- Name: user_alerts user_alerts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: postgres
--

ALTER TABLE ONLY public.user_alerts
    ADD CONSTRAINT user_alerts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;


-- Completed on 2025-11-01 12:49:38

--
-- PostgreSQL database dump complete
--

\unrestrict lvodD6jkpyFOwW40YDAAzwD5zSnj3gXO4PLINAQtZUoEldmqRY6Iyv46xYC61Je

