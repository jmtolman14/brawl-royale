// Tiny inline SVG icons for hotbar items (no external assets).
export function ItemIcon({ shape, color, size = 34 }: { shape: string; color: string; size?: number }) {
  const s = { width: size, height: size };
  const stroke = { stroke: '#0008', strokeWidth: 1.5 };
  switch (shape) {
    case 'cross':
      return (
        <svg viewBox="0 0 24 24" style={s}><rect x="3" y="5" width="18" height="14" rx="2" fill="#fff" {...stroke} /><path d="M10 8h4v3h3v4h-3v3h-4v-3H7v-4h3z" fill="#ef4444" /></svg>
      );
    case 'roll':
      return (
        <svg viewBox="0 0 24 24" style={s}><ellipse cx="12" cy="12" rx="8" ry="8" fill="#f5f5f4" {...stroke} /><circle cx="12" cy="12" r="3" fill={color} /></svg>
      );
    case 'box':
      return <svg viewBox="0 0 24 24" style={s}><path d="M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6z" fill="#60a5fa" {...stroke} /></svg>;
    case 'vest':
      return <svg viewBox="0 0 24 24" style={s}><path d="M7 3h3l2 3 2-3h3l3 5v13H4V8z" fill="#3b82f6" {...stroke} /><path d="M12 6v15" stroke="#1e3a8a" /></svg>;
    case 'can':
      return <svg viewBox="0 0 24 24" style={s}><rect x="7" y="3" width="10" height="18" rx="2" fill="#facc15" {...stroke} /><path d="M9 9l4 0-2 4h3l-5 5 1-4H8z" fill="#000a" /></svg>;
    case 'syringe':
      return <svg viewBox="0 0 24 24" style={s}><path d="M4 20l3-3m0 0l9-9 3 3-9 9zm9-12l3-3 3 3-3 3" fill="#f97316" {...stroke} /></svg>;
    case 'belt':
      return <svg viewBox="0 0 24 24" style={s}><rect x="1" y="9" width="22" height="6" rx="1" fill="#78350f" /><circle cx="12" cy="12" r="6" fill="#fbbf24" {...stroke} /><circle cx="12" cy="12" r="2.5" fill="#dc2626" /></svg>;
    case 'knuck':
      return <svg viewBox="0 0 24 24" style={s}><rect x="3" y="7" width="18" height="10" rx="3" fill="#9ca3af" {...stroke} />{[6, 10, 14, 18].map((x) => <circle key={x} cx={x} cy="12" r="1.8" fill="#1f2937" />)}</svg>;
    case 'chair':
      return <svg viewBox="0 0 24 24" style={s}><path d="M7 3h10v8H7zM6 12h12v2H6zM7 14l-2 7M17 14l2 7" fill="#9ca3af" stroke="#374151" strokeWidth="1.5" /></svg>;
    case 'bottle':
      return <svg viewBox="0 0 24 24" style={s}><path d="M10 2h4v5l2 3v11H8V10l2-3z" fill="#16a34a" {...stroke} /></svg>;
    default:
      return <div style={{ ...s, background: color, borderRadius: 6 }} />;
  }
}
