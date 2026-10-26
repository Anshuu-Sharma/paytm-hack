import type { CSSProperties, ReactNode } from "react";

// Screen slot over public/phone/iphone_mock.png. The transparent glass cutout
// starts at 10.3%, but we run the app content up to 7% — the highest point where
// the phone body is still full-width — so the coloured header covers the status
// bar area and no bezel strip shows above WhatsApp/Call. Below 7% the body only
// widens, so the content never pokes past the rounded top.
const SCREEN: CSSProperties = {
  top: "7%",
  bottom: "6.82%",
  left: "12.74%",
  right: "12.74%",
  borderRadius: "9% / 4%",
};

/**
 * Renders the iPhone frame PNG with a "screen" slot positioned exactly over its
 * transparent cutout, so children (a WhatsApp thread or a call UI) sit inside the
 * device. Fixed width keeps the corner radius and type sizes predictable.
 */
export default function PhoneFrame({
  children,
  width = 296,
  screenStyle,
}: {
  children: ReactNode;
  width?: number;
  screenStyle?: CSSProperties;
}) {
  return (
    <div className="relative select-none" style={{ width }}>
      {/* Screen content sits BEHIND the frame; it shows through the transparent
          glass while the opaque bezel (on top) masks its edges. */}
      <div className="absolute z-0 overflow-hidden" style={{ ...SCREEN, ...screenStyle }}>
        {children}
      </div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/phone/iphone_mock.png"
        alt=""
        draggable={false}
        className="pointer-events-none relative z-10 block w-full"
      />
    </div>
  );
}
