/* ===============================================================
   🏷️ KALKAN DIGITAL — marka geçişi 1. aşama
   ===============================================================
   - Paylaşılan liste notu (TR/EN/DE), footer geliştirici kredisi,
     admin başlık/sidebar/login, 9 e-posta şablonu + voucher
     varsayılanı, 2FA issuer varsayılanı → "Kalkan Digital".
   - Footer kredisi logosu = webmaster "Admin Logo" (sabit R2 path +
     ETag versiyonu); yoksa / yüklenemezse metin fallback'i.
   - Teknik tanımlayıcılar (/maki-admin, maki_favorites, maki-finans)
     DEĞİŞMEDİ.
   =============================================================== */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { readFileSync } from "fs";
import type { ComponentProps } from "react";

/* CDN base modül yüklenirken okunur (lib/storage/cdn.config.ts) → import'lardan ÖNCE. */
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_CDN_BASE_SITE_ASSETS = "https://cdn.example.com/site-assets";
});

const usePathnameMock = vi.fn();
vi.mock("next/navigation", () => ({ usePathname: () => usePathnameMock() }));

const getSiteAssetVersionsMock = vi.fn();
vi.mock("@/lib/storage/site-asset-version.server", () => ({
  getSiteAssetVersions: (...a: unknown[]) => getSiteAssetVersionsMock(...a),
}));
vi.mock("@/lib/cache.helpers", () => ({
  getCachedSettings: async () => ({ site_name: "VillaDirekt" }),
}));
vi.mock("@/lib/db/menu.repository", () => ({
  menuRepository: {
    findAllVillaLocations: async () => ({ data: [], error: null }),
    findAllVillaTypes: async () => ({ data: [], error: null }),
  },
}));
vi.mock("@/lib/db/pages.repository", () => ({
  pagesRepository: { findActivePages: async () => ({ data: [], error: null }) },
}));

import Footer from "@/app/components/layout/Footer";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { ADMIN_BRANDING_PATHS, getAdminLogoUrl } from "@/lib/admin-branding";
import { buildTotpUri, generateTotpSecret } from "@/lib/auth/native/totp";
import { renderBankTransferPaymentEmail } from "@/app/lib/mail/templates/BankTransferPaymentEmail";
import { renderPaymentConfirmedEmail } from "@/app/lib/mail/templates/PaymentConfirmedEmail";
import { renderPaymentLinkEmail } from "@/app/lib/mail/templates/PaymentLinkEmail";
import { renderReservationApprovedEmail } from "@/app/lib/mail/templates/ReservationApprovedEmail";
import { renderReservationCancelledEmail } from "@/app/lib/mail/templates/ReservationCancelledEmail";
import { renderReservationRequestEmail } from "@/app/lib/mail/templates/ReservationRequestEmail";
import { renderTestEmail } from "@/app/lib/mail/templates/TestEmail";
import { renderWesternUnionPaymentEmail } from "@/app/lib/mail/templates/WesternUnionPaymentEmail";
import { emailLayout } from "@/app/lib/mail/templates/email-shell";

const BRAND = "Kalkan Digital";
const OLD = /maki ?dijital|maki ?digital|makidijital|MAKİ/i;
const read = (p: string) => readFileSync(p, "utf8");
const code = (p: string) => read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

beforeEach(() => {
  usePathnameMock.mockReturnValue("/");
  getSiteAssetVersionsMock.mockReset();
});
afterEach(() => cleanup());

/* ---------------- 1) Paylaşılan liste notu ---------------- */
describe("paylaşılan villa listesi notu", () => {
  it.each(["tr", "en", "de"] as const)("%s → Kalkan Digital", (l) => {
    const note = getDictionary(l).sharedList.footerNote;
    expect(note.startsWith(`${BRAND} — `)).toBe(true);
    expect(note).not.toMatch(OLD);
  });
  it("sayfa bu dictionary anahtarını render etmeye devam eder", () => {
    expect(read("app/components/shared-list/SharedListPageBody.tsx")).toContain("{dict.footerNote}");
  });
});

/* ---------------- 2) Footer geliştirici kredisi ---------------- */
type FP = ComponentProps<typeof Footer>;
const BASE: FP = {
  settings: null,
  locations: [],
  villaTypes: [],
  corporatePages: [],
  year: 2026,
  siteName: "VillaDirekt",
  phoneDigits: "",
};
const LOGO = "https://cdn.example.com/site-assets/branding/admin-logo.webp?ts=abc123";

describe("footer geliştirici kredisi", () => {
  it.each([
    ["tr", "/"],
    ["en", "/en"],
    ["de", "/de"],
  ] as const)("%s: link + aria-label + admin logo", (l, path) => {
    usePathnameMock.mockReturnValue(path);
    render(<Footer {...BASE} developerLogoUrl={LOGO} />);
    const label = `${getDictionary(l).footer.webDevelopment}: ${BRAND}`;
    const link = screen.getByRole("link", { name: label });
    expect(link.getAttribute("href")).toBe("https://kalkandigital.com");
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
    const img = screen.getByTestId("developer-credit-logo");
    expect(img.getAttribute("src")).toBe(LOGO);
    expect(img.getAttribute("alt")).toBe(BRAND);
    expect(img.className).toContain("h-7 w-7");
    expect(screen.queryByTestId("developer-credit-text")).toBeNull();
    expect(document.body.innerHTML).not.toMatch(/Developer-Credit|makidijital/);
  });

  it("logo yoksa metin fallback'i", () => {
    render(<Footer {...BASE} developerLogoUrl={null} />);
    expect(screen.getByTestId("developer-credit-text").textContent).toBe(BRAND);
    expect(screen.queryByTestId("developer-credit-logo")).toBeNull();
  });

  it("logo yüklenemezse (onError) metne düşer", () => {
    render(<Footer {...BASE} developerLogoUrl={LOGO} />);
    fireEvent.error(screen.getByTestId("developer-credit-logo"));
    expect(screen.getByTestId("developer-credit-text").textContent).toBe(BRAND);
  });

  it("FooterWrapper: Admin Logo R2'de varsa admin sidebar ile AYNI versiyonlu URL", async () => {
    const path = ADMIN_BRANDING_PATHS["admin-logo"];
    getSiteAssetVersionsMock.mockResolvedValue({ [path]: "e1f2" });
    const { default: FooterWrapper } = await import("@/app/components/layout/FooterWrapper");
    const el = await FooterWrapper();
    expect(getSiteAssetVersionsMock).toHaveBeenCalledWith([path]);
    expect(el.props.developerLogoUrl).toBe(getAdminLogoUrl("e1f2"));
    expect(el.props.developerLogoUrl).toBe("https://cdn.example.com/site-assets/branding/admin-logo.webp?ts=e1f2");
  });

  it("FooterWrapper: logo yok / R2 hatası → null (metin fallback)", async () => {
    const { default: FooterWrapper } = await import("@/app/components/layout/FooterWrapper");
    getSiteAssetVersionsMock.mockResolvedValue({});
    expect((await FooterWrapper()).props.developerLogoUrl).toBeNull();
    getSiteAssetVersionsMock.mockRejectedValue(new Error("r2 down"));
    expect((await FooterWrapper()).props.developerLogoUrl).toBeNull();
  });

  it("logo değişince URL değişir (ETag versiyonu → cache-bust)", () => {
    expect(getAdminLogoUrl("v1")).not.toBe(getAdminLogoUrl("v2"));
    expect(getAdminLogoUrl("v2")).toContain("branding/admin-logo.webp");
  });
});

/* ---------------- 3) Admin başlık / sidebar / login ---------------- */
describe("admin görünür marka metinleri", () => {
  it("sekme başlığı (generateMetadata)", async () => {
    getSiteAssetVersionsMock.mockResolvedValue({});
    const { generateMetadata } = await import("@/app/(admin)/layout");
    const meta = await generateMetadata();
    expect(meta.title).toEqual({ absolute: `${BRAND} — Yönetim Paneli` });
  });
  it("sidebar adı + logo fallback rozeti 'K'", () => {
    const c = code("app/(admin)/maki-admin/layout.tsx");
    expect(c).toContain(`<span className="admin-brand-name block">${BRAND}</span>`);
    expect(c).toContain('return <span className="admin-brand-mark">K</span>;');
    expect(c).not.toMatch(OLD);
  });
  it("giriş ekranı (desktop + mobil) ve placeholder", () => {
    const c = code("app/(admin)/maki-admin/login/page.tsx");
    expect(c.match(/Kalkan Digital/g)?.length).toBe(4);
    expect(c).toContain('placeholder="ornek@kalkandigital.com"');
    expect(c).not.toMatch(OLD);
    expect(c).not.toContain("@maki.com");
  });
  it("ayar örnekleri eski markayı göstermez", () => {
    for (const p of [
      "app/(admin)/maki-admin/settings/entegrasyonlar/page.tsx",
      "app/(admin)/maki-admin/settings/genel/page.tsx",
      "app/(admin)/maki-admin/settings/odeme/page.tsx",
    ]) expect(code(p), p).not.toMatch(OLD);
  });
});

/* ---------------- 4) 9 e-posta şablonu + voucher ---------------- */
const P = {
  villaTitle: "Villa Test",
  reservationNo: "VD-1",
  startDate: "1 Tem 2026",
  endDate: "8 Tem 2026",
  nights: 7,
  guestsTotal: 4,
  guestName: "Ayşe",
  createdAtDisplay: "1 Haz 2026",
  totalDisplay: "₺10.000",
  paidDisplay: "₺2.000",
  remainingDisplay: "₺8.000",
  paymentPreferenceLabel: "Ön Ödeme",
  isFullPayment: false,
  payNowDisplay: "₺2.000",
  paymentLink: "https://pay.example.com/x",
  recipient: "a@b.com",
  bankAccount: {
    bankName: "Banka", accountHolder: "Hesap Sahibi", ibanFormatted: "TR00 0000",
    branchName: null, branchCode: null, swiftCode: null, currency: "TRY", referenceCode: "VD-1",
  },
  westernUnion: {
    recipientName: "Alıcı", country: null, city: null, phone: null, instructions: null, referenceCode: "VD-1",
  },
} as never;

const TEMPLATES: Array<[string, (p: never) => { subject: string; html: string }]> = [
  ["BankTransferPayment", renderBankTransferPaymentEmail as never],
  ["PaymentConfirmed", renderPaymentConfirmedEmail as never],
  ["PaymentLink", renderPaymentLinkEmail as never],
  ["ReservationApproved", renderReservationApprovedEmail as never],
  ["ReservationCancelled", renderReservationCancelledEmail as never],
  ["ReservationRequest", renderReservationRequestEmail as never],
  ["Test", renderTestEmail as never],
  ["WesternUnionPayment", renderWesternUnionPaymentEmail as never],
];

describe("e-posta şablonları — varsayılan marka", () => {
  it.each(TEMPLATES)("%s: brandName yoksa Kalkan Digital (subject + footer ©)", (_n, fn) => {
    const out = fn(P);
    expect(out.subject.startsWith(`${BRAND} · `)).toBe(true);
    expect(out.html).toContain(`© ${new Date().getFullYear()} ${BRAND}`);
    expect(out.subject + out.html).not.toMatch(OLD);
  });
  it.each(TEMPLATES)("%s: ayarlı gönderici adı (brandName) aynen kullanılır", (_n, fn) => {
    const out = fn({ ...(P as object), brandName: "VillaDirekt" } as never);
    expect(out.subject.startsWith("VillaDirekt · ")).toBe(true);
    expect(out.html).not.toContain(BRAND);
  });
  it("email-shell (9.) varsayılanı", () => {
    const html = emailLayout({ title: "t", body: "<p>x</p>" } as never);
    expect(html).toContain(`© ${new Date().getFullYear()} ${BRAND}`);
    expect(html).not.toMatch(OLD);
  });
  it("mail client + 8 route + voucher fallback'leri", () => {
    expect(code("app/lib/mail/client.ts")).toContain(`envName || dbName || "${BRAND}"`);
    for (const r of ["bank-transfer-payment", "payment-confirmed", "payment-link", "reservation-approved",
      "reservation-cancelled", "reservation-request", "test", "western-union-payment"]) {
      const c = code(`app/api/mail/${r}/route.ts`);
      expect(c, r).toContain(`cfg.fromName || "${BRAND}"`);
      expect(c, r).not.toMatch(OLD);
    }
    expect(code("app/lib/voucher/data.ts")).toContain(`cfg.fromName || "${BRAND}"`);
  });
});

/* ---------------- 5) 2FA ---------------- */
describe("2FA issuer", () => {
  it("yeni kayıtlarda varsayılan Kalkan Digital; verilen issuer aynen", () => {
    const secret = generateTotpSecret();
    expect(buildTotpUri({ secret, accountEmail: "x@y.com" })).toContain(encodeURIComponent(BRAND));
    expect(buildTotpUri({ secret, accountEmail: "x@y.com", issuer: "Özel" })).toContain(encodeURIComponent("Özel"));
  });
});

/* ---------------- 6) Teknik tanımlayıcılar korunur ---------------- */
describe("teknik tanımlayıcılar DEĞİŞMEDİ", () => {
  it("/maki-admin, maki_favorites, maki-finans", () => {
    expect(code("middleware.ts")).toContain('const LOGIN_PATH = "/maki-admin/login";');
    expect(code("hooks/use-favorites.ts")).toContain('const STORAGE_KEY = "maki_favorites";');
    expect(code("lib/auth/admin-permission-map.ts")).toContain('"/maki-admin/maki-finans"');
  });
});
