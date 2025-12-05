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
const fetch = require("node-fetch");

// PostgreSQL 래퍼
const db = require("./db");

// ========================= 기본 상수 / 경로 =========================

const PORT = process.env.PORT || 8080;
const ALLOW_ORIGINS = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  //"http://watchout.com", // 배포 후 도메인 여기에 추가
];

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
  INSERT_POST:             `-- NOT USED: handled in routes/posts.js`,
  INSERT_ATTACHMENTS_BULK: `-- NOT USED`,
  UPDATE_POST_BOARD:       `-- NOT USED`,
  UPDATE_POST_GENERIC:     `-- NOT USED`,
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

const { requireAuth }      = require("./middleware/auth");

const authRoutes           = require("./routes/auth");
const reportRoutes         = require("./routes/report");
const commentRoutes        = require("./routes/comment.router");
const legacyPostsRouter    = require("./routes/posts.router");
const recoveryRoutes       = require("./routes/recovery");
const alertsRoutes         = require("./routes/alerts");
const postReactionRoutes   = require("./routes/post.reaction.router");
const googleOAuth          = require("./routes/oauth.google");
const naverOAuth           = require("./routes/oauth.naver");
const kakaoOAuth           = require("./routes/oauth.kakao");

const imagePreviewRoutes   = require("./routes/image-previews");
const mosaicPostsRouter    = require("./routes/posts");   // /api/posts
// 🔥 새로 추가해야 하는 라우터
const boardPostsRouter   = require("./routes/board-posts");
// ========================= 앱 / 서버 / 소켓 =========================

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ALLOW_ORIGINS,
    credentials: true,
  },
});

// ========================= 글로벌 미들웨어 =========================

app.use(
  cors({
    origin: ALLOW_ORIGINS,
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
app.use("/uploads", express.static(UPLOAD_DIR));   // 업로드 파일
app.use("/gallery", express.static(GALLERY_DIR));  // 갤러리 원본 이미지
app.use(express.static(BUILD_DIR));                // React build

// 헬스 체크
app.get("/health", (_, res) => res.json({ status: "UP" }));

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
app.use("/api/posts",        mosaicPostsRouter);

app.use("/api/alerts",   alertsRoutes);
app.use("/api",          postReactionRoutes);
app.use("/api",          commentRoutes);
app.use("/api/report",   reportRoutes);
app.use("/api/recovery", recoveryRoutes);

app.use("/api/image-previews", imagePreviewRoutes);
// 🔥 게시판(board-posts) 라우터 추가
app.use("/api/board-posts", boardPostsRouter);

// ========================= 파일 업로드 =========================

app.post(
  "/api/uploads",
  requireAuth,
  upload.array("files", 10),
  (req, res) => {
    const proto = req.headers["x-forwarded-proto"] || req.protocol;
    const host  = req.headers["x-forwarded-host"] || req.get("host");
    const base  = `${proto}://${host}`;
    const urls = (req.files || []).map(
      (f) => `${base}/uploads/${path.basename(f.path)}`
    );
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

app.post("/api/boards/:boardType", requireAuth, async (req, res) => {
  return res.status(501).json({
    message: "게시판 작성은 /api/posts(모자이크 파이프라인)를 사용하세요.",
  });
});

app.put("/api/boards/:boardType/:id", requireAuth, async (req, res) => {
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
        post_id AS id,
        title,
        latitude  AS lat,
        longitude AS lng,
        h3_index::text AS h3_cell
      FROM posts
      WHERE latitude  IS NOT NULL
        AND longitude IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 500
    `);

    if (!rows.length) {
      console.log("⚠ DB 없음 → FALLBACK 반환");
      return res.json(FALLBACK);
    }

    console.log("📌 DB 지도 데이터 rows:", rows);
    return res.json(rows);
  } catch (e) {
    console.error("/api/map error:", e);
    return res.json(FALLBACK);
  }
});

// ========================= OSM 타일 프록시 (/tiles/*) =========================

app.get("/tiles/:z/:x/:y.png", async (req, res) => {
  const { z, x, y } = req.params;
  const url = `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": "K-Guard/1.0 (tile proxy)" },
    });

    if (!upstream.ok) {
      console.error("OSM tile error:", upstream.status, url);
      res.status(upstream.status).end();
      return;
    }

    const buf = Buffer.from(await upstream.arrayBuffer());

    res.set("Content-Type", "image/png");
    res.send(buf);
  } catch (err) {
    console.error("/tiles proxy error:", err);
    res.status(502).end();
  }
});

// ========================= Socket.IO (채팅) =========================

io.on("connection", (socket) => {
  console.log("✅ socket connected:", socket.id);

  // 방 참여 (프론트: s.emit("join", { roomId, userId }) 또는 { roomId }만 보내도 동작)
  socket.on("join", async ({ roomId, userId }) => {
    try {
      if (!roomId) return;

      const numericRoomId = Number(roomId);
      if (Number.isNaN(numericRoomId)) {
        console.warn("join: invalid roomId:", roomId);
        return;
      }

      socket.join(String(roomId));

      // userId가 있으면 방 멤버 테이블에 upsert
      if (userId) {
        try {
          await db.query(CHAT_SQL.UPSERT_MEMBER, [numericRoomId, Number(userId)]);
        } catch (err) {
          console.error("UPSERT_MEMBER error:", err);
        }
      }

      // (선택) 최근 메시지 불러오기 → 필요하면 주석 해제
      // const { rows } = await db.query(CHAT_SQL.LOAD_RECENT_MESSAGES, [numericRoomId, 50, 0]);
      // socket.emit("msg:init", rows.map((r) => ({
      //   id: r.message_id,
      //   roomId: r.room_id,
      //   userId: r.sender_id,
      //   text: r.content,
      //   ts: r.created_at,
      //   from: r.sender_id,
      // })));
    } catch (err) {
      console.error("join handler error:", err);
    }
  });

  // 기존 room:join / room:leave도 유지 (필요하면 프론트에서 사용)
  socket.on("room:join", (roomId) => {
    if (!roomId) return;
    socket.join(String(roomId));
  });

  socket.on("room:leave", (roomId) => {
    if (!roomId) return;
    socket.leave(String(roomId));
  });

  // 메시지 브로드캐스트 + DB 저장
  const broadcast = async ({ roomId, text, ts, userId }) => {
    try {
      if (!roomId || !text) return;

      const numericRoomId = Number(roomId);
      if (Number.isNaN(numericRoomId)) {
        console.warn("broadcast: invalid roomId:", roomId);
        return;
      }

      let saved = null;

      // userId가 있으면 DB에 저장 (비로그인/익명은 저장 안 해도 됨)
      if (userId) {
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
        roomId: numericRoomId,
        text,
        ts: saved ? saved.created_at : (ts || Date.now()),
        userId,
        from: userId || socket.id,
      };

      // 같은 방의 다른 클라이언트에게만 전송 (본인은 프론트에서 logs에 push)
      socket.to(String(roomId)).emit("msg", payload);
    } catch (err) {
      console.error("broadcast error:", err);
    }
  };

  socket.on("msg",       broadcast);
  socket.on("chat:send", broadcast);
});

// ========================= SPA Fallback / 404 / 에러 =========================

app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  if (req.path.startsWith("/socket.io")) return next();
  if (req.path.startsWith("/api/"))      return next();
  if (req.path.startsWith("/tiles/"))    return next();
  res.sendFile(path.join(BUILD_DIR, "index.html"));
});

app.use((req, res) => {
  res.status(404).json({ message: "Not Found", path: req.originalUrl || req.url });
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
