/* @ds-bundle: {"format":4,"namespace":"MarginEdgeDesignSystem_e6ce8f","components":[{"name":"Badge","sourcePath":"components/data/Badge.jsx"},{"name":"Card","sourcePath":"components/data/Card.jsx"},{"name":"DataTable","sourcePath":"components/data/DataTable.jsx"},{"name":"StatTile","sourcePath":"components/data/StatTile.jsx"},{"name":"Dialog","sourcePath":"components/feedback/Dialog.jsx"},{"name":"Toast","sourcePath":"components/feedback/Toast.jsx"},{"name":"Tooltip","sourcePath":"components/feedback/Tooltip.jsx"},{"name":"Button","sourcePath":"components/forms/Button.jsx"},{"name":"Checkbox","sourcePath":"components/forms/Checkbox.jsx"},{"name":"IconButton","sourcePath":"components/forms/IconButton.jsx"},{"name":"Radio","sourcePath":"components/forms/Radio.jsx"},{"name":"Select","sourcePath":"components/forms/Select.jsx"},{"name":"Switch","sourcePath":"components/forms/Switch.jsx"},{"name":"TextField","sourcePath":"components/forms/TextField.jsx"},{"name":"SidebarNav","sourcePath":"components/navigation/SidebarNav.jsx"},{"name":"Tabs","sourcePath":"components/navigation/Tabs.jsx"}],"sourceHashes":{"components/data/Badge.jsx":"4d4f0a7369d0","components/data/Card.jsx":"2b1b5088e340","components/data/DataTable.jsx":"3497569d2676","components/data/StatTile.jsx":"98643dbcf91a","components/feedback/Dialog.jsx":"ece06654a45f","components/feedback/Toast.jsx":"9497217f64fd","components/feedback/Tooltip.jsx":"a02a868a23b4","components/forms/Button.jsx":"96443987c676","components/forms/Checkbox.jsx":"07e3ec0637b5","components/forms/IconButton.jsx":"f0180439e409","components/forms/Radio.jsx":"ff871aa1af39","components/forms/Select.jsx":"8e8a20913678","components/forms/Switch.jsx":"56ce2067374a","components/forms/TextField.jsx":"02876dd7fd08","components/navigation/SidebarNav.jsx":"296599bf3c85","components/navigation/Tabs.jsx":"09e4b44d5746","ui_kits/web-app/AppShell.jsx":"ef9bbc06d9d0","ui_kits/web-app/DashboardScreen.jsx":"f97f99874c77","ui_kits/web-app/InventoryScreen.jsx":"e3ec3e232a2b","ui_kits/web-app/InvoicesScreen.jsx":"2ef6233c70a2","ui_kits/web-app/ProfitLossScreen.jsx":"1e8262fae9ed","ui_kits/web-app/icons.jsx":"99f47a5abf0f"},"inlinedExternals":[],"unexposedExports":[]} */

(() => {

const __ds_ns = (window.MarginEdgeDesignSystem_e6ce8f = window.MarginEdgeDesignSystem_e6ce8f || {});

const __ds_scope = {};

(__ds_ns.__errors = __ds_ns.__errors || []);

// components/data/Badge.jsx
try { (() => {
/**
 * Status pill. tone: neutral | info | success | warning | danger | brand.
 * variant: soft (tinted bg) | solid (filled) | outline.
 */
function Badge({
  children,
  tone = 'neutral',
  variant = 'soft',
  dot = false,
  style = {}
}) {
  const palette = {
    neutral: {
      fg: 'var(--neutral-700)',
      bg: 'var(--neutral-100)',
      solid: 'var(--neutral-600)'
    },
    info: {
      fg: 'var(--blue-700)',
      bg: 'var(--blue-100)',
      solid: 'var(--me-blue)'
    },
    success: {
      fg: 'var(--teal-800)',
      bg: 'var(--teal-100)',
      solid: 'var(--teal-600)'
    },
    warning: {
      fg: 'var(--honey-800)',
      bg: 'var(--honey-100)',
      solid: 'var(--honey-500)'
    },
    danger: {
      fg: 'var(--persimmon-800)',
      bg: 'var(--persimmon-100)',
      solid: 'var(--persimmon-500)'
    },
    brand: {
      fg: 'var(--white)',
      bg: 'var(--me-blue)',
      solid: 'var(--me-blue)'
    }
  }[tone] || {};
  const styles = {
    soft: {
      color: palette.fg,
      background: palette.bg,
      border: '1px solid transparent'
    },
    solid: {
      color: 'var(--white)',
      background: palette.solid,
      border: '1px solid transparent'
    },
    outline: {
      color: palette.fg,
      background: 'transparent',
      border: `1px solid ${palette.fg}`
    }
  }[variant];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      fontFamily: 'var(--font-body)',
      fontSize: 12,
      fontWeight: 'var(--fw-bold)',
      lineHeight: 1,
      padding: '4px 9px',
      borderRadius: 'var(--radius-pill)',
      whiteSpace: 'nowrap',
      ...styles,
      ...style
    }
  }, dot && /*#__PURE__*/React.createElement("span", {
    style: {
      width: 6,
      height: 6,
      borderRadius: '50%',
      background: variant === 'solid' ? 'var(--white)' : palette.solid
    }
  }), children);
}
Object.assign(__ds_scope, { Badge });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Badge.jsx", error: String((e && e.message) || e) }); }

// components/data/Card.jsx
try { (() => {
/**
 * Content surface. White, soft radius, hairline border, light shadow.
 * Optional header (title + right-side actions) and "knife-cut" corner motif.
 */
function Card({
  children,
  title,
  subtitle,
  actions = null,
  padding = 20,
  cut = false,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      border: 'var(--border-card)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)',
      clipPath: cut ? 'var(--clip-cut-br)' : 'none',
      overflow: 'hidden',
      fontFamily: 'var(--font-body)',
      ...style
    }
  }, (title || actions) && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
      gap: 12,
      padding: `16px ${padding}px`,
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("div", null, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--fw-bold)',
      fontSize: 16,
      color: 'var(--text-strong)'
    }
  }, title), subtitle && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-muted)',
      marginTop: 2
    }
  }, subtitle)), actions && /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 8,
      flexShrink: 0
    }
  }, actions)), /*#__PURE__*/React.createElement("div", {
    style: {
      padding
    }
  }, children));
}
Object.assign(__ds_scope, { Card });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/Card.jsx", error: String((e && e.message) || e) }); }

// components/data/DataTable.jsx
try { (() => {
/**
 * Reporting table used across MarginEdge (P&L, inventory, price history).
 * columns: [{ key, label, align, numeric, width, render }]
 * rows: array of objects. Supports variance coloring via numeric cells and
 * an optional total row (bold, tinted).
 */
function DataTable({
  columns = [],
  rows = [],
  totalRow = null,
  dense = false,
  style = {}
}) {
  const pad = dense ? '8px 12px' : '12px 16px';
  const cellAlign = c => c.align || (c.numeric ? 'right' : 'left');
  const renderCell = (col, row) => {
    if (col.render) return col.render(row[col.key], row);
    const v = row[col.key];
    return v;
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      width: '100%',
      overflowX: 'auto',
      fontFamily: 'var(--font-body)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: '100%',
      borderCollapse: 'collapse',
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, columns.map(c => /*#__PURE__*/React.createElement("th", {
    key: c.key,
    style: {
      textAlign: cellAlign(c),
      padding: pad,
      fontSize: 11,
      fontWeight: 'var(--fw-bold)',
      letterSpacing: '0.05em',
      textTransform: 'uppercase',
      color: 'var(--text-subtle)',
      borderBottom: '2px solid var(--border-default)',
      width: c.width || 'auto',
      whiteSpace: 'nowrap',
      background: 'var(--neutral-50)'
    }
  }, c.label)))), /*#__PURE__*/React.createElement("tbody", null, rows.map((row, i) => /*#__PURE__*/React.createElement("tr", {
    key: row.id ?? i,
    style: {
      borderBottom: '1px solid var(--border-subtle)',
      background: 'var(--white)'
    },
    onMouseEnter: e => e.currentTarget.style.background = 'var(--blue-50)',
    onMouseLeave: e => e.currentTarget.style.background = 'var(--white)'
  }, columns.map(c => /*#__PURE__*/React.createElement("td", {
    key: c.key,
    className: c.numeric ? 'me-num' : undefined,
    style: {
      textAlign: cellAlign(c),
      padding: pad,
      color: c.numeric ? 'var(--text-strong)' : 'var(--text-body)',
      fontVariantNumeric: c.numeric ? 'tabular-nums' : 'normal',
      fontWeight: c.strong ? 'var(--fw-semibold)' : 'var(--fw-regular)',
      whiteSpace: 'nowrap'
    }
  }, renderCell(c, row))))), totalRow && /*#__PURE__*/React.createElement("tr", {
    style: {
      background: 'var(--neutral-50)',
      borderTop: '2px solid var(--border-default)'
    }
  }, columns.map(c => /*#__PURE__*/React.createElement("td", {
    key: c.key,
    className: c.numeric ? 'me-num' : undefined,
    style: {
      textAlign: cellAlign(c),
      padding: pad,
      fontWeight: 'var(--fw-bold)',
      color: 'var(--text-strong)',
      fontVariantNumeric: c.numeric ? 'tabular-nums' : 'normal',
      whiteSpace: 'nowrap'
    }
  }, totalRow[c.key]))))));
}
Object.assign(__ds_scope, { DataTable });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/DataTable.jsx", error: String((e && e.message) || e) }); }

// components/data/StatTile.jsx
try { (() => {
/**
 * KPI / metric tile for dashboards and reporting.
 * Shows a label, a big tabular-number value, and an optional delta chip
 * coloured favorable (teal) / unfavorable (persimmon).
 */
function StatTile({
  label,
  value,
  unit = '',
  delta = null,
  // e.g. "+2.3%" or "-$1,240"
  deltaDirection = 'up',
  // 'up' | 'down'
  favorable = null,
  // true=good(teal) false=bad(persimmon); overrides direction color
  hint = '',
  accent = 'var(--me-blue)',
  style = {}
}) {
  const good = favorable !== null ? favorable : deltaDirection === 'up';
  const deltaColor = good ? 'var(--pos)' : 'var(--neg)';
  const deltaBg = good ? 'var(--success-bg)' : 'var(--danger-bg)';
  return /*#__PURE__*/React.createElement("div", {
    style: {
      background: 'var(--surface-card)',
      border: 'var(--border-card)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-sm)',
      padding: 18,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      fontFamily: 'var(--font-body)',
      borderTop: `3px solid ${accent}`,
      ...style
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      fontWeight: 'var(--fw-semibold)',
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: 'var(--text-subtle)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'baseline',
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    className: "me-num",
    style: {
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--fw-extra)',
      fontSize: 30,
      color: 'var(--text-strong)',
      fontVariantNumeric: 'tabular-nums',
      lineHeight: 1
    }
  }, value, unit && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 'var(--fw-bold)',
      color: 'var(--text-muted)'
    }
  }, unit)), delta && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      fontSize: 12,
      fontWeight: 'var(--fw-bold)',
      color: deltaColor,
      background: deltaBg,
      padding: '2px 7px',
      borderRadius: 'var(--radius-pill)'
    }
  }, good ? '▲' : '▼', " ", delta)), hint && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: 'var(--text-subtle)'
    }
  }, hint));
}
Object.assign(__ds_scope, { StatTile });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/data/StatTile.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Toast.jsx
try { (() => {
/**
 * Inline notification / toast. tone: info | success | warning | danger.
 * Use standalone or stacked in a corner container.
 */
function Toast({
  tone = 'info',
  title,
  message,
  onClose = null,
  style = {}
}) {
  const cfg = {
    info: {
      accent: 'var(--me-blue)',
      bg: 'var(--blue-50)'
    },
    success: {
      accent: 'var(--teal-600)',
      bg: 'var(--teal-50)'
    },
    warning: {
      accent: 'var(--honey-500)',
      bg: 'var(--honey-50)'
    },
    danger: {
      accent: 'var(--persimmon-500)',
      bg: 'var(--persimmon-50)'
    }
  }[tone];
  const icons = {
    info: /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "9"
    }),
    success: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "9"
    }), /*#__PURE__*/React.createElement("polyline", {
      points: "8 12 11 15 16 9"
    })),
    warning: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
      d: "M12 3 2 20h20z"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "10",
      x2: "12",
      y2: "14"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "17",
      x2: "12",
      y2: "17"
    })),
    danger: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
      cx: "12",
      cy: "12",
      r: "9"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "8",
      x2: "12",
      y2: "13"
    }), /*#__PURE__*/React.createElement("line", {
      x1: "12",
      y1: "16",
      x2: "12",
      y2: "16"
    }))
  }[tone];
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: 12,
      width: 360,
      maxWidth: '100%',
      padding: '14px 16px',
      background: 'var(--white)',
      borderRadius: 'var(--radius-md)',
      boxShadow: 'var(--shadow-lg)',
      borderLeft: `4px solid ${cfg.accent}`,
      fontFamily: 'var(--font-body)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: cfg.accent,
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      flexShrink: 0,
      marginTop: 1
    }
  }, icons), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1
    }
  }, title && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 'var(--fw-bold)',
      color: 'var(--text-strong)'
    }
  }, title), message && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: 'var(--text-muted)',
      marginTop: 2,
      lineHeight: 1.45
    }
  }, message)), onClose && /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Dismiss",
    style: {
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      color: 'var(--neutral-400)',
      display: 'inline-flex',
      padding: 2
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18"
  }))));
}
Object.assign(__ds_scope, { Toast });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Toast.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Tooltip.jsx
try { (() => {
/** Hover tooltip. Wraps a trigger; shows a small dark label on hover. */
function Tooltip({
  children,
  label,
  placement = 'top',
  style = {}
}) {
  const [show, setShow] = React.useState(false);
  const pos = {
    top: {
      bottom: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginBottom: 8
    },
    bottom: {
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginTop: 8
    },
    left: {
      right: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginRight: 8
    },
    right: {
      left: '100%',
      top: '50%',
      transform: 'translateY(-50%)',
      marginLeft: 8
    }
  }[placement];
  return /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'relative',
      display: 'inline-flex',
      ...style
    },
    onMouseEnter: () => setShow(true),
    onMouseLeave: () => setShow(false)
  }, children, show && /*#__PURE__*/React.createElement("span", {
    role: "tooltip",
    style: {
      position: 'absolute',
      ...pos,
      whiteSpace: 'nowrap',
      background: 'var(--me-black)',
      color: 'var(--white)',
      fontFamily: 'var(--font-body)',
      fontSize: 12,
      fontWeight: 'var(--fw-medium)',
      padding: '6px 9px',
      borderRadius: 'var(--radius-sm)',
      boxShadow: 'var(--shadow-md)',
      zIndex: 500,
      pointerEvents: 'none'
    }
  }, label));
}
Object.assign(__ds_scope, { Tooltip });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Tooltip.jsx", error: String((e && e.message) || e) }); }

// components/forms/Button.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * MarginEdge primary action button.
 * Variants: primary (blue), secondary (outline), ghost, danger.
 * Sizes: sm, md, lg. Optional leading/trailing icon nodes.
 */
function Button({
  children,
  variant = 'primary',
  size = 'md',
  iconLeft = null,
  iconRight = null,
  fullWidth = false,
  disabled = false,
  type = 'button',
  onClick,
  style = {},
  ...rest
}) {
  const sizes = {
    sm: {
      fontSize: 13,
      padding: '7px 14px',
      gap: 6,
      height: 34
    },
    md: {
      fontSize: 14,
      padding: '9px 18px',
      gap: 8,
      height: 40
    },
    lg: {
      fontSize: 16,
      padding: '12px 26px',
      gap: 8,
      height: 48
    }
  };
  const s = sizes[size] || sizes.md;
  const variants = {
    primary: {
      background: 'var(--action-primary)',
      color: 'var(--white)',
      border: '1px solid var(--action-primary)'
    },
    secondary: {
      background: 'var(--white)',
      color: 'var(--me-blue)',
      border: '1px solid var(--border-default)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--me-blue)',
      border: '1px solid transparent'
    },
    danger: {
      background: 'var(--danger)',
      color: 'var(--white)',
      border: '1px solid var(--danger)'
    }
  };
  const base = {
    display: fullWidth ? 'flex' : 'inline-flex',
    width: fullWidth ? '100%' : 'auto',
    alignItems: 'center',
    justifyContent: 'center',
    gap: s.gap,
    height: s.height,
    padding: s.padding,
    fontFamily: 'var(--font-body)',
    fontWeight: 'var(--fw-bold)',
    fontSize: s.fontSize,
    lineHeight: 1,
    letterSpacing: '0.01em',
    borderRadius: 'var(--radius-md)',
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    transition: 'background var(--dur-fast) var(--ease-standard), box-shadow var(--dur-fast) var(--ease-standard), transform var(--dur-fast) var(--ease-standard)',
    whiteSpace: 'nowrap',
    ...variants[variant],
    ...style
  };
  const hoverBg = {
    primary: 'var(--action-primary-hover)',
    secondary: 'var(--neutral-50)',
    ghost: 'var(--blue-100)',
    danger: 'var(--persimmon-600)'
  }[variant];
  return /*#__PURE__*/React.createElement("button", _extends({
    type: type,
    disabled: disabled,
    onClick: onClick,
    style: base,
    onMouseEnter: e => {
      if (!disabled) e.currentTarget.style.background = hoverBg;
    },
    onMouseLeave: e => {
      if (!disabled) e.currentTarget.style.background = variants[variant].background;
    },
    onMouseDown: e => {
      if (!disabled) e.currentTarget.style.transform = 'translateY(1px)';
    },
    onMouseUp: e => {
      e.currentTarget.style.transform = 'none';
    }
  }, rest), iconLeft && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex'
    }
  }, iconLeft), children, iconRight && /*#__PURE__*/React.createElement("span", {
    style: {
      display: 'inline-flex'
    }
  }, iconRight));
}
Object.assign(__ds_scope, { Button });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Button.jsx", error: String((e && e.message) || e) }); }

// components/feedback/Dialog.jsx
try { (() => {
/**
 * Modal dialog with scrim, title bar, body, and footer actions.
 * Controlled via `open`. Provide `onClose`.
 */
function Dialog({
  open,
  onClose,
  title,
  children,
  footer = null,
  width = 480
}) {
  if (!open) return null;
  return /*#__PURE__*/React.createElement("div", {
    onClick: onClose,
    style: {
      position: 'fixed',
      inset: 0,
      background: 'rgba(40, 40, 39, 0.45)',
      backdropFilter: 'blur(2px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      zIndex: 1000,
      fontFamily: 'var(--font-body)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: e => e.stopPropagation(),
    style: {
      width,
      maxWidth: '100%',
      maxHeight: '90vh',
      overflow: 'auto',
      background: 'var(--white)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-lg)'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      padding: '18px 22px',
      borderBottom: '1px solid var(--border-subtle)'
    }
  }, /*#__PURE__*/React.createElement("h3", {
    style: {
      margin: 0,
      fontFamily: 'var(--font-display)',
      fontWeight: 'var(--fw-bold)',
      fontSize: 19,
      color: 'var(--text-strong)'
    }
  }, title), /*#__PURE__*/React.createElement("button", {
    onClick: onClose,
    "aria-label": "Close",
    style: {
      border: 'none',
      background: 'transparent',
      cursor: 'pointer',
      color: 'var(--neutral-500)',
      display: 'inline-flex',
      padding: 4
    }
  }, /*#__PURE__*/React.createElement("svg", {
    width: "20",
    height: "20",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "2",
    strokeLinecap: "round"
  }, /*#__PURE__*/React.createElement("line", {
    x1: "18",
    y1: "6",
    x2: "6",
    y2: "18"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "6",
    y1: "6",
    x2: "18",
    y2: "18"
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 22,
      fontSize: 14,
      color: 'var(--text-body)',
      lineHeight: 1.55
    }
  }, children), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      justifyContent: 'flex-end',
      gap: 10,
      padding: '16px 22px',
      borderTop: '1px solid var(--border-subtle)',
      background: 'var(--neutral-50)'
    }
  }, footer || /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "secondary",
    onClick: onClose
  }, "Cancel"), /*#__PURE__*/React.createElement(__ds_scope.Button, {
    variant: "primary",
    onClick: onClose
  }, "Confirm")))));
}
Object.assign(__ds_scope, { Dialog });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/feedback/Dialog.jsx", error: String((e && e.message) || e) }); }

// components/forms/Checkbox.jsx
try { (() => {
/** Checkbox with hand-drawn brand check feel (crisp blue fill when checked). */
function Checkbox({
  checked = false,
  onChange,
  label,
  disabled = false,
  id,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: id,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      fontFamily: 'var(--font-body)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: 20,
      height: 20,
      borderRadius: 'var(--radius-xs)',
      background: checked ? 'var(--me-blue)' : 'var(--white)',
      border: `1px solid ${checked ? 'var(--me-blue)' : 'var(--border-strong)'}`,
      transition: 'background var(--dur-fast), border-color var(--dur-fast)'
    }
  }, checked && /*#__PURE__*/React.createElement("svg", {
    width: "13",
    height: "13",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "#fff",
    strokeWidth: "3.2",
    strokeLinecap: "round",
    strokeLinejoin: "round"
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  }))), /*#__PURE__*/React.createElement("input", {
    id: id,
    type: "checkbox",
    checked: checked,
    onChange: e => onChange && onChange(e.target.checked),
    disabled: disabled,
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--text-body)'
    }
  }, label));
}
Object.assign(__ds_scope, { Checkbox });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Checkbox.jsx", error: String((e && e.message) || e) }); }

// components/forms/IconButton.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Square icon-only button — toolbar actions, table row actions.
 * Variants: default (subtle), primary, ghost.
 */
function IconButton({
  children,
  label,
  variant = 'default',
  size = 'md',
  disabled = false,
  onClick,
  style = {},
  ...rest
}) {
  const dim = {
    sm: 30,
    md: 38,
    lg: 44
  }[size] || 38;
  const variants = {
    default: {
      background: 'var(--white)',
      color: 'var(--neutral-700)',
      border: '1px solid var(--border-default)'
    },
    primary: {
      background: 'var(--action-primary)',
      color: 'var(--white)',
      border: '1px solid var(--action-primary)'
    },
    ghost: {
      background: 'transparent',
      color: 'var(--neutral-600)',
      border: '1px solid transparent'
    }
  };
  const hoverBg = {
    default: 'var(--neutral-50)',
    primary: 'var(--action-primary-hover)',
    ghost: 'var(--neutral-100)'
  }[variant];
  return /*#__PURE__*/React.createElement("button", _extends({
    type: "button",
    "aria-label": label,
    title: label,
    disabled: disabled,
    onClick: onClick,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: dim,
      height: dim,
      borderRadius: 'var(--radius-md)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.45 : 1,
      transition: 'background var(--dur-fast) var(--ease-standard)',
      ...variants[variant],
      ...style
    },
    onMouseEnter: e => {
      if (!disabled) e.currentTarget.style.background = hoverBg;
    },
    onMouseLeave: e => {
      if (!disabled) e.currentTarget.style.background = variants[variant].background;
    }
  }, rest), children);
}
Object.assign(__ds_scope, { IconButton });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/IconButton.jsx", error: String((e && e.message) || e) }); }

// components/forms/Radio.jsx
try { (() => {
/** Radio group. options: array of { value, label } or strings. */
function Radio({
  name,
  value,
  onChange,
  options = [],
  disabled = false,
  direction = 'column',
  style = {}
}) {
  const opts = options.map(o => typeof o === 'string' ? {
    value: o,
    label: o
  } : o);
  return /*#__PURE__*/React.createElement("div", {
    role: "radiogroup",
    style: {
      display: 'flex',
      flexDirection: direction,
      gap: direction === 'row' ? 20 : 12,
      fontFamily: 'var(--font-body)',
      ...style
    }
  }, opts.map(o => {
    const selected = value === o.value;
    return /*#__PURE__*/React.createElement("label", {
      key: o.value,
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1
      }
    }, /*#__PURE__*/React.createElement("span", {
      onClick: () => !disabled && onChange && onChange(o.value),
      style: {
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 20,
        height: 20,
        borderRadius: '50%',
        background: 'var(--white)',
        border: `1px solid ${selected ? 'var(--me-blue)' : 'var(--border-strong)'}`,
        transition: 'border-color var(--dur-fast)'
      }
    }, selected && /*#__PURE__*/React.createElement("span", {
      style: {
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: 'var(--me-blue)'
      }
    })), /*#__PURE__*/React.createElement("input", {
      type: "radio",
      name: name,
      value: o.value,
      checked: selected,
      onChange: () => onChange && onChange(o.value),
      disabled: disabled,
      style: {
        position: 'absolute',
        opacity: 0,
        width: 0,
        height: 0
      }
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        color: 'var(--text-body)'
      }
    }, o.label));
  }));
}
Object.assign(__ds_scope, { Radio });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Radio.jsx", error: String((e && e.message) || e) }); }

// components/forms/Select.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Labeled native select styled to match TextField.
 * options: array of { value, label } or strings.
 */
function Select({
  label,
  value,
  onChange,
  options = [],
  placeholder = 'Select…',
  disabled = false,
  id,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const opts = options.map(o => typeof o === 'string' ? {
    value: o,
    label: o
  } : o);
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: id,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-body)',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 'var(--fw-semibold)',
      color: 'var(--text-body)'
    }
  }, label), /*#__PURE__*/React.createElement("div", {
    style: {
      position: 'relative',
      display: 'flex',
      alignItems: 'center'
    }
  }, /*#__PURE__*/React.createElement("select", _extends({
    id: id,
    value: value,
    onChange: onChange,
    disabled: disabled,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      appearance: 'none',
      width: '100%',
      height: 40,
      padding: '0 36px 0 12px',
      background: disabled ? 'var(--neutral-50)' : 'var(--white)',
      border: `1px solid ${focus ? 'var(--me-blue)' : 'var(--border-default)'}`,
      borderRadius: 'var(--radius-md)',
      boxShadow: focus ? 'var(--shadow-focus)' : 'none',
      fontFamily: 'var(--font-body)',
      fontSize: 14,
      color: value ? 'var(--text-strong)' : 'var(--text-subtle)',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)'
    }
  }, rest), placeholder && /*#__PURE__*/React.createElement("option", {
    value: "",
    disabled: true
  }, placeholder), opts.map(o => /*#__PURE__*/React.createElement("option", {
    key: o.value,
    value: o.value
  }, o.label))), /*#__PURE__*/React.createElement("svg", {
    width: "16",
    height: "16",
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "var(--neutral-500)",
    strokeWidth: "2",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    style: {
      position: 'absolute',
      right: 12,
      pointerEvents: 'none'
    }
  }, /*#__PURE__*/React.createElement("polyline", {
    points: "6 9 12 15 18 9"
  }))));
}
Object.assign(__ds_scope, { Select });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Select.jsx", error: String((e && e.message) || e) }); }

// components/forms/Switch.jsx
try { (() => {
/** Toggle switch — settings, feature flags. Blue when on. */
function Switch({
  checked = false,
  onChange,
  label,
  disabled = false,
  id,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: id,
    style: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
      cursor: disabled ? 'not-allowed' : 'pointer',
      opacity: disabled ? 0.5 : 1,
      fontFamily: 'var(--font-body)',
      ...style
    }
  }, /*#__PURE__*/React.createElement("span", {
    onClick: () => !disabled && onChange && onChange(!checked),
    style: {
      position: 'relative',
      width: 40,
      height: 22,
      borderRadius: 'var(--radius-pill)',
      background: checked ? 'var(--me-blue)' : 'var(--neutral-300)',
      transition: 'background var(--dur-normal) var(--ease-standard)',
      flexShrink: 0
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      position: 'absolute',
      top: 2,
      left: checked ? 20 : 2,
      width: 18,
      height: 18,
      borderRadius: '50%',
      background: 'var(--white)',
      boxShadow: 'var(--shadow-sm)',
      transition: 'left var(--dur-normal) var(--ease-out)'
    }
  })), /*#__PURE__*/React.createElement("input", {
    id: id,
    type: "checkbox",
    checked: checked,
    onChange: e => onChange && onChange(e.target.checked),
    disabled: disabled,
    style: {
      position: 'absolute',
      opacity: 0,
      width: 0,
      height: 0
    }
  }), label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: 'var(--text-body)'
    }
  }, label));
}
Object.assign(__ds_scope, { Switch });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/Switch.jsx", error: String((e && e.message) || e) }); }

// components/forms/TextField.jsx
try { (() => {
function _extends() { return _extends = Object.assign ? Object.assign.bind() : function (n) { for (var e = 1; e < arguments.length; e++) { var t = arguments[e]; for (var r in t) ({}).hasOwnProperty.call(t, r) && (n[r] = t[r]); } return n; }, _extends.apply(null, arguments); }
/**
 * Labeled text input with optional helper / error text and affixes.
 */
function TextField({
  label,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  helper = '',
  error = '',
  prefix = null,
  suffix = null,
  disabled = false,
  required = false,
  id,
  style = {},
  ...rest
}) {
  const [focus, setFocus] = React.useState(false);
  const invalid = !!error;
  const borderColor = invalid ? 'var(--danger)' : focus ? 'var(--me-blue)' : 'var(--border-default)';
  return /*#__PURE__*/React.createElement("label", {
    htmlFor: id,
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
      fontFamily: 'var(--font-body)',
      ...style
    }
  }, label && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 'var(--fw-semibold)',
      color: 'var(--text-body)'
    }
  }, label, required && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--danger)'
    }
  }, " *")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      height: 40,
      padding: '0 12px',
      background: disabled ? 'var(--neutral-50)' : 'var(--white)',
      border: `1px solid ${borderColor}`,
      borderRadius: 'var(--radius-md)',
      boxShadow: focus && !invalid ? 'var(--shadow-focus)' : 'none',
      transition: 'border-color var(--dur-fast), box-shadow var(--dur-fast)'
    }
  }, prefix && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-subtle)',
      fontSize: 14,
      display: 'inline-flex'
    }
  }, prefix), /*#__PURE__*/React.createElement("input", _extends({
    id: id,
    type: type,
    value: value,
    onChange: onChange,
    placeholder: placeholder,
    disabled: disabled,
    required: required,
    onFocus: () => setFocus(true),
    onBlur: () => setFocus(false),
    style: {
      flex: 1,
      border: 'none',
      outline: 'none',
      background: 'transparent',
      fontFamily: 'var(--font-body)',
      fontSize: 14,
      color: 'var(--text-strong)',
      minWidth: 0
    }
  }, rest)), suffix && /*#__PURE__*/React.createElement("span", {
    style: {
      color: 'var(--text-subtle)',
      fontSize: 14,
      display: 'inline-flex'
    }
  }, suffix)), (helper || error) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: invalid ? 'var(--danger)' : 'var(--text-subtle)'
    }
  }, error || helper));
}
Object.assign(__ds_scope, { TextField });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/forms/TextField.jsx", error: String((e && e.message) || e) }); }

// components/navigation/SidebarNav.jsx
try { (() => {
/**
 * App sidebar navigation list used in the MarginEdge product.
 * items: [{ value, label, icon?(ReactNode), badge? }].
 * Dark ("me-black") or light theme.
 */
function SidebarNav({
  items = [],
  value,
  onChange,
  theme = 'light',
  style = {}
}) {
  const dark = theme === 'dark';
  return /*#__PURE__*/React.createElement("nav", {
    style: {
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      fontFamily: 'var(--font-body)',
      ...style
    }
  }, items.map(it => {
    const active = it.value === value;
    const color = active ? dark ? 'var(--white)' : 'var(--me-blue)' : dark ? 'var(--neutral-300)' : 'var(--text-muted)';
    const bg = active ? dark ? 'rgba(255,255,255,0.10)' : 'var(--blue-50)' : 'transparent';
    return /*#__PURE__*/React.createElement("button", {
      key: it.value,
      onClick: () => onChange && onChange(it.value),
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        width: '100%',
        textAlign: 'left',
        border: 'none',
        cursor: 'pointer',
        padding: '9px 12px',
        borderRadius: 'var(--radius-md)',
        background: bg,
        color,
        fontFamily: 'var(--font-body)',
        fontSize: 14,
        fontWeight: active ? 'var(--fw-bold)' : 'var(--fw-medium)',
        position: 'relative',
        transition: 'background var(--dur-fast), color var(--dur-fast)'
      },
      onMouseEnter: e => {
        if (!active) e.currentTarget.style.background = dark ? 'rgba(255,255,255,0.06)' : 'var(--neutral-50)';
      },
      onMouseLeave: e => {
        if (!active) e.currentTarget.style.background = 'transparent';
      }
    }, active && /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        left: 0,
        top: 8,
        bottom: 8,
        width: 3,
        borderRadius: '0 3px 3px 0',
        background: 'var(--me-blue)'
      }
    }), it.icon && /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'inline-flex',
        width: 18,
        height: 18,
        flexShrink: 0
      }
    }, it.icon), /*#__PURE__*/React.createElement("span", {
      style: {
        flex: 1
      }
    }, it.label), it.badge != null && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 'var(--fw-bold)',
        color: 'var(--white)',
        background: 'var(--persimmon-500)',
        borderRadius: 'var(--radius-pill)',
        padding: '1px 7px'
      }
    }, it.badge));
  }));
}
Object.assign(__ds_scope, { SidebarNav });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/SidebarNav.jsx", error: String((e && e.message) || e) }); }

// components/navigation/Tabs.jsx
try { (() => {
/**
 * Underline tab bar. items: [{ value, label, badge? }].
 * Active tab shows a blue underline; controlled via `value`.
 */
function Tabs({
  items = [],
  value,
  onChange,
  style = {}
}) {
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: 'flex',
      gap: 4,
      borderBottom: '1px solid var(--border-subtle)',
      fontFamily: 'var(--font-body)',
      ...style
    }
  }, items.map(it => {
    const active = it.value === value;
    return /*#__PURE__*/React.createElement("button", {
      key: it.value,
      onClick: () => onChange && onChange(it.value),
      style: {
        position: 'relative',
        border: 'none',
        background: 'transparent',
        cursor: 'pointer',
        padding: '12px 16px',
        fontFamily: 'var(--font-body)',
        fontSize: 14,
        fontWeight: active ? 'var(--fw-bold)' : 'var(--fw-medium)',
        color: active ? 'var(--me-blue)' : 'var(--text-muted)',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        transition: 'color var(--dur-fast)'
      },
      onMouseEnter: e => {
        if (!active) e.currentTarget.style.color = 'var(--text-strong)';
      },
      onMouseLeave: e => {
        if (!active) e.currentTarget.style.color = 'var(--text-muted)';
      }
    }, it.label, it.badge != null && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 11,
        fontWeight: 'var(--fw-bold)',
        color: active ? 'var(--me-blue)' : 'var(--text-subtle)',
        background: active ? 'var(--blue-100)' : 'var(--neutral-100)',
        borderRadius: 'var(--radius-pill)',
        padding: '1px 7px'
      }
    }, it.badge), /*#__PURE__*/React.createElement("span", {
      style: {
        position: 'absolute',
        left: 8,
        right: 8,
        bottom: -1,
        height: 3,
        borderRadius: '3px 3px 0 0',
        background: active ? 'var(--me-blue)' : 'transparent',
        transition: 'background var(--dur-fast)'
      }
    }));
  }));
}
Object.assign(__ds_scope, { Tabs });
})(); } catch (e) { __ds_ns.__errors.push({ path: "components/navigation/Tabs.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/AppShell.jsx
try { (() => {
// MarginEdge web-app shell: dark sidebar + top bar, renders the active screen.
(function () {
  const {
    SidebarNav,
    IconButton,
    Badge
  } = window.MarginEdgeDesignSystem_e6ce8f;
  const I = window.MEIcons;
  function AppShell({
    view,
    setView,
    children,
    restaurant = 'Acropolis Greek Taverna'
  }) {
    const nav = [{
      value: 'dashboard',
      label: 'Dashboard',
      icon: /*#__PURE__*/React.createElement(I.dashboard, null)
    }, {
      value: 'invoices',
      label: 'Invoices',
      icon: /*#__PURE__*/React.createElement(I.invoice, null),
      badge: 8
    }, {
      value: 'pl',
      label: 'P&L',
      icon: /*#__PURE__*/React.createElement(I.chart, null)
    }, {
      value: 'inventory',
      label: 'Inventory',
      icon: /*#__PURE__*/React.createElement(I.box, null)
    }, {
      value: 'recipes',
      label: 'Recipes',
      icon: /*#__PURE__*/React.createElement(I.recipe, null)
    }, {
      value: 'ordering',
      label: 'Ordering',
      icon: /*#__PURE__*/React.createElement(I.cart, null)
    }, {
      value: 'budget',
      label: 'Budget',
      icon: /*#__PURE__*/React.createElement(I.budget, null)
    }];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: 'var(--surface-page)',
        fontFamily: 'var(--font-body)'
      }
    }, /*#__PURE__*/React.createElement("aside", {
      style: {
        width: 'var(--app-sidebar-w)',
        flexShrink: 0,
        background: 'var(--me-black)',
        display: 'flex',
        flexDirection: 'column',
        padding: '18px 14px'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '2px 8px 20px'
      }
    }, /*#__PURE__*/React.createElement("img", {
      src: "../../assets/logos/me-white.png",
      alt: "MarginEdge",
      style: {
        height: 34,
        width: 'auto'
      }
    })), /*#__PURE__*/React.createElement(SidebarNav, {
      items: nav,
      value: view,
      onChange: setView,
      theme: "dark"
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }
    }, /*#__PURE__*/React.createElement(SidebarNav, {
      items: [{
        value: 'settings',
        label: 'Settings',
        icon: /*#__PURE__*/React.createElement(I.settings, null)
      }],
      value: view,
      onChange: setView,
      theme: "dark"
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("header", {
      style: {
        height: 'var(--app-topbar-h)',
        flexShrink: 0,
        background: 'var(--white)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        padding: '0 22px'
      }
    }, /*#__PURE__*/React.createElement("button", {
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        border: '1px solid var(--border-default)',
        background: 'var(--white)',
        borderRadius: 'var(--radius-md)',
        padding: '7px 12px',
        cursor: 'pointer',
        fontFamily: 'var(--font-body)',
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--text-strong)'
      }
    }, restaurant, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--neutral-400)',
        display: 'inline-flex'
      }
    }, /*#__PURE__*/React.createElement(I.chevronDown, {
      size: 16
    }))), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        maxWidth: 420,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--neutral-50)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        padding: '8px 12px',
        color: 'var(--text-subtle)'
      }
    }, /*#__PURE__*/React.createElement(I.search, {
      size: 16
    }), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14
      }
    }, "Search invoices, products, vendors\u2026")), /*#__PURE__*/React.createElement("div", {
      style: {
        marginLeft: 'auto',
        display: 'flex',
        alignItems: 'center',
        gap: 12
      }
    }, /*#__PURE__*/React.createElement(IconButton, {
      label: "Notifications",
      variant: "ghost"
    }, /*#__PURE__*/React.createElement(I.bell, null)), /*#__PURE__*/React.createElement("div", {
      style: {
        width: 34,
        height: 34,
        borderRadius: '50%',
        background: 'var(--blue-600)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: 13
      }
    }, "JL"))), /*#__PURE__*/React.createElement("main", {
      style: {
        flex: 1,
        overflow: 'auto',
        padding: 26
      }
    }, children)));
  }
  window.AppShell = AppShell;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/AppShell.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/DashboardScreen.jsx
try { (() => {
// Dashboard: KPI tiles + P&L snapshot + recent invoice activity.
(function () {
  const {
    StatTile,
    Card,
    Badge,
    Button,
    DataTable
  } = window.MarginEdgeDesignSystem_e6ce8f;
  const DI = window.MEIcons;
  function DashboardScreen() {
    const plCols = [{
      key: 'cat',
      label: 'Category',
      strong: true
    }, {
      key: 'actual',
      label: 'Actual',
      numeric: true
    }, {
      key: 'pct',
      label: '% Sales',
      numeric: true
    }, {
      key: 'var',
      label: 'vs. Budget',
      numeric: true,
      render: v => /*#__PURE__*/React.createElement("span", {
        style: {
          color: v.startsWith('-') ? 'var(--pos)' : 'var(--neg)',
          fontWeight: 600
        }
      }, v)
    }];
    const plRows = [{
      cat: 'Food',
      actual: '$18,420',
      pct: '28.4%',
      var: '-$580'
    }, {
      cat: 'Beverage',
      actual: '$7,240',
      pct: '11.2%',
      var: '+$240'
    }, {
      cat: 'Labor',
      actual: '$22,110',
      pct: '34.1%',
      var: '-$890'
    }];
    const activity = [{
      v: 'Acropolis Produce',
      amt: '$1,204.50',
      status: 'success',
      label: 'Synced',
      time: '12 min ago'
    }, {
      v: 'Restaurant Depot',
      amt: '$862.10',
      status: 'warning',
      label: 'Needs review',
      time: '1 hr ago'
    }, {
      v: 'Breakthru Beverage',
      amt: '$3,410.00',
      status: 'info',
      label: 'Processing',
      time: '3 hrs ago'
    }, {
      v: 'US Foods',
      amt: '$2,088.75',
      status: 'success',
      label: 'Synced',
      time: 'Yesterday'
    }];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 22,
        maxWidth: 1180,
        margin: '0 auto'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        color: 'var(--me-blue)'
      }
    }, "Period to date"), /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: '4px 0 0',
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: 30,
        color: 'var(--text-strong)',
        letterSpacing: '-.02em'
      }
    }, "Good afternoon, Jessie")), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      iconLeft: /*#__PURE__*/React.createElement(DI.camera, {
        size: 16
      })
    }, "Upload invoice")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(StatTile, {
      label: "Prime cost %",
      value: "62.5",
      unit: "%",
      delta: "1.1%",
      favorable: false,
      hint: "target 60%"
    }), /*#__PURE__*/React.createElement(StatTile, {
      label: "Food cost %",
      value: "28.4",
      unit: "%",
      delta: "0.6%",
      favorable: true,
      hint: "vs. last period",
      accent: "var(--me-teal)"
    }), /*#__PURE__*/React.createElement(StatTile, {
      label: "Net sales (PTD)",
      value: "$64.8k",
      delta: "4.2%",
      favorable: true,
      accent: "var(--me-honey)",
      hint: "vs. last period"
    }), /*#__PURE__*/React.createElement(StatTile, {
      label: "Invoices to review",
      value: "8",
      accent: "var(--me-persimmon)",
      hint: "captured in 24\u201348 hrs"
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '1.4fr 1fr',
        gap: 18,
        alignItems: 'start'
      }
    }, /*#__PURE__*/React.createElement(Card, {
      title: "Daily controllable P&L",
      subtitle: "Prime costs, updated nightly",
      actions: /*#__PURE__*/React.createElement(Button, {
        variant: "ghost",
        size: "sm",
        iconRight: /*#__PURE__*/React.createElement(DI.external, {
          size: 15
        })
      }, "Full report"),
      padding: 0
    }, /*#__PURE__*/React.createElement(DataTable, {
      columns: plCols,
      rows: plRows,
      totalRow: {
        cat: 'Prime cost',
        actual: '$47,770',
        pct: '73.7%',
        var: '-$1,230'
      }
    })), /*#__PURE__*/React.createElement(Card, {
      title: "Recent invoice activity",
      actions: /*#__PURE__*/React.createElement(Badge, {
        tone: "brand",
        variant: "solid"
      }, "Live")
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }
    }, activity.map((a, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '11px 4px',
        borderBottom: i < 3 ? '1px solid var(--border-subtle)' : 'none'
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        width: 34,
        height: 34,
        borderRadius: 'var(--radius-sm)',
        background: 'var(--blue-50)',
        color: 'var(--me-blue)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement(DI.invoice, {
      size: 17
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--text-strong)',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
      }
    }, a.v), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--text-subtle)'
      }
    }, a.time)), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: 'right'
      }
    }, /*#__PURE__*/React.createElement("div", {
      className: "me-num",
      style: {
        fontSize: 14,
        fontWeight: 700,
        color: 'var(--text-strong)',
        fontVariantNumeric: 'tabular-nums'
      }
    }, a.amt), /*#__PURE__*/React.createElement(Badge, {
      tone: a.status,
      dot: true
    }, a.label))))))));
  }
  window.DashboardScreen = DashboardScreen;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/DashboardScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/InventoryScreen.jsx
try { (() => {
// Inventory count screen: category tabs, editable-looking count rows, on-hand value.
(function () {
  const {
    Card,
    Tabs,
    Button,
    TextField,
    Badge,
    StatTile
  } = window.MarginEdgeDesignSystem_e6ce8f;
  const VI = window.MEIcons;
  function InventoryScreen() {
    const [tab, setTab] = React.useState('food');
    const items = [{
      name: 'Ribeye 12oz',
      unit: 'each',
      count: '48',
      price: '$12.40',
      value: '$595.20',
      alert: true
    }, {
      name: 'Feta, block',
      unit: 'lb',
      count: '22',
      price: '$4.10',
      value: '$90.20'
    }, {
      name: 'Roma tomatoes',
      unit: 'case',
      count: '6',
      price: '$28.00',
      value: '$168.00'
    }, {
      name: 'Olive oil, XV',
      unit: 'gal',
      count: '9',
      price: '$34.75',
      value: '$312.75'
    }, {
      name: 'Pita bread',
      unit: 'dozen',
      count: '31',
      price: '$3.20',
      value: '$99.20'
    }];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 1040,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 18
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: 0,
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: 28,
        color: 'var(--text-strong)',
        letterSpacing: '-.02em'
      }
    }, "Inventory count"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary"
    }, "Save draft"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      iconLeft: /*#__PURE__*/React.createElement(VI.check, {
        size: 16
      })
    }, "Complete count"))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3,1fr)',
        gap: 14
      }
    }, /*#__PURE__*/React.createElement(StatTile, {
      label: "Total on-hand value",
      value: "$8,420",
      accent: "var(--me-blue)",
      hint: "across 3 categories"
    }), /*#__PURE__*/React.createElement(StatTile, {
      label: "Items counted",
      value: "126",
      unit: "/148",
      accent: "var(--me-teal)"
    }), /*#__PURE__*/React.createElement(StatTile, {
      label: "Price alerts",
      value: "3",
      accent: "var(--me-persimmon)",
      hint: "ingredients up >5%"
    })), /*#__PURE__*/React.createElement(Card, {
      padding: 0
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '0 8px'
      }
    }, /*#__PURE__*/React.createElement(Tabs, {
      value: tab,
      onChange: setTab,
      items: [{
        value: 'food',
        label: 'Food',
        badge: 62
      }, {
        value: 'bev',
        label: 'Beverage',
        badge: 40
      }, {
        value: 'supplies',
        label: 'Supplies',
        badge: 24
      }]
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '2fr 0.8fr 1fr 0.9fr 1fr',
        gap: 12,
        padding: '10px 18px',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '.05em',
        textTransform: 'uppercase',
        color: 'var(--text-subtle)',
        background: 'var(--neutral-50)',
        borderBottom: '1px solid var(--border-subtle)'
      }
    }, /*#__PURE__*/React.createElement("span", null, "Product"), /*#__PURE__*/React.createElement("span", null, "Unit"), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'center'
      }
    }, "Count"), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      }
    }, "Unit price"), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      }
    }, "Value")), items.map((it, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'grid',
        gridTemplateColumns: '2fr 0.8fr 1fr 0.9fr 1fr',
        gap: 12,
        padding: '10px 18px',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-subtle)'
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--text-strong)',
        display: 'flex',
        alignItems: 'center',
        gap: 8
      }
    }, it.name, it.alert && /*#__PURE__*/React.createElement(Badge, {
      tone: "warning",
      dot: true
    }, "Price \u2191")), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: 'var(--text-muted)'
      }
    }, it.unit), /*#__PURE__*/React.createElement("span", {
      style: {
        display: 'flex',
        justifyContent: 'center'
      }
    }, /*#__PURE__*/React.createElement("input", {
      defaultValue: it.count,
      style: {
        width: 64,
        textAlign: 'center',
        height: 34,
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-sm)',
        fontFamily: 'var(--font-num)',
        fontSize: 14,
        fontVariantNumeric: 'tabular-nums',
        color: 'var(--text-strong)'
      }
    })), /*#__PURE__*/React.createElement("span", {
      className: "me-num",
      style: {
        fontSize: 13,
        color: 'var(--text-muted)',
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums'
      }
    }, it.price), /*#__PURE__*/React.createElement("span", {
      className: "me-num",
      style: {
        fontSize: 14,
        fontWeight: 700,
        color: 'var(--text-strong)',
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums'
      }
    }, it.value)))));
  }
  window.InventoryScreen = InventoryScreen;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/InventoryScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/InvoicesScreen.jsx
try { (() => {
// Invoices: tabbed list with statuses, filters, and an approve dialog.
(function () {
  const {
    Tabs,
    Button,
    IconButton,
    Badge,
    Card,
    Checkbox,
    Dialog,
    Select
  } = window.MarginEdgeDesignSystem_e6ce8f;
  const NI = window.MEIcons;
  function InvoicesScreen() {
    const [tab, setTab] = React.useState('review');
    const [open, setOpen] = React.useState(false);
    const [sel, setSel] = React.useState({});
    const invoices = [{
      id: 1,
      vendor: 'Acropolis Produce',
      num: 'INV-88421',
      date: 'Jul 8',
      total: '$1,204.50',
      items: 42,
      status: 'warning',
      label: 'Needs review'
    }, {
      id: 2,
      vendor: 'Restaurant Depot',
      num: '4471-A',
      date: 'Jul 8',
      total: '$862.10',
      items: 18,
      status: 'warning',
      label: 'Needs review'
    }, {
      id: 3,
      vendor: 'Breakthru Beverage',
      num: 'BT-90233',
      date: 'Jul 7',
      total: '$3,410.00',
      items: 61,
      status: 'info',
      label: 'Processing'
    }, {
      id: 4,
      vendor: 'US Foods',
      num: 'USF-20481',
      date: 'Jul 7',
      total: '$2,088.75',
      items: 37,
      status: 'warning',
      label: 'Needs review'
    }, {
      id: 5,
      vendor: 'Chef Warehouse',
      num: 'CW-1120',
      date: 'Jul 6',
      total: '$744.20',
      items: 12,
      status: 'warning',
      label: 'Needs review'
    }];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 1100,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 18
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16
      }
    }, /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: 0,
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: 28,
        color: 'var(--text-strong)',
        letterSpacing: '-.02em'
      }
    }, "Invoices"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10
      }
    }, /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      iconLeft: /*#__PURE__*/React.createElement(NI.filter, {
        size: 16
      })
    }, "Filter"), /*#__PURE__*/React.createElement(Button, {
      variant: "primary",
      iconLeft: /*#__PURE__*/React.createElement(NI.camera, {
        size: 16
      })
    }, "Upload invoice"))), /*#__PURE__*/React.createElement(Card, {
      padding: 0
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        padding: '0 8px'
      }
    }, /*#__PURE__*/React.createElement(Tabs, {
      value: tab,
      onChange: setTab,
      items: [{
        value: 'review',
        label: 'To review',
        badge: 8
      }, {
        value: 'synced',
        label: 'Synced'
      }, {
        value: 'paid',
        label: 'Paid',
        badge: 3
      }, {
        value: 'all',
        label: 'All invoices'
      }]
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'grid',
        gridTemplateColumns: '38px 1.6fr 1fr 0.8fr 0.8fr 1fr 130px',
        gap: 12,
        padding: '10px 18px',
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: '.05em',
        textTransform: 'uppercase',
        color: 'var(--text-subtle)',
        background: 'var(--neutral-50)',
        borderBottom: '1px solid var(--border-subtle)'
      }
    }, /*#__PURE__*/React.createElement("span", null), /*#__PURE__*/React.createElement("span", null, "Vendor"), /*#__PURE__*/React.createElement("span", null, "Invoice #"), /*#__PURE__*/React.createElement("span", null, "Date"), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      }
    }, "Lines"), /*#__PURE__*/React.createElement("span", {
      style: {
        textAlign: 'right'
      }
    }, "Total"), /*#__PURE__*/React.createElement("span", null, "Status")), invoices.map(inv => /*#__PURE__*/React.createElement("div", {
      key: inv.id,
      style: {
        display: 'grid',
        gridTemplateColumns: '38px 1.6fr 1fr 0.8fr 0.8fr 1fr 130px',
        gap: 12,
        padding: '13px 18px',
        alignItems: 'center',
        borderBottom: '1px solid var(--border-subtle)',
        cursor: 'pointer'
      },
      onMouseEnter: e => e.currentTarget.style.background = 'var(--blue-50)',
      onMouseLeave: e => e.currentTarget.style.background = 'transparent',
      onClick: () => setOpen(true)
    }, /*#__PURE__*/React.createElement("span", {
      onClick: e => e.stopPropagation()
    }, /*#__PURE__*/React.createElement(Checkbox, {
      checked: !!sel[inv.id],
      onChange: v => setSel({
        ...sel,
        [inv.id]: v
      })
    })), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--text-strong)'
      }
    }, inv.vendor), /*#__PURE__*/React.createElement("span", {
      className: "me-num",
      style: {
        fontSize: 13,
        color: 'var(--text-muted)',
        fontVariantNumeric: 'tabular-nums'
      }
    }, inv.num), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: 'var(--text-muted)'
      }
    }, inv.date), /*#__PURE__*/React.createElement("span", {
      className: "me-num",
      style: {
        fontSize: 13,
        color: 'var(--text-muted)',
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums'
      }
    }, inv.items), /*#__PURE__*/React.createElement("span", {
      className: "me-num",
      style: {
        fontSize: 14,
        fontWeight: 700,
        color: 'var(--text-strong)',
        textAlign: 'right',
        fontVariantNumeric: 'tabular-nums'
      }
    }, inv.total), /*#__PURE__*/React.createElement("span", null, /*#__PURE__*/React.createElement(Badge, {
      tone: inv.status,
      dot: true
    }, inv.label))))), /*#__PURE__*/React.createElement(Dialog, {
      open: open,
      onClose: () => setOpen(false),
      title: "Approve invoice?",
      footer: /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement(Button, {
        variant: "secondary",
        onClick: () => setOpen(false)
      }, "Cancel"), /*#__PURE__*/React.createElement(Button, {
        variant: "primary",
        iconLeft: /*#__PURE__*/React.createElement(NI.check, {
          size: 16
        }),
        onClick: () => setOpen(false)
      }, "Approve & sync"))
    }, "We captured all line items on this invoice. Approving will sync it to your accounting system and update food costs across your reports."));
  }
  window.InvoicesScreen = InvoicesScreen;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/InvoicesScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/ProfitLossScreen.jsx
try { (() => {
// Daily controllable P&L report with period selector and variance coloring.
(function () {
  const {
    Card,
    DataTable,
    Select,
    Button,
    Badge
  } = window.MarginEdgeDesignSystem_e6ce8f;
  const PI = window.MEIcons;
  function ProfitLossScreen() {
    const money = v => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString();
    const cols = [{
      key: 'cat',
      label: 'Line item',
      strong: true
    }, {
      key: 'actual',
      label: 'Actual',
      numeric: true,
      render: v => money(v)
    }, {
      key: 'pct',
      label: '% of sales',
      numeric: true,
      render: v => v + '%'
    }, {
      key: 'budget',
      label: 'Budget',
      numeric: true,
      render: v => money(v)
    }, {
      key: 'variance',
      label: 'Variance',
      numeric: true,
      render: v => /*#__PURE__*/React.createElement("span", {
        style: {
          color: v <= 0 ? 'var(--pos)' : 'var(--neg)',
          fontWeight: 700
        }
      }, v <= 0 ? money(v) : '+' + money(v))
    }];
    const rows = [{
      cat: 'Net sales',
      actual: 64800,
      pct: '100.0',
      budget: 62000,
      variance: -2800,
      strong: true
    }, {
      cat: '  Food',
      actual: 18420,
      pct: '28.4',
      budget: 19000,
      variance: -580
    }, {
      cat: '  Beverage',
      actual: 7240,
      pct: '11.2',
      budget: 7000,
      variance: 240
    }, {
      cat: '  Paper & supplies',
      actual: 1980,
      pct: '3.1',
      budget: 2000,
      variance: -20
    }, {
      cat: '  Labor',
      actual: 22110,
      pct: '34.1',
      budget: 23000,
      variance: -890
    }];
    return /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: 1080,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: 18
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap'
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '.14em',
        textTransform: 'uppercase',
        color: 'var(--me-blue)'
      }
    }, "Daily controllable"), /*#__PURE__*/React.createElement("h1", {
      style: {
        margin: '4px 0 0',
        fontFamily: 'var(--font-display)',
        fontWeight: 800,
        fontSize: 28,
        color: 'var(--text-strong)',
        letterSpacing: '-.02em'
      }
    }, "Profit & Loss")), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10,
        alignItems: 'flex-end'
      }
    }, /*#__PURE__*/React.createElement(Select, {
      value: "ptd",
      onChange: () => {},
      options: [{
        value: 'ptd',
        label: 'Period to date'
      }, {
        value: 'week',
        label: 'This week'
      }, {
        value: 'last',
        label: 'Last period'
      }],
      style: {
        width: 180
      }
    }), /*#__PURE__*/React.createElement(Button, {
      variant: "secondary",
      iconLeft: /*#__PURE__*/React.createElement(PI.download, {
        size: 16
      })
    }, "Export"))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        color: 'var(--text-muted)',
        fontSize: 13
      }
    }, /*#__PURE__*/React.createElement(PI.clock, {
      size: 15
    }), " Updated nightly from your POS \xB7 invoices processed in 24\u201348 hrs", /*#__PURE__*/React.createElement(Badge, {
      tone: "success",
      dot: true,
      style: {
        marginLeft: 4
      }
    }, "Up to date")), /*#__PURE__*/React.createElement(Card, {
      padding: 0
    }, /*#__PURE__*/React.createElement(DataTable, {
      columns: cols,
      rows: rows,
      totalRow: {
        cat: 'Prime cost',
        actual: money(47770),
        pct: '73.7%',
        budget: money(49000),
        variance: /*#__PURE__*/React.createElement("span", {
          style: {
            color: 'var(--pos)'
          }
        }, "-$1,230")
      }
    })), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: 'var(--text-subtle)'
      }
    }, "Negative variances shown in ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--pos)',
        fontWeight: 700
      }
    }, "teal"), " (favorable / under budget); positive in ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--neg)',
        fontWeight: 700
      }
    }, "persimmon"), " (unfavorable / over budget)."));
  }
  window.ProfitLossScreen = ProfitLossScreen;
})();
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/ProfitLossScreen.jsx", error: String((e && e.message) || e) }); }

// ui_kits/web-app/icons.jsx
try { (() => {
// Shared thin line icons (Lucide-style single-weight strokes) for the
// MarginEdge web-app UI kit. See ICONOGRAPHY in readme.md — production uses
// Lucide via CDN as the documented substitute for MarginEdge's line icons.
const mkIcon = paths => (props = {}) => /*#__PURE__*/React.createElement("svg", {
  width: props.size || 18,
  height: props.size || 18,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: props.sw || 1.9,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  style: props.style
}, paths);
const Icons = {
  dashboard: mkIcon(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "3",
    width: "7",
    height: "9"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "3",
    width: "7",
    height: "5"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "14",
    y: "12",
    width: "7",
    height: "9"
  }), /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "16",
    width: "7",
    height: "5"
  }))),
  invoice: mkIcon(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M6 2h9l5 5v15H6z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M9 12h7M9 16h7M9 8h3"
  }))),
  chart: mkIcon(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M3 3v18h18"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 14l4-4 3 3 5-6"
  }))),
  box: mkIcon(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M3 7l9-4 9 4-9 4z"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 7v10l9 4 9-4V7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 11v10"
  }))),
  recipe: mkIcon(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "9",
    r: "5"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M8 21h8l-1-7H9z"
  }))),
  cart: mkIcon(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "9",
    cy: "20",
    r: "1.4"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "18",
    cy: "20",
    r: "1.4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M2 3h3l2.5 12h11l2-8H6"
  }))),
  budget: mkIcon(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("rect", {
    x: "3",
    y: "4",
    width: "18",
    height: "16",
    rx: "2"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M3 9h18M8 14h4"
  }))),
  settings: mkIcon(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.3.9a7 7 0 0 0-1.7-1L14.5 2h-5l-.4 2.5a7 7 0 0 0-1.7 1L5 4.6 3 8l2 1.5a7 7 0 0 0 0 2L3 13l2 3.4 2.3-.9a7 7 0 0 0 1.7 1l.5 2.5h5l.4-2.5a7 7 0 0 0 1.7-1l2.3.9 2-3.4-2-1.5c.1-.3.1-.7.1-1z"
  }))),
  search: mkIcon(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "11",
    cy: "11",
    r: "7"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 21l-4.3-4.3"
  }))),
  bell: mkIcon(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M13.7 21a2 2 0 0 1-3.4 0"
  }))),
  plus: mkIcon(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "5",
    x2: "12",
    y2: "19"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "5",
    y1: "12",
    x2: "19",
    y2: "12"
  }))),
  camera: mkIcon(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M3 7h4l2-2h6l2 2h4v13H3z"
  }), /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "13",
    r: "4"
  }))),
  download: mkIcon(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M12 3v12"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M7 11l5 4 5-4"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M4 21h16"
  }))),
  filter: mkIcon(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M3 4h18l-7 8v6l-4 2v-8z"
  }))),
  check: mkIcon(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("polyline", {
    points: "20 6 9 17 4 12"
  }))),
  chevronDown: mkIcon(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("polyline", {
    points: "6 9 12 15 18 9"
  }))),
  external: mkIcon(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M15 3h6v6"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M10 14 21 3"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M21 14v7H3V3h7"
  }))),
  clock: mkIcon(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("circle", {
    cx: "12",
    cy: "12",
    r: "9"
  }), /*#__PURE__*/React.createElement("path", {
    d: "M12 7v5l3 2"
  }))),
  alert: mkIcon(/*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("path", {
    d: "M12 3 2 20h20z"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "10",
    x2: "12",
    y2: "14"
  }), /*#__PURE__*/React.createElement("line", {
    x1: "12",
    y1: "17",
    x2: "12",
    y2: "17"
  })))
};
window.MEIcons = Icons;
})(); } catch (e) { __ds_ns.__errors.push({ path: "ui_kits/web-app/icons.jsx", error: String((e && e.message) || e) }); }

__ds_ns.Badge = __ds_scope.Badge;

__ds_ns.Card = __ds_scope.Card;

__ds_ns.DataTable = __ds_scope.DataTable;

__ds_ns.StatTile = __ds_scope.StatTile;

__ds_ns.Dialog = __ds_scope.Dialog;

__ds_ns.Toast = __ds_scope.Toast;

__ds_ns.Tooltip = __ds_scope.Tooltip;

__ds_ns.Button = __ds_scope.Button;

__ds_ns.Checkbox = __ds_scope.Checkbox;

__ds_ns.IconButton = __ds_scope.IconButton;

__ds_ns.Radio = __ds_scope.Radio;

__ds_ns.Select = __ds_scope.Select;

__ds_ns.Switch = __ds_scope.Switch;

__ds_ns.TextField = __ds_scope.TextField;

__ds_ns.SidebarNav = __ds_scope.SidebarNav;

__ds_ns.Tabs = __ds_scope.Tabs;

})();
