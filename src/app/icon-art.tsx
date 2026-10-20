// Shared artwork for the app icons (generated at request time, no image files).
export function IconArt({ size }: { size: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0f766e 0%, #115e59 100%)",
        color: "white",
        fontSize: size * 0.62,
        fontWeight: 800,
        fontFamily: "sans-serif",
        letterSpacing: -size * 0.02,
      }}
    >
      L
    </div>
  );
}
