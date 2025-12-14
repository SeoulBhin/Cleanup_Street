import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
    getBoardPost,
    deleteBoardPost,
    addLike,
    listReplies,
    submitReply,
    getPostLikeState,
    reportPost,
} from "../api/boards";

import ReplyItem from "./ReplyItem";
import { getMe } from "../api/auth";

// 댓글 페이지당 항목 수 설정
const REPLIES_PER_PAGE = 5; 

export default function PostView() {
    const { boardType, id } = useParams();
    const navigate = useNavigate();

    const isLoggedIn = !!localStorage.getItem("accessToken");

    const [post, setPost] = useState(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState(null);
    const [selectedImageId, setSelectedImageId] = useState(null);

    const [isLiked, setIsLiked] = useState(false);
    const [replies, setReplies] = useState([]);
    const [newReplyText, setNewReplyText] = useState("");

    const [me, setMe] = useState(null);
    
    // 페이지네이션 상태
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);


    const isValidId =
        id !== undefined &&
        id !== "undefined" &&
        id !== "new" &&
        !Number.isNaN(Number(id));

    // 익명 표시 및 작성자 표시를 처리하는 함수
    const attachAnonToTree = useCallback((roots, postAuthorId) => {
        const anonMap = new Map();
        let seq = 0;

        const dfs = (node) => {
            const uidRaw =
                node.user_id ?? node.userId ?? node.author_id ?? node.authorId;
            const uid = uidRaw == null ? NaN : Number(uidRaw);

            let displayAuthor = "익명";

            if (Number.isFinite(uid)) {
                // 🚨 1. 게시글 작성자 ID와 댓글 작성자 ID가 일치하는 경우
                if (uid === postAuthorId) {
                    displayAuthor = "작성자";
                } else {
                    // 🚨 2. 일반 익명 처리 (익명 번호 부여)
                    if (!anonMap.has(uid)) anonMap.set(uid, ++seq);
                    displayAuthor = `익명 ${anonMap.get(uid)}`;
                }
            }

            return {
                ...node,
                id: node.id ?? node.comment_id ?? node.commentId,
                displayAuthor,
                replies: Array.isArray(node.replies) ? node.replies.map(dfs) : [],
            };
        };

        return Array.isArray(roots) ? roots.map(dfs) : [];
    }, []);
    
    // 댓글 목록만 페이지네이션하여 불러오는 함수
    const fetchReplies = useCallback(async (page, postAuthorId) => {
        if (!postAuthorId) return; // 게시글 작성자 ID가 없으면 실행 중지

        try {
            // 서버 API 호출: 최신순(desc) 정렬, 페이지 및 항목 수 적용
            const res = await listReplies(boardType, id, {
                page: page,
                limit: REPLIES_PER_PAGE,
                sort: 'desc', 
            });
            
            const replyList = Array.isArray(res?.data) ? res.data : [];
            const totalItems = res?.total || 0;

            // 🚨 익명 처리 함수에 게시글 작성자 ID 전달
            const tree = attachAnonToTree(replyList, postAuthorId); 
            
            setReplies(tree);
            setTotalPages(Math.ceil(totalItems / REPLIES_PER_PAGE));
            setCurrentPage(page);
        } catch (err) {
            console.error("댓글 불러오기 실패:", err);
            setReplies([]);
        }
    }, [boardType, id, attachAnonToTree]);


    const fetchDetail = useCallback(async () => {
        if (!isValidId) {
            setLoading(false);
            setLoadError("BAD_ID");
            return;
        }

        try {
            setLoading(true);
            setLoadError(null);

            const p = await getBoardPost(boardType, id);
            setPost(p);
            setSelectedImageId(null);
            setIsLiked(!!p?.is_liked_by_me);
            
            const postAuthorId = Number(p.user_id ?? p.author_id);
            
            // 🚨 댓글은 게시글 작성자 ID를 전달하여 첫 페이지를 별도로 호출
            if (Number.isFinite(postAuthorId)) {
                await fetchReplies(1, postAuthorId); 
            }

            try {
                if (isLoggedIn) {
                    const s = await getPostLikeState(id);
                    setIsLiked(!!s?.liked);
                    setPost((prev) => (prev ? { ...prev, likes: s?.likes ?? 0 } : prev));
                }
            } catch {}
        } catch (err) {
            console.error("게시글/댓글 불러오기 실패:", err);
            setLoadError("LOAD_FAIL");
            setPost(null);
            setReplies([]);
        } finally {
            setLoading(false);
        }
    }, [boardType, id, isValidId, isLoggedIn, fetchReplies]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    useEffect(() => {
        const token = localStorage.getItem("accessToken");
        if (!token) return;

        getMe()
            .then((r) => setMe(r?.me))
            .catch(() => setMe(null));
    }, []);

    const handleLike = async () => {
        if (!isLoggedIn) {
            alert("로그인이 필요합니다.");
            return;
        }

        if (!post) return;

        const wasLiked = isLiked;
        const delta = wasLiked ? -1 : 1;

        setIsLiked(!wasLiked);
        setPost((prev) =>
            prev ? { ...prev, likes: (prev.likes || 0) + delta } : prev
        );

        try {
            const res = await addLike(boardType, id);
            setIsLiked(!!res?.liked);
        } catch (err) {
            console.error("좋아요 실패:", err);

            setIsLiked(wasLiked);
            setPost((prev) =>
                prev ? { ...prev, likes: (prev.likes || 0) - delta } : prev
            );

            if (err?.status === 401) alert("로그인이 필요합니다.");
            else alert("좋아요 처리에 실패했습니다.");
        }
    };

    const handleReportPost = async () => {
        if (!isLoggedIn) {
            alert("로그인이 필요합니다.");
            return;
        }

        if (!isValidId) {
            alert("게시글 ID 오류");
            return;
        }

        if (!window.confirm("정말 이 게시글을 신고하시겠습니까?")) return;

        const reason = window.prompt("신고 사유를 입력하세요");
        if (!reason || !reason.trim()) return;

        try {
            await reportPost(boardType, id, reason.trim());
            alert("게시글 신고가 접수되었습니다.");
        } catch (e) {
            console.error("게시글 신고 실패:", e);
            if (e?.status === 401) alert("로그인이 필요합니다.");
            else alert("게시글 신고 처리에 실패했습니다.");
        }
    };

    const handleReplySubmit = async (e) => {
        e.preventDefault();
        const text = newReplyText.trim();
        if (!text) return;

        try {
            await submitReply(boardType, id, text); 
            setNewReplyText("");
            
            // 🚨 댓글 작성 후 전체 상세 정보(댓글 수)와 댓글 목록(1페이지)을 다시 불러옴
            await fetchDetail(); 
        } catch (err) {
            console.error("댓글 작성 실패:", err);
            if (err?.status === 401) alert("로그인이 필요합니다.");
            else alert("댓글 작성에 실패했습니다.");
        }
    };

    const onDelete = async () => {
        if (!isValidId) return;
        if (!window.confirm("정말 삭제할까요?")) return;
        try {
            await deleteBoardPost(boardType, id);
        } catch (e) {
            console.error("삭제 실패:", e);
        }
        navigate(`/board/${boardType}`);
    };

    const countAllReplies = (nodes) => {
        if (!Array.isArray(nodes)) return 0;

        let count = 0;
        for (const node of nodes) {
            count += 1; // 자기 자신
            if (Array.isArray(node.replies) && node.replies.length > 0) {
                count += countAllReplies(node.replies);
            }
        }
        return count;
    };
    
    // 페이지 변경 핸들러
    const handlePageChange = (page) => {
        if (page >= 1 && page <= totalPages) {
            // fetchReplies에 postAuthorId를 전달해야 하지만, 
            // post 상태가 이미 로드된 상태이므로 post.user_id를 사용
            const postAuthorId = Number(post?.user_id ?? post?.author_id);
            if (Number.isFinite(postAuthorId)) {
                fetchReplies(page, postAuthorId);
            }
        }
    };


    if (!isValidId) {
        return (
            <div className="page-container fade-in">
                <h2 className="page-title">잘못된 게시글 주소입니다.</h2>
                <div className="form-actions" style={{ marginTop: 24 }}>
                    <Link
                        className="form-btn btn-cancel"
                        to={`/board/${boardType || "free"}`}
                    >
                        목록으로 돌아가기
                    </Link>
                </div>
            </div>
        );
    }

    if (loading) return <div className="page-container">불러오는 중...</div>;

    if (loadError && !post) {
        return (
            <div className="page-container fade-in">
                <h2 className="page-title">게시글을 불러올 수 없습니다.</h2>
                <p style={{ marginTop: 8, color: "#94a3b8" }}>
                    게시글이 삭제되었거나, 일시적인 오류가 발생했을 수 있습니다.
                </p>
                <div className="form-actions" style={{ marginTop: 24 }}>
                    <Link className="form-btn btn-cancel" to={`/board/${boardType}`}>
                        목록
                    </Link>
                </div>
            </div>
        );
    }

    if (!post) return <div className="page-container">게시글 정보가 없습니다.</div>;

    const myId = me ? Number(me.id ?? me.user_id ?? me.userId) : null;
    const ownerId = Number(
        post.user_id ?? post.author_id ?? post.userId ?? post.userId
    );
    const isOwner = myId !== null && ownerId === myId;

    const images = Array.isArray(post.images) ? post.images : [];
    const attachments = Array.isArray(post.attachments) ? post.attachments : [];

    const extractImageUrls = (text) => {
        if (!text || typeof text !== "string") return [];
        const urls = [];

        const roughUrl = /(https?:\/\/\S+)/gi;
        let match;
        while ((match = roughUrl.exec(text)) !== null) urls.push(match[1]);

        const uploadsRegex = /(\/uploads\/\S+)/gi;
        while ((match = uploadsRegex.exec(text)) !== null) urls.push(match[1]);

        const cleaned = [];
        const seen = new Set();
        for (const url of urls) {
            const stripped = url.replace(/[)>,\]]+$/, "");
            if (!/\.(jpg|jpeg|png|gif|webp)(\?|#|$)/i.test(stripped)) continue;
            if (seen.has(stripped)) continue;
            seen.add(stripped);
            cleaned.push(stripped);
        }
        return cleaned;
    };

    const contentImages = extractImageUrls(post.content);
    const normalizedImages = images.map((img) => ({
        ...img,
        variant: (img.variant || "").toUpperCase(),
    }));
    const hasProcessed = normalizedImages.length > 0;

    const attachmentImages = [...attachments, ...contentImages].reduce(
        (acc, url) => {
            if (!url || acc.seen.has(url)) return acc;
            acc.seen.add(url);
            acc.list.push({
                imageUrl: url,
                variant: "ORIGINAL",
                imageId: `attachment-${acc.list.length}`,
            });
            return acc;
        },
        { seen: new Set(), list: [] }
    ).list;

    const gallerySources = hasProcessed ? normalizedImages : attachmentImages;

    const selected =
        gallerySources.find((img) => {
            if (selectedImageId === null) return false;
            return img.imageId === selectedImageId;
        }) || null;

    const defaultImage = gallerySources[0] || null;
    const activeImage = selected || defaultImage;

    return (
        <div className="page-container fade-in">
            <h2 className="page-title" style={{ border: "none", paddingBottom: 0 }}>
                {post.title}
            </h2>

            <div className="post-meta" style={{ marginBottom: 16 }}>
                <span className="post-category" style={{ marginRight: 8 }}>
                    {post.category}
                </span>
                <span>작성자: {post.author || "익명"}</span> |{" "}
                <span>
                    작성일:{" "}
                    {post.created_at ? new Date(post.created_at).toLocaleString() : "-"}
                </span>
            </div>

            <div className="post-actions-detail" style={{ marginBottom: 12 }}>
                <button
                    className={`btn-action ${isLiked ? "active" : ""}`}
                    onClick={handleLike}
                >
                    {isLiked ? "❤️ 좋아요 취소" : "🤍 좋아요"} ({post.likes || 0})
                </button>

                <button
                    className="btn-action btn-report"
                    onClick={handleReportPost}
                    style={{ marginLeft: 8 }}
                >
                    신고
                </button>
            </div>

            <div style={{ marginBottom: 12, color: "#94a3b8" }}>
                <strong style={{ color: "#1f2d37" }}>주소: </strong>
                {post.address || "주소 정보 없음"}
            </div>

            <div className="post-content" style={{ whiteSpace: "pre-wrap" }}>
                {post.content}
            </div>

            {/* 이미지 영역(원본 유지) */}
            <div style={{ marginTop: 16 }}>
                <div
                    style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}
                >
                    <strong>이미지</strong>
                    {!hasProcessed && !!attachments.length && (
                        <span
                            style={{
                                fontSize: 12,
                                padding: "2px 8px",
                                borderRadius: 12,
                                background: "#f97316",
                                color: "#fff",
                            }}
                        >
                            처리 중 (원본 미리보기)
                        </span>
                    )}
                </div>

                {activeImage ? (
                    <div style={{ marginTop: 12 }}>
                        <div
                            style={{
                                width: "100%",
                                maxWidth: 960,
                                borderRadius: 16,
                                overflow: "hidden",
                                border: "1px solid #e5e7eb",
                                background: "#0f172a",
                            }}
                        >
                            <img
                                src={activeImage.imageUrl}
                                alt="게시 이미지"
                                style={{
                                    width: "100%",
                                    minHeight: 320,
                                    maxHeight: 640,
                                    objectFit: "contain",
                                    display: "block",
                                    background: "#0f172a",
                                }}
                                onError={(e) => {
                                    e.currentTarget.src =
                                        "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='600'%3E%3Crect width='800' height='600' fill='%23232a3b'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' fill='%237884ab' font-size='20'%3E이미지를 불러올 수 없습니다%3C/text%3E%3C/svg%3E";
                                }}
                            />
                        </div>
                        <div style={{ marginTop: 8, fontSize: 12, color: "#94a3b8" }}>
                            {activeImage.createdAt
                                ? new Date(activeImage.createdAt).toLocaleString()
                                : ""}
                        </div>
                    </div>
                ) : (
                    <div style={{ marginTop: 12, color: "#94a3b8" }}>
                        표시할 이미지가 없습니다.
                    </div>
                )}
            </div>

            <hr className="detail-separator" style={{ marginTop: 18 }} />

            <div className="replies-section">
                <h3>댓글 ({post.comments_count || 0})</h3> 

                {/* 1. 댓글 목록 */}
                <div className="reply-list">
                    {replies.length === 0 ? (
                        <p className="no-replies">아직 댓글이 없습니다.</p>
                    ) : (
                        replies.map((reply) => (
                            <ReplyItem
                                key={reply.id}
                                reply={reply}
                                me={me}
                                postId={id}
                                boardType={boardType}
                                // 액션 성공 시 현재 페이지의 댓글을 새로 불러옴
                                onActionSuccess={() => fetchReplies(currentPage, Number(post.user_id ?? post.author_id))} 
                                depth={0}
                            />
                        ))
                    )}
                </div>

                {/* 2. 페이지네이션 컨트롤 */}
                {totalPages > 1 && (
                    <div className="pagination-controls">
                        <button
                            onClick={() => handlePageChange(currentPage - 1)}
                            disabled={currentPage === 1}
                            className="page-btn"
                        >
                            &lt; 이전
                        </button>
                        
                        <span className="page-info">{currentPage} / {totalPages}</span>
                        
                        <button
                            onClick={() => handlePageChange(currentPage + 1)}
                            disabled={currentPage === totalPages}
                            className="page-btn"
                        >
                            다음 &gt;
                        </button>
                    </div>
                )}

                {/* 3. 댓글 작성 폼 (목록 아래에 배치) */}
                <form onSubmit={handleReplySubmit} className="reply-form-bottom">
                    <textarea
                        className="form-textarea"
                        placeholder="댓글을 입력하세요"
                        value={newReplyText}
                        onChange={(e) => setNewReplyText(e.target.value)}
                        rows={3}
                    />
                    <button type="submit" className="form-btn btn-submit">
                        등록
                    </button>
                </form>
            </div>

            <div className="form-actions" style={{ marginTop: 24 }}>
                <Link className="form-btn btn-cancel" to={`/board/${boardType}`}>
                    목록
                </Link>

                {isOwner && (
                    <>
                        <Link
                            className="form-btn btn-submit"
                            to={`/board/${boardType}/${id}/edit`}
                        >
                            수정
                        </Link>

                        <button className="form-btn btn-submit" onClick={onDelete}>
                            삭제
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
