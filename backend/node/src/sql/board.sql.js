const SQL = {

  LIST: `
    WITH base AS (
      SELECT p.post_id, p.user_id, p.title, p.content, p.category, p.status,
             p.comment_count, p.created_at, p.updated_at
      FROM posts p
      WHERE ($1::text IS NULL OR p.category = $1)
        AND ($2::text IS NULL OR p.status = $2)
        AND ($3::text = '' OR p.title ILIKE '%'||$3||'%' OR p.content ILIKE '%'||$3||'%')
    ),
    imgs AS (
      SELECT pi.post_id, COALESCE(json_agg(pi.image_url) FILTER (WHERE pi.image_id IS NOT NULL), '[]') AS images
      FROM post_images pi
      GROUP BY pi.post_id
    ),
    react AS (
      SELECT pr.post_id,
             json_object_agg(pr.reaction_type, cnt) AS reactions
      FROM (
        SELECT post_id, reaction_type, COUNT(*)::int AS cnt
        FROM post_reactions
        GROUP BY post_id, reaction_type
      ) pr
      GROUP BY pr.post_id
    )
    SELECT b.*, COALESCE(i.images, '[]') AS images, COALESCE(r.reactions, '{}'::json) AS reactions
    FROM base b
    LEFT JOIN imgs i ON i.post_id = b.post_id
    LEFT JOIN react r ON r.post_id = b.post_id
    ORDER BY b.created_at DESC
    LIMIT $4 OFFSET $5
  `,

  
  GET_BY_ID: `
    WITH i AS (
      SELECT post_id, COALESCE(json_agg(image_url) FILTER (WHERE image_id IS NOT NULL), '[]') AS images
      FROM post_images
      WHERE post_id = $1
      GROUP BY post_id
    ),
    r AS (
      SELECT post_id, json_object_agg(reaction_type, cnt) AS reactions
      FROM (
        SELECT post_id, reaction_type, COUNT(*)::int AS cnt
        FROM post_reactions
        WHERE post_id = $1
        GROUP BY post_id, reaction_type
      ) x
      GROUP BY post_id
    )
    SELECT p.*, COALESCE(i.images,'[]') AS images, COALESCE(r.reactions,'{}'::json) AS reactions
    FROM posts p
    LEFT JOIN i ON i.post_id = p.post_id
    LEFT JOIN r ON r.post_id = p.post_id
    WHERE p.post_id = $1
  `,

  INSERT_POST_WITH_LOCATION: `
    INSERT INTO posts (user_id, title, content, category, status, location, h3_index)
    VALUES ($1, $2, $3, $4, COALESCE($5,'active'),
            ST_SetSRID(ST_MakePoint($6, $7), 4326),
            $8)
    RETURNING post_id
  `,
  INSERT_POST_NO_LOCATION: `
    INSERT INTO posts (user_id, title, content, category, status, h3_index)
    VALUES ($1, $2, $3, $4, COALESCE($5,'active'), $6)
    RETURNING post_id
  `,

  INSERT_IMAGES_BULK: `
    INSERT INTO post_images (post_id, image_url)
    SELECT $1, unnest($2::text[])
  `,

  UPDATE_POST: `
    UPDATE posts
       SET title=$1, content=$2, category=$3, status=$4, updated_at = NOW()
     WHERE post_id=$5
  `,

  DELETE_IMAGES_BY_POST: `DELETE FROM post_images WHERE post_id=$1`,

  DELETE_POST: `DELETE FROM posts WHERE post_id=$1`,

};

module.exports = { SQL };
