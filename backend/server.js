// backend/server.js
require("dotenv").config();

const path = require("path");
const fs = require("fs");
const http = require("http");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const cookieParser = require("cookie-parser");
const multer = require("multer");
const { Server } = require("socket.io");
const { pingRedis } = require("./utils/redisClient");

// PostgreSQL 래퍼
const db = require("./db");

// ========================= 기본 상수 / 경로 =========================

const PORT = process.env.PORT || 8080;

/**
 * ✅ 포트별(blue/green) 프론트 Origin 허용을 위해 확장
 * - 프론트가 3000/5173 뿐 아니라 8080/8081 등으로 뜰 수 있음
 * - 백엔드가 9090/9091 포트로 뜨더라도, CORS는 "프론트 Origin" 기준으로 허용해야 함
 */
const ALLOW_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",

  "http://52.63.57.185",
  "https://52.63.57.185",

  "http://52.63.57.185:8080",
  "http://52.63.57.185:8081",
  "https://52.63.57.185:8080",
  "https://52.63.57.185:8081",
];



const REDIS_HOST = process.env.REDIS_HOST || "127.0.0.1";
const REDIS_PORT = Number(process.env.REDIS_PORT || 6379);
const REDIS_PASSWORD = process.env.REDIS_PASSWORD || undefined;
const REDIS_URL = REDIS_PASSWORD
  ? `redis://:${REDIS_PASSWORD}@${REDIS_HOST}:${REDIS_PORT}`
  : `redis://${REDIS_HOST}:${REDIS_PORT}`;

// React 빌드 폴더 (frontend/build)
const BUILD_DIR = path.join(__dirname, "..", "frontend", "build");

// 업로드 / 임시 / 갤러리 폴더
const UPLOAD_DIR = path.join(__dirname, "uploads");
const TMP_DIR = path.join(__dirname, "tmp");
const GALLERY_DIR = path.join(__dirname, "..", "frontend", "public", "gallery");

fs.mkdirSync(UPLOAD_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

// ========================= Multer 설정 =========================

const storage = multer.diskStorage({
  destination: (_, __, cb) => cb(null, UPLOAD_DIR),
  filename: (_, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const name = path
      .basename(file.originalname || "", ext)
      .replace(/[^\w.-]/g, "_");
    cb(null, `${Date.now()}_${name}${ext}`);
  },
});
const upload = multer({ storage });

// ========================= posts 조회용 SQL =========================

const BASE_POST_SELECT = `
  SELECT
    p.post_id      AS id,
    p.user_id,
    p.title,
    p.content,
    p.category,
    p.status,
    p.comment_count,
    p.h3_index,
    p.latitude,
    p.longitude,
    p.created_at,
    p.updated_at,
    ST_AsText(p.location::geometry) AS location_wkt,
    COALESCE(
      (
        SELECT json_agg(
          json_build_object(
            'imageId',  pi.image_id,
            'variant',  pi.variant,
            'imageUrl', pi.image_url,
            'createdAt',pi.created_at
          )
          ORDER BY pi.image_id
        )
        FROM post_images pi
        WHERE pi.post_id = p.post_id
      ),
      '[]'::json
    ) AS images
  FROM posts p
`;

const SQL = {
  LIST_BY_BOARD: `
    ${BASE_POST_SELECT}
    WHERE p.category = $1
      AND (p.title ILIKE $2 OR p.content ILIKE $3)
    ORDER BY p.created_at DESC
    LIMIT $4 OFFSET $5
  `,
  LIST_GENERIC: `
    ${BASE_POST_SELECT}
    WHERE ($1::varchar IS NULL OR p.category = $1)
      AND (p.title ILIKE $2 OR p.content ILIKE $3)
    ORDER BY p.created_at DESC
    LIMIT $4 OFFSET $5
  `,
  GET_BY_ID_BOARD: `
    ${BASE_POST_SELECT}
    WHERE p.post_id = $1
      AND p.category = $2
    LIMIT 1
  `,
  GET_BY_ID_GENERIC: `
    ${BASE_POST_SELECT}
    WHERE p.post_id = $1
      AND ($2::varchar IS NULL OR p.category = $2)
    LIMIT 1
  `,
  INSERT_POST: `-- NOT USED: handled in routes/posts.js`,
  INSERT_ATTACHMENTS_BULK: `-- NOT USED`,
  UPDATE_POST_BOARD: `-- NOT USED`,
  UPDATE_POST_GENERIC: `-- NOT USED`,
  DELETE_BY_ID_BOARD: `
    DELETE FROM posts
    WHERE post_id = $1
      AND category = $2
  `,
  DELETE_BY_ID_GENERIC: `
    DELETE FROM posts
    WHERE post_id = $1
  `,
};

// ========================= 채팅용 SQL (chat_* 스키마 기준) =========================

const CHAT_SQL = {
  INSERT_MESSAGE: `
    INSERT INTO chat_messages (room_id, sender_id, content)
    VALUES ($1, $2, $3)
    RETURNING message_id, room_id, sender_id, content, created_at, is_deleted
  `,
  UPSERT_MEMBER: `
    INSERT INTO chat_room_members (room_id, user_id)
    VALUES ($1, $2)
    ON CONFLICT (room_id, user_id) DO NOTHING
  `,
  LOAD_RECENT_MESSAGES: `
    SELECT
      message_id,
      room_id,
      sender_id,
      content,
      created_at,
      is_deleted
    FROM chat_messages
    WHERE room_id = $1
      AND is_deleted = false
    ORDER BY created_at ASC
    LIMIT $2
    OFFSET $3
  `,
};

// ========================= node/src 라우터 & 미들웨어 =========================

const { requireAuth } = require("./middleware/auth");

const authRoutes = require("./routes/auth");
const reportRoutes = require("./routes/report");
const commentRoutes = require("./routes/comment.router");
const legacyPostsRouter = require("./routes/posts.router");
const recoveryRoutes = require("./routes/recovery");
const alertsRoutes = require("./routes/alerts");
const postReactionRoutes = require("./routes/post.reaction.router");
const googleOAuth = require("./routes/oauth.google");
const naverOAuth = require("./routes/oauth.naver");
const kakaoOAuth = require("./routes/oauth.kakao");

const imagePreviewRoutes = require("./routes/image-previews");
const mosaicPostsRouter = require("./routes/posts"); // /api/posts
const boardPostsRouter = require("./routes/board-posts");
const uploadUrlRouter = require("./routes/uploads.url");

// ========================= 앱 / 서버 / 소켓 =========================

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: ALLOW_ORIGINS,
    credentials: true,
  },
});

// ===== Redis Adapter 설정 =====
const { createAdapter } = require("@socket.io/redis-adapter");
const { createClient } = require("redis");

(async () => {
  try {
    const pubClient = createClient({ url: REDIS_URL });
    const subClient = pubClient.duplicate();

    pubClient.on("error", (err) =>
      console.error("❌ Redis pubClient error:", err?.message || err)
    );
    subClient.on("error", (err) =>
      console.error("❌ Redis subClient error:", err?.message || err)
    );

    await pubClient.connect();
    await subClient.connect();

    io.adapter(createAdapter(pubClient, subClient));
    console.log(
      `🔗 Redis Adapter connected → ${REDIS_HOST}:${REDIS_PORT} (Socket.IO clustering 활성화)`
    );
  } catch (err) {
    console.error("❌ Redis Adapter init failed:", err?.message || err);
  }
})();

// ========================= 글로벌 미들웨어 =========================

// ✅ origin이 없는 요청(curl, server-to-server 등)도 통과시키기 위해 함수형으로 처리
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (ALLOW_ORIGINS.includes(origin)) return cb(null, true);
      return cb(new Error(`CORS blocked: ${origin}`), false);
    },
    credentials: true,
  })
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// === 정적 파일 ===
app.use("/uploads", express.static(UPLOAD_DIR)); // 업로드 파일
app.use("/gallery", express.static(GALLERY_DIR)); // 갤러리 원본 이미지
app.use(express.static(BUILD_DIR)); // React build

console.log("🔥 Loaded KAKAO KEY:", process.env.KAKAO_REST_API_KEY_Value);

// 헬스 체크
app.get("/health", async (_, res) => {
  let redisStatus = "unknown";

  try {
    redisStatus = (await pingRedis()) ? "ok" : "down";
  } catch (err) {
    console.error("Redis health check failed:", err?.message || err);
    redisStatus = "down";
  }

  res.json({ status: "UP", redis: redisStatus });
});

app.get("/api/hello", (req, res) => {
  res.status(200).json({ message: "cleanup street backend alive" });
});

// ========================= 공지 / 갤러리 API =========================

app.get("/api/announcements", (req, res) => {
  res.json([
    {
      id: 1,
      title: "[필독] 와챠우! 커뮤니티 이용 규칙 안내",
      author: "관리자",
      date: "2025-10-15",
    },
    {
      id: 2,
      title: "개인정보 처리 방침 개정 안내",
      author: "관리자",
      date: "2025-10-10",
    },
    {
      id: 3,
      title: "서버 점검 예정 (오전 2시 ~ 4시)",
      author: "관리자",
      date: "2025-10-05",
    },
  ]);
});

app.get("/api/gallery", (req, res) => {
  res.json([
    { id: 1, url: "/gallery/1.png", caption: "고장난 가로등 신고 후 수리", roomId: "gallery-1" },
    { id: 2, url: "/gallery/2.png", caption: "도로 파손 정비 전/후",       roomId: "gallery-2" },
    { id: 3, url: "/gallery/3.png", caption: "공원 쓰레기 정리 캠페인",     roomId: "gallery-3" },
    { id: 4, url: "/gallery/4.png", caption: "불법 투기 단속 현장",         roomId: "gallery-4" },
    { id: 5, url: "/gallery/5.png", caption: "커뮤니티 합동 정화 활동",     roomId: "gallery-5" },
    { id: 6, url: "/gallery/6.png", caption: "깨끗해진 벤치 주변",           roomId: "gallery-6" },
  ]);
});

// ========================= 인증 / 유저 / OAuth =========================

app.use("/api/auth", authRoutes);
app.use("/api/oauth/google", googleOAuth);
app.use("/api/oauth/naver", naverOAuth);
app.use("/api/oauth/kakao", kakaoOAuth);

app.get("/api/me", requireAuth, (req, res) => res.json({ me: req.user }));

// ========================= 게시글 / 댓글 / 좋아요 / 알림 / 신고 =========================

app.use("/api/legacy-posts", legacyPostsRouter);
app.use("/api/posts", mosaicPostsRouter);

app.use("/api/alerts", alertsRoutes);
app.use("/api", postReactionRoutes);
app.use("/api", commentRoutes);
app.use("/api/report", reportRoutes);
app.use("/api/recovery", recoveryRoutes);

app.use("/api/image-previews", imagePreviewRoutes);
app.use("/api/board-posts", boardPostsRouter);
app.use("/api/uploads/url", uploadUrlRouter);

// ========================= 파일 업로드 =========================

// 업로드 경로 접근 확인용
app.get("/api/uploads/health", (_req, res) => {
  res.json({ ok: true, message: "uploads alive" });
});

// GET /api/uploads (guide only; use POST to upload)
app.get("/api/uploads", (_req, res) => {
  res.status(405).json({
    message: "Use POST multipart/form-data to upload files to /api/uploads",
  });
});

app.options("/api/uploads", cors()); // 명시적 preflight 허용
app.post(
  "/api/uploads",
  // requireAuth,   // ⛔ 잠깐 주석 처리 (또는 삭제)
  upload.array("files", 10),
  (req, res) => {
    const ct = req.headers["content-type"] || "";
    if (!ct.toLowerCase().includes("multipart/form-data")) {
      return res.status(415).json({
        message: "Content-Type must be multipart/form-data",
      });
    }
    if (!req.files || !req.files.length) {
      return res.status(400).json({ message: "No files received" });
    }
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const host = req.headers["x-forwarded-host"] || req.get("host");
    const base = `${proto}://${host}`;
    const urls = (req.files || []).map(
      (f) => `${base}/uploads/${path.basename(f.path)}`
    );
    console.log("[/api/uploads] stored:", urls);
    res.json({ urls });
  }
);

// ========================= 게시판(boards) 조회 전용 =========================

app.get("/api/boards/:boardType", async (req, res, next) => {
  const { boardType } = req.params;
  const { q = "", limit = 50, offset = 0 } = req.query;

  try {
    const { rows } = await db.query(SQL.LIST_BY_BOARD, [
      boardType,
      `%${q}%`,
      `%${q}%`,
      Number(limit),
      Number(offset),
    ]);
    res.json(rows);
  } catch (e) {
    next(e);
  }
});

app.get("/api/boards/:boardType/:id", async (req, res, next) => {
  const { boardType, id } = req.params;

  try {
    const { rows } = await db.query(SQL.GET_BY_ID_BOARD, [id, boardType]);
    if (!rows.length) return res.status(404).json({ message: "Not Found" });
    res.json(rows[0]);
  } catch (e) {
    next(e);
  }
});

app.post("/api/boards/:boardType", requireAuth, async (_req, res) => {
  return res.status(501).json({
    message: "게시판 작성은 /api/posts(모자이크 파이프라인)를 사용하세요.",
  });
});

app.put("/api/boards/:boardType/:id", requireAuth, async (_req, res) => {
  return res.status(501).json({
    message: "게시판 수정은 /api/posts(모자이크 파이프라인)를 사용하세요.",
  });
});

// ========================= 지도 데이터 (/api/map) =========================

app.get("/api/map", async (req, res) => {
  const FALLBACK = [
    { id: 1, title: "가로등 고장",      lat: 37.5665, lng: 126.9780, h3_cell: "8a2a1072b59ffff" },
    { id: 2, title: "도로 파손",        lat: 37.5700, lng: 126.9820, h3_cell: "8a2a1072b5bffff" },
    { id: 3, title: "쓰레기 무단투기",  lat: 37.5635, lng: 126.9750, h3_cell: "8a2a1072b5dffff" },
  ];

  try {
    const { rows } = await db.query(`
      SELECT
        p.post_id AS id,
        p.title,
        p.content,
        p.address,
        p.latitude  AS lat,
        p.longitude AS lng,
        p.h3_index::text AS h3_cell,
        COALESCE(
          img.image_url,
          content_img.url,
          'data:image/svg+xml;charset=utf-8,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"320\" height=\"200\"%3E%3Crect width=\"320\" height=\"200\" fill=\"%23232a3b\"/%3E%3Ctext x=\"50%25\" y=\"50%25\" dominant-baseline=\"middle\" text-anchor=\"middle\" fill=\"%237884ab\" font-size=\"14\"%3E이미지 없음%3C/text%3E%3C/svg%3E'
        )               AS image_url,
        img.variant      AS image_variant
      FROM posts p
      LEFT JOIN LATERAL (
        SELECT
          pi.image_url,
          pi.variant
        FROM post_images pi
        WHERE pi.post_id = p.post_id
        ORDER BY
          pi.created_at DESC,
          pi.image_id DESC,
          CASE
            WHEN pi.variant = 'AUTO' THEN 1
            WHEN pi.variant = 'PLATE_VISIBLE' THEN 2
            ELSE 3
          END
        LIMIT 1
      ) img ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(
            (regexp_match(p.content, '(https?://[^\\s\\\"]+\\.(?:jpg|jpeg|png|gif|webp))'))[1],
            (regexp_match(p.content, '(/uploads/[^\\s\\\"]+\\.(?:jpg|jpeg|png|gif|webp))'))[1]
          ) AS url
      ) content_img ON TRUE
      WHERE p.latitude  IS NOT NULL
        AND p.longitude IS NOT NULL
      ORDER BY p.created_at DESC
      LIMIT 500
    `);

    if (!rows.length) {
      console.log("⚠ DB 없음 → FALLBACK 반환");
      return res.json(
        FALLBACK.map((r) => ({
          ...r,
          address: "주소 정보 없음",
        }))
      );
    }

    console.log("📌 DB 지도 데이터 rows:", rows);
    return res.json(rows);
  } catch (e) {
    console.error("/api/map error:", e);
    return res.json(FALLBACK);
  }
});

// ========================= Socket.IO (채팅) =========================

io.on("connection", (socket) => {
  console.log("✅ socket connected:", socket.id);

  socket.on("join", async ({ roomId, userId }) => {
    try {
      if (!roomId) return;

      const roomKey = String(roomId);
      socket.join(roomKey);
      console.log(`📌 socket ${socket.id} join room:`, roomKey);

      const numericRoomId = Number(roomId);
      const hasNumericRoomId = !Number.isNaN(numericRoomId);

      if (userId && hasNumericRoomId) {
        try {
          await db.query(CHAT_SQL.UPSERT_MEMBER, [
            numericRoomId,
            Number(userId),
          ]);
        } catch (err) {
          console.error("UPSERT_MEMBER error:", err);
        }
      }
    } catch (err) {
      console.error("join handler error:", err);
    }
  });

  socket.on("room:join", (roomId) => {
    if (!roomId) return;
    const roomKey = String(roomId);
    socket.join(roomKey);
    console.log(`room:join → ${socket.id} joined ${roomKey}`);
  });

  socket.on("room:leave", (roomId) => {
    if (!roomId) return;
    const roomKey = String(roomId);
    socket.leave(roomKey);
    console.log(`room:leave → ${socket.id} left ${roomKey}`);
  });

  socket.on("read_messages", async ({ roomId, userId }) => {
    try {
      if (!roomId) return;
      console.log(
        `👀 read_messages: roomId=${roomId}, userId=${userId || "anonymous"}`
      );
    } catch (err) {
      console.error("read_messages error:", err);
    }
  });

  const broadcast = async ({ roomId, text, ts, userId }) => {
    try {
      if (!roomId || !text) return;

      const roomKey = String(roomId);
      const numericRoomId = Number(roomId);
      const hasNumericRoomId = !Number.isNaN(numericRoomId);

      let saved = null;

      console.log(
        `📤 broadcast: room=${roomKey}, msg="${text}" from ${userId || socket.id}`
      );

      if (userId && hasNumericRoomId) {
        try {
          const { rows } = await db.query(CHAT_SQL.INSERT_MESSAGE, [
            numericRoomId,
            Number(userId),
            text,
          ]);
          saved = rows[0];
        } catch (err) {
          console.error("INSERT_MESSAGE error:", err);
        }
      }

      const payload = {
        roomId: hasNumericRoomId ? numericRoomId : roomKey,
        text,
        ts: saved ? saved.created_at : ts || Date.now(),
        userId,
        from: userId || socket.id,
      };

      socket.to(roomKey).emit("msg", payload);
      console.log(
        `💬 broadcast to ${roomKey} from ${
          userId || socket.id
        }: ${text.substring(0, 50)}`
      );
    } catch (err) {
      console.error("broadcast error:", err);
    }
  };

  socket.on("msg", broadcast);
  socket.on("chat:send", broadcast);

  socket.on("disconnect", (reason) => {
    console.log(`❌ socket disconnected: ${socket.id}, reason: ${reason}`);
  });
});

// ========================= SPA Fallback / 404 / 에러 =========================

app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/socket.io")) return next();
  if (req.path.startsWith("/api/")) return next();
  if (req.path.startsWith("/tiles/")) return next();
  res.sendFile(path.join(BUILD_DIR, "index.html"));
});

app.use((req, res) => {
  res
    .status(404)
    .json({ message: "Not Found", path: req.originalUrl || req.url });
});

app.use((err, req, res, _next) => {
  console.error("[UNCAUGHT]", err);
  const status = err.status || 500;
  res.status(status).json({ message: err.message || "Internal Server Error" });
});

// ========================= 서버 시작 =========================

server.listen(PORT, () => {
  console.log(`API & Socket server running on http://localhost:${PORT}`);
});
