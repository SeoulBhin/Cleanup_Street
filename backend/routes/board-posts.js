// backend/routes/board-posts.js
const express = require("express");
const router = express.Router();
const db = require("../db");
const { requireAuth } = require("../middleware/auth");
const { latLngToCell } = require("h3-js");
const { geocodeAddress } = require("../utils/geocode");

/**
 * 공통 SELECT 구문
 * - posts + post_images 묶어서 한 번에 내려줌
 * - 프론트 PostView의 post.images 렌더링에 맞춤
 */
const BASE_SELECT = `
  SELECT
    p.post_id      AS id,
    p.user_id,
    p.title,
    p.content,
    p.category,
    p.status,
    p.comment_count,
    p.h3_index,
    p.address,
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

/**
 * 공통: 단일 게시글 조회 함수
 */
const fetchPostById = async (postId) => {
  const query = `${BASE_SELECT} WHERE p.post_id = $1`;
  const { rows } = await db.query(query, [postId]);
  return rows[0];
};

/**
 * 주소 처리 공통 함수
 * - latitude/longitude 가 이미 있으면 그걸 우선 사용
 * - 없고 address 가 있으면 카카오 지오코딩으로 lat/lng 계산
 * - 지오코딩 실패 시 { error: {status, body} }
 */
async function resolveLocation({ latitude, longitude, address }) {
  let lat = null;
  let lng = null;
  let normalizedAddress = (address || "").trim() || null;

  // 1) 클라이언트가 lat/lng 직접 준 경우
  if (latitude != null && longitude != null && latitude !== "" && longitude !== "") {
    lat = Number(latitude);
    lng = Number(longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      return {
        error: {
          status: 400,
          body: {
            code: "INVALID_COORD",
            message: "좌표값이 올바르지 않습니다.",
          },
        },
      };
    }
    return { lat, lng, address: normalizedAddress };
  }

  // 2) 좌표는 없고 address 텍스트만 존재하는 경우 → 카카오 지오코딩
  if (normalizedAddress) {
    const geo = await geocodeAddress(normalizedAddress);
    if (!geo) {
      return {
        error: {
          status: 400,
          body: {
            code: "INVALID_ADDRESS",
            message: "주소를 찾을 수 없습니다. 다시 확인해 주세요.",
          },
        },
      };
    }
    return {
      lat: geo.lat,
      lng: geo.lng,
      address: geo.normalizedAddress,
    };
  }

  // 3) 주소/좌표 둘 다 없는 경우 → 위치 정보 없이 저장
  return { lat: null, lng: null, address: null };
}

/**
 * lat/lng → H3, location WKT 계산
 */
function buildSpatialFields(lat, lng) {
  if (lat == null || lng == null) {
    return {
      h3_index: null,
      location: null,
    };
  }

  // H3 index (hex 문자열 → BIGINT)
  const hexIndex = latLngToCell(lat, lng, 10); // ex) "8a2a1072b59ffff"
  let h3_index = null;
  try {
    h3_index = BigInt("0x" + hexIndex); // BIGINT 컬럼에 저장
  } catch {
    h3_index = null;
  }

  // PostGIS geography(Point, 4326)
  const location = `SRID=4326;POINT(${lng} ${lat})`;

  return { h3_index, location };
}

// ================================
// 목록 조회  GET /api/board-posts
//   ?boardType=도로-교통&q=검색어
// ================================
router.get("/", async (req, res, next) => {
  try {
    const { boardType, q = "" } = req.query;

    const query = `
      ${BASE_SELECT}
      WHERE ($1::varchar IS NULL OR p.category = $1)
        AND (p.title ILIKE $2 OR p.content ILIKE $2)
      ORDER BY p.created_at DESC
    `;

    const { rows } = await db.query(query, [
      boardType || null,
      `%${q}%`,
    ]);

    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// ================================
// 개별 조회  GET /api/board-posts/:id
// ================================
router.get("/:id", async (req, res, next) => {
  try {
    const post = await fetchPostById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: "Not Found" });
    }

    res.json(post);
  } catch (err) {
    next(err);
  }
});

// ================================
// 게시글 생성  POST /api/board-posts
// body: { title, content, category, address?, latitude?, longitude?, attachments? }
// ================================
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const {
      title,
      content,
      category,
      address,
      latitude = null,
      longitude = null,
      attachments = [],
    } = req.body;

    if (!title || !content || !category) {
      return res
        .status(400)
        .json({ message: "필수 값 누락 (title / content / category)", code: "MISSING_FIELDS" });
    }

    // 1) 주소/좌표 처리 (지오코딩 포함)
    const locResult = await resolveLocation({ latitude, longitude, address });
    if (locResult.error) {
      return res.status(locResult.error.status).json(locResult.error.body);
    }
    const resolvedLat = locResult.lat;
    const resolvedLng = locResult.lng;
    const resolvedAddress = locResult.address;

    // 2) H3, location 계산
    const { h3_index, location } = buildSpatialFields(resolvedLat, resolvedLng);

    // 3) posts INSERT
    const insertQuery = `
      INSERT INTO posts
        (user_id, title, content, category,
         address, latitude, longitude, h3_index, location,
         status, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4,
         $5, $6, $7, $8, $9,
         'DONE', NOW(), NOW())
      RETURNING post_id AS id
    `;

    const { rows } = await db.query(insertQuery, [
      req.user.user_id,           // 로그인한 유저
      title,
      content,
      category,
      resolvedAddress,
      resolvedLat,
      resolvedLng,
      h3_index,
      location,
    ]);

    const postId = rows[0].id;

    // 4) 첨부 이미지가 있으면 post_images에 저장
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const params = [postId];
      const values = attachments.map((url, idx) => {
        params.push(url);
        return `($1, $${idx + 2}, 'ORIGINAL')`;
      });

      await db.query(
        `
        INSERT INTO post_images (post_id, image_url, variant)
        VALUES ${values.join(",")}
        `,
        params
      );
    }

    res.json({ id: postId });
  } catch (err) {
    next(err);
  }
});

// ================================
// 게시글 수정  PUT /api/board-posts/:id
// body: { title, content, category, address?, latitude?, longitude?, attachments? }
// ================================
router.put("/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const {
      title,
      content,
      category,
      address,
      latitude = null,
      longitude = null,
      attachments = [],
    } = req.body;

    if (!title || !content || !category) {
      return res
        .status(400)
        .json({ message: "필수 값 누락 (title / content / category)", code: "MISSING_FIELDS" });
    }

    // (선택) 소유권 체크 로직 추가 가능
    // const { rows: ownerRows } = await db.query(
    //   "SELECT user_id FROM posts WHERE post_id = $1",
    //   [id]
    // );
    // if (!ownerRows.length || ownerRows[0].user_id !== req.user.user_id) {
    //   return res.status(403).json({ message: "수정 권한이 없습니다." });
    // }

    // 1) 주소/좌표 처리 (지오코딩 포함)
    const locResult = await resolveLocation({ latitude, longitude, address });
    if (locResult.error) {
      return res.status(locResult.error.status).json(locResult.error.body);
    }
    const resolvedLat = locResult.lat;
    const resolvedLng = locResult.lng;
    const resolvedAddress = locResult.address;

    // 2) H3, location 계산
    const { h3_index, location } = buildSpatialFields(resolvedLat, resolvedLng);

    // 3) posts UPDATE
    const updateQuery = `
      UPDATE posts
      SET
        title      = $1,
        content    = $2,
        category   = $3,
        address    = $4,
        latitude   = $5,
        longitude  = $6,
        h3_index   = $7,
        location   = $8,
        updated_at = NOW()
      WHERE post_id = $9
    `;

    await db.query(updateQuery, [
      title,
      content,
      category,
      resolvedAddress,
      resolvedLat,
      resolvedLng,
      h3_index,
      location,
      id,
    ]);

    // 4) 첨부 이미지 갱신 (간단히: 기존 삭제 후 재삽입)
    await db.query(`DELETE FROM post_images WHERE post_id = $1`, [id]);

    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
      const params = [id];
      const values = attachments.map((url, idx) => {
        params.push(url);
        return `($1, $${idx + 2}, 'ORIGINAL')`;
      });

      await db.query(
        `
        INSERT INTO post_images (post_id, image_url, variant)
        VALUES ${values.join(",")}
        `,
        params
      );
    }

    res.json({ success: true, id: Number(id) });
  } catch (err) {
    next(err);
  }
});

// ================================
// 게시글 삭제  DELETE /api/board-posts/:id
// ================================
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;

    await db.query(`DELETE FROM post_images WHERE post_id = $1`, [id]);
    await db.query(`DELETE FROM posts       WHERE post_id = $1`, [id]);

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
