// Route XHS note links through /api/xhs for a fresh token; non-XHS URLs pass through.
const XHS_NOTE = /xiaohongshu\.com\/(?:explore|discovery\/item)\/([a-f0-9]{16,32})/i;

export function xhsGoHref(url: string | null | undefined): string {
  const m = (url ?? "").match(XHS_NOTE);
  return m ? `/api/xhs?note=${m[1]}` : (url ?? "");
}
