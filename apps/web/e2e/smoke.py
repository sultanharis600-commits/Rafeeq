"""
UI smoke test for the provider dashboard and admin panel.

Needs the API (with fresh sample data: `npm run seed`) on :3000 and the web app on :3001.
    pip install playwright && playwright install chromium
    python apps/web/e2e/smoke.py [--shots out_dir]

Walks the demo-script steps that happen on the web: the transport provider accepts a
booking and assigns a driver, the dates shop packs and delivers an order, and admin
approves the pending provider, generates bag tags and checks the outbox. Every page is
opened in Arabic (right-to-left) and English.
"""
import re
import sys
from pathlib import Path

from playwright.sync_api import Page, expect, sync_playwright

BASE = "http://localhost:3001"
SHOTS = Path(sys.argv[sys.argv.index("--shots") + 1]) if "--shots" in sys.argv else None


def shot(page: Page, name: str):
    if SHOTS:
        SHOTS.mkdir(parents=True, exist_ok=True)
        page.screenshot(path=str(SHOTS / f"{name}.png"), full_page=True)


def login(page: Page, phone: str, locale: str = "ar"):
    page.context.clear_cookies()
    page.goto(f"{BASE}/{locale}/login")
    page.fill("input[name=phone]", phone)
    page.click("button[type=submit]")
    page.wait_for_selector("input[name=code]")
    page.fill("input[name=code]", "123456")
    page.click("button[type=submit]")
    page.wait_for_url(re.compile(r"/(provider|admin)"))


def no_errors(page: Page):
    expect(page.locator("text=حدث خطأ أثناء تحميل الصفحة")).to_have_count(0)
    expect(page.locator("text=Something went wrong loading this page")).to_have_count(0)


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 1280, "height": 900})
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))

        # ── Transport provider (Arabic, RTL) ──
        login(page, "+966500000010", "ar")
        assert page.locator("html").get_attribute("dir") == "rtl"
        expect(page.get_by_role("heading", name="نظرة عامة")).to_be_visible()
        shot(page, "provider-overview-ar")
        for path in ["bookings", "services", "bags", "staff", "earnings", "reviews", "profile", "apply"]:
            page.goto(f"{BASE}/ar/provider/{path}")
            no_errors(page)
        shot(page, "provider-apply-ar")

        # Accept the paid Urdu-guide booking? It's Sample Guides; transport has b14 (shuttle, paid).
        page.goto(f"{BASE}/en/provider/bookings?status=paid")
        assert page.locator("html").get_attribute("dir") == "ltr"
        page.get_by_role("link", name=re.compile("Hotel to Haram shuttle")).first.click()
        page.wait_for_url(re.compile(r"/provider/bookings/"))
        shot(page, "provider-booking-paid-en")
        page.get_by_role("button", name="Accept").click()
        expect(page.get_by_text("Assign staff")).to_be_visible()
        page.select_option("select[name=staffId]", index=1)
        page.get_by_role("button", name="Assign").click()
        expect(page.get_by_role("heading", name="Assigned to")).to_be_visible()
        expect(page.locator("p.font-medium", has_text="Khalid")).to_be_visible()
        shot(page, "provider-booking-assigned-en")

        # Services: open one and add slots
        page.goto(f"{BASE}/en/provider/services")
        page.get_by_role("link", name=re.compile("Makkah to Madinah private car")).click()
        page.check("input[name=hours][value='9']")
        page.get_by_role("button", name="Create slots").click()
        expect(page.get_by_text("Slots added")).to_be_visible()
        shot(page, "provider-service-en")

        # ── Dates shop: pack and deliver a paid order ──
        login(page, "+966500000018", "en")
        page.goto(f"{BASE}/en/provider/orders?status=paid")
        page.locator("table a").first.click()
        page.wait_for_url(re.compile(r"/provider/orders/"))
        page.get_by_role("button", name="Mark packed").click()
        expect(page.get_by_role("button", name=re.compile("Out for delivery|Mark shipped"))).to_be_visible()
        shot(page, "shop-order-en")
        page.goto(f"{BASE}/en/provider/products")
        no_errors(page)
        shot(page, "shop-products-en")

        # ── A new business applies with a document ──
        pdf = Path("/tmp") / "rafeeq-cr.pdf"
        pdf.write_bytes(b"%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n")
        login(page, "+966555123456", "en")
        page.goto(f"{BASE}/en/provider/apply")
        page.fill("input[name='name.en']", "Smoke Test Tours")
        page.fill("input[name=crNumber]", "4030123456")
        page.fill("input[name=iban]", "SA0380000000608010167519")
        page.set_input_files("input[name=idDocument]", str(pdf))
        page.get_by_role("button", name="Send for verification").click()
        expect(page.get_by_text("Sent. Bidec will review")).to_be_visible()
        page.goto(f"{BASE}/en/provider")
        expect(page.get_by_text("Bidec is checking your documents")).to_be_visible()

        # ── Admin (operations) ──
        login(page, "+966500000001", "ar")
        expect(page.get_by_role("heading", name="نظرة عامة")).to_be_visible()
        shot(page, "admin-overview-ar")
        page.goto(f"{BASE}/en/admin/providers?status=pending")
        expect(page.get_by_text("Smoke Test Tours")).to_be_visible()
        href = page.get_by_role("link", name="Open document").first.get_attribute("href")
        doc = page.request.get(f"{BASE}{href}")
        assert doc.status == 200 and doc.headers["content-type"] == "application/pdf", doc.status
        assert doc.body().startswith(b"%PDF")
        page.goto(f"{BASE}/ar/admin/providers?status=pending")
        expect(page.get_by_text("مرشد المدينة التجريبي")).to_be_visible()
        page.locator("section", has_text="مرشد المدينة التجريبي").get_by_role("button", name="اعتماد").click()
        page.wait_for_timeout(800)
        page.goto(f"{BASE}/ar/admin/providers?status=approved")
        expect(page.get_by_text("مرشد المدينة التجريبي")).to_be_visible()

        page.goto(f"{BASE}/en/admin/bags")
        page.get_by_role("button", name="Generate").click()
        expect(page.get_by_text("Tags created")).to_be_visible()
        page.goto(f"{BASE}/en/admin/bags/tags")
        expect(page.locator("svg").first).to_be_visible()
        shot(page, "admin-tags-en")

        for path in ["", "bookings", "orders", "payments", "payouts", "alerts", "places", "content", "outbox", "audit", "users"]:
            page.goto(f"{BASE}/en/admin/{path}")
            no_errors(page)
        page.goto(f"{BASE}/en/admin/outbox?channel=sms")
        shot(page, "admin-outbox-en")
        page.goto(f"{BASE}/en/admin/audit")
        expect(page.get_by_text("provider.approved")).to_be_visible()

        # Lost alert location needs a reason
        page.goto(f"{BASE}/en/admin/alerts")
        page.fill("input[name=reason]", "Family asked at the support desk")
        page.get_by_role("button", name="Show location").first.click()
        expect(page.get_by_text("Usman Ali")).to_be_visible()

        # Finance runs reconciliation
        login(page, "+966500000002", "en")
        page.goto(f"{BASE}/en/admin/payouts")
        page.get_by_role("button", name="Run now").click()
        expect(page.get_by_text("Everything matches.")).to_be_visible()
        shot(page, "admin-payouts-en")

        # A pilgrim can't use the admin panel
        login_page = page
        login_page.context.clear_cookies()
        page.goto(f"{BASE}/en/admin")
        page.wait_for_url(re.compile(r"/login"))

        browser.close()
        if errors:
            print("Browser errors:\n" + "\n".join(errors))
            sys.exit(1)
        print("web smoke test passed")


if __name__ == "__main__":
    main()
