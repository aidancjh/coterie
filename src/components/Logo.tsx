/**
 * Coterie brand mark — the real artwork (assets/mark-standalone-red.png, served
 * from /logo-mark.png). It's a fixed red ball with a white negative-space
 * pinwheel, so it reads on both light and dark surfaces. Size it with width/
 * height utilities via `className` (it's a square image).
 */
export function Logo({
  className = "",
  title = "Coterie",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <img
      src="/logo-mark.png"
      alt={title}
      className={className}
      draggable={false}
      style={{ objectFit: "contain" }}
    />
  );
}

export default Logo;
