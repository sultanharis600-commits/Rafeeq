"""
Source of truth for the app's text in the six launch languages. Run it to regenerate
lib/l10n/app_<lang>.arb:

    python3 tool/strings.py

Order of each entry: en, ar, ur, id, ms, tr. Placeholders use {name}. English may use ICU
plurals. Everything except English is a draft: a native speaker approves each language
before launch (AI_RULES.md). The tool fails if a key is missing a language.
"""
import json
import os
import re
import sys

LANGS = ["en", "ar", "ur", "id", "ms", "tr"]

# Placeholder types for parameterised messages (everything else is a String).
INT_PARAMS = {"count", "metres", "minutes", "degrees", "km"}

S = {
    # ── App ──
    "appName": ("Rafeeq", "رفيق", "رفیق", "Rafeeq", "Rafeeq", "Rafeeq"),
    "welcome": ("Your companion for Umrah and Hajj", "رفيقك في العمرة والحج", "عمرہ اور حج میں آپ کا ساتھی", "Teman perjalanan umrah dan haji Anda", "Teman anda untuk umrah dan haji", "Umre ve hacda yol arkadaşınız"),
    "languageName": ("English", "العربية", "اردو", "Bahasa Indonesia", "Bahasa Melayu", "Türkçe"),
    "chooseLanguage": ("Choose your language", "اختر لغتك", "اپنی زبان منتخب کریں", "Pilih bahasa Anda", "Pilih bahasa anda", "Dilinizi seçin"),
    "continueButton": ("Continue", "متابعة", "جاری رکھیں", "Lanjutkan", "Teruskan", "Devam"),
    "demoShort": ("DEMO", "تجريبي", "ڈیمو", "DEMO", "DEMO", "DEMO"),
    "language": ("Language", "اللغة", "زبان", "Bahasa", "Bahasa", "Dil"),
    "languages": ("Languages", "اللغات", "زبانیں", "Bahasa", "Bahasa", "Diller"),

    # ── Tabs ──
    "tabHome": ("Home", "الرئيسية", "ہوم", "Beranda", "Utama", "Ana sayfa"),
    "tabBookings": ("Bookings", "الحجوزات", "بکنگز", "Pesanan", "Tempahan", "Rezervasyonlar"),
    "tabShop": ("Shop", "المتجر", "دکان", "Toko", "Kedai", "Mağaza"),
    "tabGuide": ("Guide", "الدليل", "رہنما", "Panduan", "Panduan", "Rehber"),
    "tabProfile": ("Profile", "حسابي", "پروفائل", "Profil", "Profil", "Profil"),

    # ── Login and setup ──
    "login": ("Log in", "تسجيل الدخول", "لاگ ان", "Masuk", "Log masuk", "Giriş"),
    "loginIntro": ("Enter your phone number. We will send you a code.", "أدخل رقم جوالك وسنرسل لك رمزاً.", "اپنا فون نمبر درج کریں۔ ہم آپ کو کوڈ بھیجیں گے۔", "Masukkan nomor ponsel Anda. Kami akan mengirim kode.", "Masukkan nombor telefon anda. Kami akan menghantar kod.", "Telefon numaranızı girin. Size bir kod göndereceğiz."),
    "phone": ("Phone number", "رقم الجوال", "فون نمبر", "Nomor ponsel", "Nombor telefon", "Telefon numarası"),
    "phoneHint": ("With country code, e.g. +62 812…", "مع رمز الدولة، مثل ‎+966 5…", "ملک کے کوڈ کے ساتھ، مثلاً ‎+92 3…", "Dengan kode negara, mis. +62 812…", "Dengan kod negara, cth. +60 12…", "Ülke koduyla, ör. +90 5…"),
    "phoneWithCountry": ("Phone (with country code)", "الجوال (مع رمز الدولة)", "فون (ملک کے کوڈ کے ساتھ)", "Ponsel (dengan kode negara)", "Telefon (dengan kod negara)", "Telefon (ülke koduyla)"),
    "sendCode": ("Send code", "إرسال الرمز", "کوڈ بھیجیں", "Kirim kode", "Hantar kod", "Kodu gönder"),
    "code": ("Code", "الرمز", "کوڈ", "Kode", "Kod", "Kod"),
    "phoneOrEmail": ("Phone number or email", "رقم الجوال أو البريد الإلكتروني", "فون نمبر یا ای میل", "Nomor ponsel atau email", "Nombor telefon atau e-mel", "Telefon numarası veya e-posta"),
    "quickLoginIntro": ("Testing mode: enter a phone number or email to log in. No code needed.", "وضع الاختبار: أدخل رقم الجوال أو البريد الإلكتروني للدخول. لا حاجة لرمز.", "ٹیسٹنگ موڈ: لاگ ان کے لیے فون نمبر یا ای میل درج کریں۔ کوڈ کی ضرورت نہیں۔", "Mode uji coba: masukkan nomor ponsel atau email untuk masuk. Tanpa kode.", "Mod ujian: masukkan nombor telefon atau e-mel untuk log masuk. Tiada kod diperlukan.", "Test modu: giriş için telefon numarası veya e-posta girin. Kod gerekmez."),
    "errEmail": ("Enter a valid email address", "أدخل بريداً إلكترونياً صحيحاً", "درست ای میل درج کریں", "Masukkan email yang valid", "Masukkan e-mel yang sah", "Geçerli bir e-posta girin"),
    "changeNumber": ("Change number", "تغيير الرقم", "نمبر تبدیل کریں", "Ganti nomor", "Tukar nombor", "Numarayı değiştir"),
    "demoCode": ("Demo code: {code}", "رمز تجريبي: {code}", "ڈیمو کوڈ: {code}", "Kode demo: {code}", "Kod demo: {code}", "Demo kodu: {code}"),
    "yourName": ("Your name", "اسمك", "آپ کا نام", "Nama Anda", "Nama anda", "Adınız"),
    "yourNameHint": ("As your group and providers will see it", "كما ستراه مجموعتك ومقدمو الخدمة", "جیسا آپ کا گروپ اور فراہم کنندگان دیکھیں گے", "Seperti yang akan dilihat rombongan dan penyedia", "Seperti yang akan dilihat kumpulan dan penyedia", "Grubunuzun ve hizmet verenlerin göreceği şekilde"),
    "setupTitle": ("Your trip", "رحلتك", "آپ کا سفر", "Perjalanan Anda", "Perjalanan anda", "Seyahatiniz"),
    "setupIntro": ("Tell us where you are staying so we can show services near you.", "أخبرنا أين تقيم لنعرض لك الخدمات القريبة منك.", "بتائیں آپ کہاں ٹھہرے ہیں تاکہ ہم قریبی خدمات دکھا سکیں۔", "Beri tahu di mana Anda menginap agar kami tampilkan layanan terdekat.", "Beritahu di mana anda menginap supaya kami tunjukkan perkhidmatan berdekatan.", "Yakınınızdaki hizmetleri gösterebilmemiz için nerede kaldığınızı söyleyin."),
    "makkah": ("Makkah", "مكة المكرمة", "مکہ مکرمہ", "Makkah", "Makkah", "Mekke"),
    "madinah": ("Madinah", "المدينة المنورة", "مدینہ منورہ", "Madinah", "Madinah", "Medine"),
    "yourHotel": ("Your hotel", "فندقك", "آپ کا ہوٹل", "Hotel Anda", "Hotel anda", "Oteliniz"),
    "travelDates": ("Travel dates", "تواريخ السفر", "سفر کی تاریخیں", "Tanggal perjalanan", "Tarikh perjalanan", "Seyahat tarihleri"),
    "setHotelFirst": ("Choose your hotel in Profile first", "اختر فندقك من حسابي أولاً", "پہلے پروفائل میں اپنا ہوٹل منتخب کریں", "Pilih hotel Anda di Profil dulu", "Pilih hotel anda di Profil dahulu", "Önce Profil'de otelinizi seçin"),
    "accessibilityMode": ("Accessibility mode", "وضع سهولة الاستخدام", "آسان رسائی موڈ", "Mode aksesibilitas", "Mod kebolehcapaian", "Erişilebilirlik modu"),
    "accessibilityModeHint": ("Bigger text and buttons, fewer items, voice guidance", "نص وأزرار أكبر، عناصر أقل، وإرشاد صوتي", "بڑا متن اور بٹن، کم چیزیں، آواز سے رہنمائی", "Teks dan tombol lebih besar, lebih sedikit item, panduan suara", "Teks dan butang lebih besar, kurang item, panduan suara", "Daha büyük yazı ve düğmeler, daha az öğe, sesli rehberlik"),

    # ── Home and search ──
    "helloName": ("Hello, {name}", "مرحباً، {name}", "السلام علیکم، {name}", "Halo, {name}", "Hai, {name}", "Merhaba, {name}"),
    "searchHint": ("Search transport, guides, bags…", "ابحث عن نقل، مرشدين، أمتعة…", "ٹرانسپورٹ، گائیڈ، سامان تلاش کریں…", "Cari transportasi, pembimbing, bagasi…", "Cari pengangkutan, pemandu, bagasi…", "Ulaşım, rehber, bagaj ara…"),
    "searchResults": ("Results for “{query}”", "نتائج «{query}»", "“{query}” کے نتائج", "Hasil untuk “{query}”", "Hasil untuk “{query}”", "“{query}” için sonuçlar"),
    "services": ("Services", "الخدمات", "خدمات", "Layanan", "Perkhidmatan", "Hizmetler"),
    "offers": ("Offers", "العروض", "پیشکشیں", "Penawaran", "Tawaran", "Fırsatlar"),
    "nextBooking": ("Next booking", "الحجز القادم", "اگلی بکنگ", "Pesanan berikutnya", "Tempahan seterusnya", "Sıradaki rezervasyon"),
    "nothingFound": ("Nothing found", "لا توجد نتائج", "کچھ نہیں ملا", "Tidak ada hasil", "Tiada hasil", "Sonuç bulunamadı"),
    "speaksMyLanguage": ("Speaks my language", "يتحدث لغتي", "میری زبان بولتا ہو", "Berbicara bahasa saya", "Bertutur bahasa saya", "Benim dilimi konuşan"),
    "imLost": ("I'm lost", "أنا تائه", "میں گم ہو گیا ہوں", "Saya tersesat", "Saya sesat", "Kayboldum"),

    # ── Categories, sections ──
    "catTransport": ("Transport", "النقل", "ٹرانسپورٹ", "Transportasi", "Pengangkutan", "Ulaşım"),
    "catGuides": ("Guides", "المرشدون", "گائیڈ", "Pembimbing", "Pemandu", "Rehberler"),
    "catPhotography": ("Photography", "التصوير", "فوٹوگرافی", "Fotografi", "Fotografi", "Fotoğraf"),
    "catLuggage": ("Luggage", "الأمتعة", "سامان", "Bagasi", "Bagasi", "Bagaj"),
    "catAccessibility": ("Accessibility help", "مساعدة كبار السن وذوي الإعاقة", "معذور اور بزرگ افراد کی مدد", "Bantuan lansia dan difabel", "Bantuan warga emas dan OKU", "Yaşlı ve engelli yardımı"),
    "catHeritage": ("Heritage tours", "جولات تراثية", "تاریخی دورے", "Tur sejarah", "Lawatan warisan", "Tarihi turlar"),
    "secMakkah": ("Makkah gifts", "هدايا مكة", "مکہ کے تحفے", "Oleh-oleh Makkah", "Cenderamata Makkah", "Mekke hediyeleri"),
    "secMadinah": ("Madinah gifts", "هدايا المدينة", "مدینہ کے تحفے", "Oleh-oleh Madinah", "Cenderamata Madinah", "Medine hediyeleri"),
    "secDates": ("Dates", "التمور", "کھجوریں", "Kurma", "Kurma", "Hurma"),

    # ── Service and booking ──
    "verified": ("Verified", "موثّق", "تصدیق شدہ", "Terverifikasi", "Disahkan", "Doğrulanmış"),
    "provider": ("Provider", "مقدم الخدمة", "فراہم کنندہ", "Penyedia", "Penyedia", "Hizmet veren"),
    "duration": ("Duration", "المدة", "دورانیہ", "Durasi", "Tempoh", "Süre"),
    "minutes": ("{count, plural, =1{1 minute} other{{count} minutes}}", "{count} دقيقة", "{count} منٹ", "{count} menit", "{count} minit", "{count} dakika"),
    "days": ("{count, plural, =1{1 day} other{{count} days}}", "{count} يوم", "{count} دن", "{count} hari", "{count} hari", "{count} gün"),
    "cancellation": ("Cancellation", "الإلغاء", "منسوخی", "Pembatalan", "Pembatalan", "İptal"),
    "policyFlexible": ("Free cancellation until 24 hours before", "إلغاء مجاني حتى 24 ساعة قبل الموعد", "24 گھنٹے پہلے تک مفت منسوخی", "Batal gratis hingga 24 jam sebelumnya", "Pembatalan percuma sehingga 24 jam sebelum", "24 saat öncesine kadar ücretsiz iptal"),
    "policyModerate": ("Full refund until 48 hours before, then half", "استرداد كامل حتى 48 ساعة قبل، ثم النصف", "48 گھنٹے پہلے تک مکمل واپسی، پھر آدھی", "Uang kembali penuh hingga 48 jam sebelumnya, lalu setengah", "Bayaran balik penuh sehingga 48 jam sebelum, kemudian separuh", "48 saat öncesine kadar tam iade, sonra yarısı"),
    "policyStrict": ("Half refund until 7 days before, then none", "استرداد النصف حتى 7 أيام قبل، ثم لا استرداد", "7 دن پہلے تک آدھی واپسی، پھر کوئی نہیں", "Setengah uang kembali hingga 7 hari sebelumnya, setelah itu tidak ada", "Separuh bayaran balik sehingga 7 hari sebelum, kemudian tiada", "7 gün öncesine kadar yarı iade, sonra iade yok"),
    "reviews": ("Reviews", "التقييمات", "تبصرے", "Ulasan", "Ulasan", "Yorumlar"),
    "reviewsCount": ("{count, plural, =1{1 review} other{{count} reviews}}", "{count} تقييم", "{count} تبصرے", "{count} ulasan", "{count} ulasan", "{count} yorum"),
    "stars": ("{count, plural, =1{1 star} other{{count} stars}}", "{count} نجوم", "{count} ستارے", "{count} bintang", "{count} bintang", "{count} yıldız"),
    "chooseTime": ("Choose a time", "اختر الموعد", "وقت منتخب کریں", "Pilih waktu", "Pilih masa", "Saat seçin"),
    "noSlots": ("No free times in the next 7 days", "لا توجد مواعيد متاحة خلال 7 أيام", "اگلے 7 دنوں میں کوئی وقت خالی نہیں", "Tidak ada waktu kosong dalam 7 hari ke depan", "Tiada masa kosong dalam 7 hari akan datang", "Önümüzdeki 7 günde boş saat yok"),
    "nextFree": ("Next free: {time}", "أقرب موعد: {time}", "اگلا خالی وقت: {time}", "Kosong berikutnya: {time}", "Kosong seterusnya: {time}", "İlk boş: {time}"),
    "when": ("When", "الموعد", "کب", "Kapan", "Bila", "Ne zaman"),
    "quantity": ("Quantity", "الكمية", "تعداد", "Jumlah", "Kuantiti", "Adet"),
    "howManyBags": ("How many bags?", "كم حقيبة؟", "کتنے بیگ؟", "Berapa koper?", "Berapa beg?", "Kaç bavul?"),
    "howManyHours": ("How many hours?", "كم ساعة؟", "کتنے گھنٹے؟", "Berapa jam?", "Berapa jam?", "Kaç saat?"),
    "howManyPeople": ("How many people?", "كم شخصاً؟", "کتنے افراد؟", "Berapa orang?", "Berapa orang?", "Kaç kişi?"),
    "howManyTags": ("How many tags?", "كم جهازاً؟", "کتنے ٹیگ؟", "Berapa tag?", "Berapa tag?", "Kaç etiket?"),
    "more": ("More", "زيادة", "زیادہ", "Tambah", "Tambah", "Artır"),
    "less": ("Less", "إنقاص", "کم", "Kurangi", "Kurangkan", "Azalt"),
    "extras": ("Extras", "إضافات", "اضافی", "Tambahan", "Tambahan", "Ekstralar"),
    "meetingPoint": ("Meeting point", "نقطة اللقاء", "ملاقات کی جگہ", "Titik temu", "Tempat bertemu", "Buluşma noktası"),
    "meetingPointHint": ("e.g. hotel lobby, main entrance", "مثل: بهو الفندق، المدخل الرئيسي", "مثلاً ہوٹل لابی، مرکزی دروازہ", "mis. lobi hotel, pintu utama", "cth. lobi hotel, pintu utama", "ör. otel lobisi, ana giriş"),
    "notesForProvider": ("Notes for the provider", "ملاحظات لمقدم الخدمة", "فراہم کنندہ کے لیے نوٹ", "Catatan untuk penyedia", "Nota untuk penyedia", "Hizmet veren için not"),
    "needsShared": ("Your accessibility needs are shared with the provider for this booking.", "تُشارك احتياجاتك مع مقدم الخدمة لهذا الحجز.", "اس بکنگ کے لیے آپ کی ضروریات فراہم کنندہ کو بتائی جائیں گی۔", "Kebutuhan aksesibilitas Anda dibagikan ke penyedia untuk pesanan ini.", "Keperluan kebolehcapaian anda dikongsi dengan penyedia untuk tempahan ini.", "Erişilebilirlik ihtiyaçlarınız bu rezervasyon için hizmet verenle paylaşılır."),
    "continueToPay": ("Continue to payment", "المتابعة للدفع", "ادائیگی کی طرف بڑھیں", "Lanjut ke pembayaran", "Teruskan ke pembayaran", "Ödemeye geç"),
    "refundPolicyShown": ("Full price, refund policy and provider are shown before you pay.", "يظهر السعر الكامل وسياسة الاسترداد ومقدم الخدمة قبل الدفع.", "ادائیگی سے پہلے پوری قیمت، واپسی کی پالیسی اور فراہم کنندہ دکھائے جاتے ہیں۔", "Harga penuh, kebijakan pengembalian dan penyedia ditampilkan sebelum membayar.", "Harga penuh, polisi bayaran balik dan penyedia ditunjukkan sebelum bayar.", "Ödemeden önce tam fiyat, iade koşulları ve hizmet veren gösterilir."),
    "perTrip": ("per trip", "للرحلة", "فی سفر", "per perjalanan", "setiap perjalanan", "sefer başına"),
    "perHour": ("per hour", "للساعة", "فی گھنٹہ", "per jam", "sejam", "saat başına"),
    "perPerson": ("per person", "للشخص", "فی شخص", "per orang", "seorang", "kişi başı"),
    "perBag": ("per bag", "للحقيبة", "فی بیگ", "per koper", "setiap beg", "bavul başına"),
    "perTag": ("per tag", "للجهاز", "فی ٹیگ", "per tag", "setiap tag", "etiket başına"),
    "perBooking": ("per booking", "للحجز", "فی بکنگ", "per pesanan", "setiap tempahan", "rezervasyon başına"),
    "zuyarahNote": ("Full heritage trips are in the Zuyarah app.", "الرحلات التراثية الكاملة في تطبيق زيارة.", "مکمل تاریخی سفر زیارہ ایپ میں ہیں۔", "Perjalanan sejarah lengkap ada di aplikasi Zuyarah.", "Perjalanan warisan penuh ada dalam aplikasi Zuyarah.", "Tam tarihi geziler Zuyarah uygulamasında."),

    # ── Checkout and payment ──
    "pay": ("Pay", "ادفع", "ادائیگی کریں", "Bayar", "Bayar", "Öde"),
    "payAmount": ("Pay {amount}", "ادفع {amount}", "{amount} ادا کریں", "Bayar {amount}", "Bayar {amount}", "{amount} öde"),
    "payWith": ("Pay with", "طريقة الدفع", "ادائیگی کا طریقہ", "Bayar dengan", "Bayar dengan", "Ödeme yöntemi"),
    "methodCard": ("Card", "بطاقة", "کارڈ", "Kartu", "Kad", "Kart"),
    "methodMada": ("mada", "مدى", "مدى", "mada", "mada", "mada"),
    "testCard": ("Test card number", "رقم البطاقة التجريبية", "ٹیسٹ کارڈ نمبر", "Nomor kartu uji", "Nombor kad ujian", "Test kart numarası"),
    "sandboxNote": ("Demo mode: no real money moves. Use test card 4111 1111 1111 1111 to pay, or 4000 0000 0000 0002 to see a declined payment.", "وضع تجريبي: لا تُنقل أموال حقيقية. استخدم البطاقة 4111 1111 1111 1111 للدفع، أو 4000 0000 0000 0002 لرؤية رفض الدفع.", "ڈیمو موڈ: اصل رقم منتقل نہیں ہوتی۔ ادائیگی کے لیے کارڈ 4111 1111 1111 1111 یا رد ہونے کے لیے 4000 0000 0000 0002 استعمال کریں۔", "Mode demo: tidak ada uang sungguhan. Pakai kartu uji 4111 1111 1111 1111 untuk membayar, atau 4000 0000 0000 0002 untuk melihat pembayaran ditolak.", "Mod demo: tiada wang sebenar. Guna kad ujian 4111 1111 1111 1111 untuk bayar, atau 4000 0000 0000 0002 untuk melihat bayaran ditolak.", "Demo modu: gerçek para hareket etmez. Ödemek için 4111 1111 1111 1111, reddedilen ödeme için 4000 0000 0000 0002 test kartını kullanın."),
    "holdLeft": ("Your time is held for {time}", "موعدك محجوز لمدة {time}", "آپ کا وقت {time} کے لیے محفوظ ہے", "Waktu Anda ditahan selama {time}", "Masa anda ditahan selama {time}", "Saatiniz {time} boyunca ayrıldı"),
    "holdExpired": ("The hold has expired. Choose a time again.", "انتهت مدة الحجز المؤقت. اختر الموعد مجدداً.", "وقت کی میعاد ختم ہو گئی۔ دوبارہ وقت منتخب کریں۔", "Waktu tahan habis. Pilih waktu lagi.", "Tempoh tahan tamat. Pilih masa semula.", "Ayırma süresi doldu. Saati yeniden seçin."),
    "paymentDeclined": ("Payment declined. Try another card.", "رُفض الدفع. جرّب بطاقة أخرى.", "ادائیگی رد ہو گئی۔ دوسرا کارڈ آزمائیں۔", "Pembayaran ditolak. Coba kartu lain.", "Bayaran ditolak. Cuba kad lain.", "Ödeme reddedildi. Başka bir kart deneyin."),
    "paid": ("Paid", "مدفوع", "ادا شدہ", "Dibayar", "Dibayar", "Ödendi"),
    "vatIncluded": ("Prices include 15% VAT.", "الأسعار شاملة ضريبة القيمة المضافة 15٪.", "قیمتوں میں 15٪ VAT شامل ہے۔", "Harga sudah termasuk PPN 15%.", "Harga termasuk VAT 15%.", "Fiyatlara %15 KDV dahildir."),
    "total": ("Total", "الإجمالي", "کل", "Total", "Jumlah", "Toplam"),
    "subtotal": ("Subtotal", "المجموع الفرعي", "ذیلی کل", "Subtotal", "Subjumlah", "Ara toplam"),
    "invoice": ("Invoice", "الفاتورة", "انوائس", "Faktur", "Invois", "Fatura"),

    # ── Bookings ──
    "booking": ("Booking", "الحجز", "بکنگ", "Pesanan", "Tempahan", "Rezervasyon"),
    "upcoming": ("Upcoming", "القادمة", "آنے والی", "Mendatang", "Akan datang", "Yaklaşan"),
    "past": ("Past", "السابقة", "گزشتہ", "Selesai", "Lepas", "Geçmiş"),
    "orders": ("Orders", "الطلبات", "آرڈرز", "Belanja", "Pesanan", "Siparişler"),
    "noBookings": ("No bookings yet", "لا توجد حجوزات بعد", "ابھی کوئی بکنگ نہیں", "Belum ada pesanan", "Belum ada tempahan", "Henüz rezervasyon yok"),
    "noOrders": ("No orders yet", "لا توجد طلبات بعد", "ابھی کوئی آرڈر نہیں", "Belum ada belanja", "Belum ada pesanan", "Henüz sipariş yok"),
    "history": ("History", "السجل", "تاریخچہ", "Riwayat", "Sejarah", "Geçmiş"),
    "waitingForProvider": ("Waiting for the provider to accept. If they don't answer in 30 minutes, you get a full refund or another provider.", "بانتظار قبول مقدم الخدمة. إن لم يرد خلال 30 دقيقة تحصل على استرداد كامل أو مقدم آخر.", "فراہم کنندہ کی منظوری کا انتظار ہے۔ اگر 30 منٹ میں جواب نہ آیا تو مکمل رقم واپس یا دوسرا فراہم کنندہ۔", "Menunggu penyedia menerima. Jika tidak dijawab dalam 30 menit, uang Anda kembali penuh atau dapat penyedia lain.", "Menunggu penyedia menerima. Jika tiada jawapan dalam 30 minit, anda dapat bayaran balik penuh atau penyedia lain.", "Hizmet verenin onayı bekleniyor. 30 dakikada yanıt gelmezse tam iade ya da başka bir hizmet veren."),
    "declinedRefunded": ("The provider couldn't take this booking. Your money has been refunded in full.", "لم يتمكن مقدم الخدمة من قبول الحجز. استُردت أموالك كاملة.", "فراہم کنندہ یہ بکنگ نہیں لے سکا۔ آپ کی پوری رقم واپس کر دی گئی۔", "Penyedia tidak bisa menerima pesanan ini. Uang Anda sudah dikembalikan penuh.", "Penyedia tidak dapat menerima tempahan ini. Wang anda telah dipulangkan sepenuhnya.", "Hizmet veren bu rezervasyonu alamadı. Ödemeniz tamamen iade edildi."),
    "tryThese": ("Similar services you can book instead:", "خدمات مشابهة يمكنك حجزها بدلاً منها:", "اس کی جگہ یہ ملتی جلتی خدمات بک کر سکتے ہیں:", "Layanan serupa yang bisa dipesan:", "Perkhidmatan serupa yang boleh ditempah:", "Bunun yerine ayırtabileceğiniz benzer hizmetler:"),
    "cancelBooking": ("Cancel booking", "إلغاء الحجز", "بکنگ منسوخ کریں", "Batalkan pesanan", "Batalkan tempahan", "Rezervasyonu iptal et"),
    "cancelRefund": ("You will get {amount} back.", "سيُعاد لك {amount}.", "آپ کو {amount} واپس ملیں گے۔", "Anda akan menerima kembali {amount}.", "Anda akan menerima balik {amount}.", "{amount} iade alacaksınız."),
    "cancelNoRefund": ("This cancellation is not refunded under the provider's policy.", "لا يُسترد هذا الإلغاء حسب سياسة مقدم الخدمة.", "فراہم کنندہ کی پالیسی کے تحت اس منسوخی پر رقم واپس نہیں ہوگی۔", "Pembatalan ini tidak dikembalikan sesuai kebijakan penyedia.", "Pembatalan ini tidak dibayar balik mengikut polisi penyedia.", "Hizmet verenin koşullarına göre bu iptal iade edilmez."),
    "keepBooking": ("Keep booking", "الإبقاء على الحجز", "بکنگ برقرار رکھیں", "Tetap pesan", "Kekalkan tempahan", "Rezervasyonu koru"),
    "reportProblem": ("Report a problem", "الإبلاغ عن مشكلة", "مسئلہ بتائیں", "Laporkan masalah", "Laporkan masalah", "Sorun bildir"),
    "whatHappened": ("What happened?", "ماذا حدث؟", "کیا ہوا؟", "Apa yang terjadi?", "Apa yang berlaku?", "Ne oldu?"),
    "problemSent": ("Sent. Bidec support will contact you.", "تم الإرسال. سيتواصل معك دعم بايدك.", "بھیج دیا گیا۔ بائیڈیک سپورٹ آپ سے رابطہ کرے گی۔", "Terkirim. Tim Bidec akan menghubungi Anda.", "Dihantar. Sokongan Bidec akan menghubungi anda.", "Gönderildi. Bidec destek ekibi sizinle iletişime geçecek."),
    "leaveReview": ("Leave a review", "أضف تقييماً", "تبصرہ لکھیں", "Beri ulasan", "Tinggalkan ulasan", "Yorum yap"),
    "reviewHint": ("What went well? What could be better?", "ما الذي كان جيداً؟ وما الذي يمكن تحسينه؟", "کیا اچھا رہا؟ کیا بہتر ہو سکتا تھا؟", "Apa yang baik? Apa yang bisa lebih baik?", "Apa yang baik? Apa yang boleh diperbaiki?", "Ne iyiydi? Ne daha iyi olabilirdi?"),
    "thanksReview": ("Thank you for your review", "شكراً لتقييمك", "آپ کے تبصرے کا شکریہ", "Terima kasih atas ulasan Anda", "Terima kasih atas ulasan anda", "Yorumunuz için teşekkürler"),
    "call": ("Call", "اتصال", "کال کریں", "Telepon", "Panggil", "Ara"),
    "callName": ("Call {name}", "اتصل بـ {name}", "{name} کو کال کریں", "Telepon {name}", "Panggil {name}", "{name} kişisini ara"),
    "yourBags": ("Bags", "الحقائب", "سامان", "Koper", "Beg", "Bavullar"),
    "bag": ("Bag", "الحقيبة", "بیگ", "Koper", "Beg", "Bavul"),
    "heldBy": ("held by {name}", "مع {name}", "{name} کے پاس", "dipegang {name}", "dipegang {name}", "{name} teslim aldı"),
    "nextHandoverBy": ("Next handover expected by {time}", "التسليم التالي متوقع قبل {time}", "اگلی حوالگی {time} تک متوقع ہے", "Serah terima berikutnya sebelum {time}", "Serahan seterusnya dijangka sebelum {time}", "Sonraki teslim {time} saatine kadar bekleniyor"),
    "bagCaseOpen": ("This bag missed a handover. The provider and Bidec support are looking for it and will contact you.", "فاتت هذه الحقيبة عملية تسليم. يبحث عنها مقدم الخدمة ودعم بايدك وسيتواصلون معك.", "یہ بیگ ایک حوالگی پر اسکین نہیں ہوا۔ فراہم کنندہ اور بائیڈیک سپورٹ اسے ڈھونڈ رہے ہیں اور آپ سے رابطہ کریں گے۔", "Koper ini melewatkan serah terima. Penyedia dan tim Bidec sedang mencarinya dan akan menghubungi Anda.", "Beg ini terlepas satu serahan. Penyedia dan sokongan Bidec sedang mencarinya dan akan menghubungi anda.", "Bu bavul bir teslimi kaçırdı. Hizmet veren ve Bidec destek ekibi arıyor, sizinle iletişime geçecekler."),
    "reportMissing": ("Report this bag missing", "الإبلاغ عن فقدان الحقيبة", "اس بیگ کے گم ہونے کی اطلاع دیں", "Laporkan koper hilang", "Laporkan beg hilang", "Bavulu kayıp bildir"),
    "bagReported": ("Reported. We will contact you.", "تم الإبلاغ. سنتواصل معك.", "اطلاع دے دی گئی۔ ہم رابطہ کریں گے۔", "Dilaporkan. Kami akan menghubungi Anda.", "Dilaporkan. Kami akan menghubungi anda.", "Bildirildi. Sizinle iletişime geçeceğiz."),

    # ── Statuses ──
    "stPendingPayment": ("Awaiting payment", "بانتظار الدفع", "ادائیگی کا انتظار", "Menunggu pembayaran", "Menunggu bayaran", "Ödeme bekleniyor"),
    "stPaid": ("Paid", "مدفوع", "ادا شدہ", "Dibayar", "Dibayar", "Ödendi"),
    "stAccepted": ("Confirmed", "مؤكد", "تصدیق شدہ", "Dikonfirmasi", "Disahkan", "Onaylandı"),
    "stInProgress": ("In progress", "قيد التنفيذ", "جاری ہے", "Berlangsung", "Sedang berjalan", "Devam ediyor"),
    "stCompleted": ("Completed", "مكتمل", "مکمل", "Selesai", "Selesai", "Tamamlandı"),
    "stDeclined": ("Declined", "مرفوض", "رد", "Ditolak", "Ditolak", "Reddedildi"),
    "stCancelled": ("Cancelled", "ملغى", "منسوخ", "Dibatalkan", "Dibatalkan", "İptal edildi"),
    "stRefunded": ("Refunded", "مسترد", "رقم واپس", "Dikembalikan", "Dibayar balik", "İade edildi"),
    "stDisputed": ("Under review", "قيد المراجعة", "زیر جائزہ", "Ditinjau", "Dalam semakan", "İnceleniyor"),
    "stPacked": ("Packed", "مغلّف", "پیک شدہ", "Dikemas", "Dibungkus", "Paketlendi"),
    "stOutForDelivery": ("Out for delivery", "في الطريق إليك", "ترسیل کے لیے روانہ", "Sedang diantar", "Dalam penghantaran", "Dağıtımda"),
    "stShipped": ("Shipped", "تم الشحن", "بھیج دیا گیا", "Dikirim", "Dihantar", "Kargoya verildi"),
    "stDelivered": ("Delivered", "تم التسليم", "پہنچا دیا گیا", "Diterima", "Diterima", "Teslim edildi"),
    "stTagged": ("Tagged", "تم وضع الملصق", "ٹیگ لگا دیا", "Ditandai", "Ditanda", "Etiketlendi"),
    "stInTransit": ("On the way", "في الطريق", "راستے میں", "Dalam perjalanan", "Dalam perjalanan", "Yolda"),
    "stStored": ("Stored", "محفوظة", "محفوظ", "Disimpan", "Disimpan", "Depoda"),
    "stOverdue": ("Overdue", "متأخرة", "تاخیر", "Terlambat", "Lewat", "Gecikti"),
    "stLost": ("Lost", "مفقودة", "گم", "Hilang", "Hilang", "Kayıp"),
    "stFound": ("Found", "عُثر عليها", "مل گیا", "Ditemukan", "Dijumpai", "Bulundu"),

    # ── Handover points ──
    "hoHotel": ("Picked up at hotel", "استلام من الفندق", "ہوٹل سے وصول", "Diambil di hotel", "Diambil di hotel", "Otelden alındı"),
    "hoVan": ("In the van", "في الحافلة", "وین میں", "Di dalam van", "Dalam van", "Araçta"),
    "hoStorage": ("In storage", "في المستودع", "اسٹوریج میں", "Di penyimpanan", "Dalam simpanan", "Depoda"),
    "hoDepot": ("At the shipping depot", "في مستودع الشحن", "شپنگ ڈپو پر", "Di gudang pengiriman", "Di depot penghantaran", "Kargo deposunda"),
    "hoAirport": ("At the airport", "في المطار", "ایئرپورٹ پر", "Di bandara", "Di lapangan terbang", "Havalimanında"),
    "hoCheckedIn": ("Checked in", "تم التسجيل في الرحلة", "چیک اِن ہو گیا", "Sudah check-in", "Telah daftar masuk", "Check-in yapıldı"),
    "hoMadinahHotel": ("At your Madinah hotel", "في فندقك بالمدينة", "مدینہ کے ہوٹل میں", "Di hotel Madinah Anda", "Di hotel Madinah anda", "Medine'deki otelinizde"),
    "hoHanded": ("Handed to you", "سُلّمت إليك", "آپ کے حوالے", "Diserahkan kepada Anda", "Diserahkan kepada anda", "Size teslim edildi"),

    # ── Shop ──
    "cart": ("Cart", "السلة", "ٹوکری", "Keranjang", "Troli", "Sepet"),
    "cartEmpty": ("Your cart is empty", "سلتك فارغة", "آپ کی ٹوکری خالی ہے", "Keranjang Anda kosong", "Troli anda kosong", "Sepetiniz boş"),
    "addToCart": ("Add to cart", "أضف إلى السلة", "ٹوکری میں ڈالیں", "Tambah ke keranjang", "Tambah ke troli", "Sepete ekle"),
    "addedToCart": ("Added to cart", "أضيف إلى السلة", "ٹوکری میں ڈال دیا", "Ditambahkan ke keranjang", "Ditambah ke troli", "Sepete eklendi"),
    "outOfStock": ("Out of stock", "نفد المخزون", "اسٹاک ختم", "Stok habis", "Kehabisan stok", "Stokta yok"),
    "otherShopInCart": ("Your cart has items from another shop. Each order comes from one shop.", "في سلتك منتجات من متجر آخر. كل طلب من متجر واحد.", "آپ کی ٹوکری میں دوسری دکان کی چیزیں ہیں۔ ہر آرڈر ایک دکان سے ہوتا ہے۔", "Keranjang Anda berisi barang dari toko lain. Setiap belanja dari satu toko.", "Troli anda ada barang dari kedai lain. Setiap pesanan dari satu kedai.", "Sepetinizde başka mağazanın ürünleri var. Her sipariş tek mağazadan olur."),
    "startNewCart": ("Start a new cart", "ابدأ سلة جديدة", "نئی ٹوکری شروع کریں", "Mulai keranjang baru", "Mulakan troli baharu", "Yeni sepet başlat"),
    "delivery": ("Delivery", "التوصيل", "ترسیل", "Pengiriman", "Penghantaran", "Teslimat"),
    "deliverTo": ("Deliver to", "التوصيل إلى", "کہاں پہنچائیں", "Kirim ke", "Hantar ke", "Teslimat yeri"),
    "toMyHotel": ("My hotel", "فندقي", "میرا ہوٹل", "Hotel saya", "Hotel saya", "Otelim"),
    "shipHome": ("Ship home", "الشحن إلى بلدي", "گھر بھیجیں", "Kirim ke tanah air", "Hantar ke tanah air", "Eve gönder"),
    "shipsHome": ("Can be shipped home", "يمكن شحنه إلى بلدك", "گھر بھیجا جا سکتا ہے", "Bisa dikirim ke tanah air", "Boleh dihantar ke tanah air", "Eve gönderilebilir"),
    "hotelOnly": ("Hotel delivery only", "التوصيل للفندق فقط", "صرف ہوٹل پر ترسیل", "Hanya diantar ke hotel", "Penghantaran ke hotel sahaja", "Yalnızca otele teslimat"),
    "room": ("Room number", "رقم الغرفة", "کمرہ نمبر", "Nomor kamar", "Nombor bilik", "Oda numarası"),
    "address": ("Address", "العنوان", "پتہ", "Alamat", "Alamat", "Adres"),
    "city": ("City", "المدينة", "شہر", "Kota", "Bandar", "Şehir"),
    "postcode": ("Postcode", "الرمز البريدي", "پوسٹ کوڈ", "Kode pos", "Poskod", "Posta kodu"),
    "countryCode": ("Country", "الدولة", "ملک", "Negara", "Negara", "Ülke"),
    "countryHint": ("Two-letter code, e.g. ID, PK, TR", "رمز من حرفين، مثل ID أو PK أو TR", "دو حرفی کوڈ، مثلاً PK, ID, TR", "Kode dua huruf, mis. ID, MY, TR", "Kod dua huruf, cth. MY, ID, TR", "İki harfli kod, ör. TR, ID, PK"),
    "giftWrap": ("Gift wrap (10 SAR)", "تغليف هدية (10 ريال)", "گفٹ ریپ (10 ریال)", "Bungkus kado (10 SAR)", "Balut hadiah (10 SAR)", "Hediye paketi (10 SAR)"),
    "giftMessage": ("Message card", "بطاقة إهداء", "پیغام کارڈ", "Kartu ucapan", "Kad ucapan", "Mesaj kartı"),
    "seeTotal": ("See total", "عرض الإجمالي", "کل رقم دیکھیں", "Lihat total", "Lihat jumlah", "Toplamı gör"),
    "arrivesIn": ("Arrives in about", "يصل خلال", "تقریباً پہنچے گا", "Tiba dalam sekitar", "Tiba dalam kira-kira", "Tahmini varış"),
    "free": ("Free", "مجاناً", "مفت", "Gratis", "Percuma", "Ücretsiz"),
    "warnLate": ("This may arrive after you leave. Choose shipping home instead?", "قد يصل بعد مغادرتك. هل تفضّل الشحن إلى بلدك؟", "یہ آپ کے جانے کے بعد پہنچ سکتا ہے۔ کیا گھر بھیجنا بہتر ہوگا؟", "Mungkin tiba setelah Anda pulang. Pilih kirim ke tanah air?", "Mungkin tiba selepas anda pulang. Pilih hantar ke tanah air?", "Bu, ayrılışınızdan sonra gelebilir. Eve gönderimi seçmek ister misiniz?"),
    "customsNote": ("Customs fees may apply in your country.", "قد تُفرض رسوم جمركية في بلدك.", "آپ کے ملک میں کسٹم فیس لگ سکتی ہے۔", "Bea cukai mungkin berlaku di negara Anda.", "Duti kastam mungkin dikenakan di negara anda.", "Ülkenizde gümrük ücreti çıkabilir."),
    "tracking": ("Tracking", "التتبع", "ٹریکنگ", "Pelacakan", "Penjejakan", "Takip"),
    "order": ("Order", "الطلب", "آرڈر", "Belanja", "Pesanan", "Sipariş"),
    "cancelOrder": ("Cancel order", "إلغاء الطلب", "آرڈر منسوخ کریں", "Batalkan belanja", "Batalkan pesanan", "Siparişi iptal et"),
    "oneShopOnly": ("Showing one shop only", "عرض متجر واحد فقط", "صرف ایک دکان دکھائی جا رہی ہے", "Hanya menampilkan satu toko", "Hanya menunjukkan satu kedai", "Yalnızca bir mağaza gösteriliyor"),

    # ── Guide ──
    "prayerTimes": ("Prayer times", "مواقيت الصلاة", "نماز کے اوقات", "Jadwal salat", "Waktu solat", "Namaz vakitleri"),
    "nextPrayer": ("{prayer} at {time} (in {minutes} min)", "{prayer} الساعة {time} (بعد {minutes} دقيقة)", "{prayer} {time} بجے ({minutes} منٹ میں)", "{prayer} pukul {time} ({minutes} menit lagi)", "{prayer} pada {time} ({minutes} minit lagi)", "{prayer} {time} ({minutes} dk sonra)"),
    "prayerMethod": ("Umm al-Qura method, computed on your phone. Follow the adhan at the Haram.", "طريقة أم القرى، محسوبة على جوالك. اتبع أذان الحرم.", "ام القریٰ طریقہ، آپ کے فون پر حساب۔ حرم کی اذان کی پیروی کریں۔", "Metode Umm al-Qura, dihitung di ponsel. Ikuti azan di Masjidil Haram.", "Kaedah Umm al-Qura, dikira di telefon. Ikut azan di Masjidil Haram.", "Ümmü'l-Kura yöntemi, telefonunuzda hesaplanır. Harem'deki ezanı takip edin."),
    "fajr": ("Fajr", "الفجر", "فجر", "Subuh", "Subuh", "İmsak"),
    "sunrise": ("Sunrise", "الشروق", "طلوع آفتاب", "Terbit", "Syuruk", "Güneş"),
    "dhuhr": ("Dhuhr", "الظهر", "ظہر", "Zuhur", "Zohor", "Öğle"),
    "asr": ("Asr", "العصر", "عصر", "Asar", "Asar", "İkindi"),
    "maghrib": ("Maghrib", "المغرب", "مغرب", "Magrib", "Maghrib", "Akşam"),
    "isha": ("Isha", "العشاء", "عشاء", "Isya", "Isyak", "Yatsı"),
    "qibla": ("Qibla", "القبلة", "قبلہ", "Kiblat", "Kiblat", "Kıble"),
    "qiblaBearing": ("Qibla: {degrees}° from north", "القبلة: {degrees}° من الشمال", "قبلہ: شمال سے {degrees}°", "Kiblat: {degrees}° dari utara", "Kiblat: {degrees}° dari utara", "Kıble: kuzeyden {degrees}°"),
    "qiblaHint": ("Hold the phone flat. The arrow turns green when you face the Qibla.", "أمسك الجوال بشكل مستوٍ. يصبح السهم أخضر عند مواجهة القبلة.", "فون کو سیدھا رکھیں۔ قبلہ رخ ہونے پر تیر سبز ہو جائے گا۔", "Pegang ponsel mendatar. Panah menjadi hijau saat menghadap kiblat.", "Pegang telefon mendatar. Anak panah menjadi hijau apabila menghadap kiblat.", "Telefonu düz tutun. Kıbleye döndüğünüzde ok yeşil olur."),
    "qiblaNeedsLocation": ("Turn on location, or choose your hotel in Profile.", "فعّل الموقع أو اختر فندقك من حسابي.", "لوکیشن آن کریں یا پروفائل میں اپنا ہوٹل منتخب کریں۔", "Nyalakan lokasi, atau pilih hotel di Profil.", "Hidupkan lokasi, atau pilih hotel di Profil.", "Konumu açın veya Profil'de otelinizi seçin."),
    "noCompass": ("This phone has no compass. Use the angle from north.", "لا يوجد بوصلة في هذا الجوال. استخدم الزاوية من الشمال.", "اس فون میں قطب نما نہیں۔ شمال سے زاویہ استعمال کریں۔", "Ponsel ini tidak punya kompas. Gunakan sudut dari utara.", "Telefon ini tiada kompas. Guna sudut dari utara.", "Bu telefonda pusula yok. Kuzeyden açıyı kullanın."),
    "kaabaMetres": ("The Kaaba is {metres} m away", "الكعبة على بعد {metres} م", "کعبہ {metres} میٹر دور ہے", "Ka'bah berjarak {metres} m", "Kaabah sejauh {metres} m", "Kâbe {metres} m uzakta"),
    "kaabaKm": ("The Kaaba is {km} km away", "الكعبة على بعد {km} كم", "کعبہ {km} کلومیٹر دور ہے", "Ka'bah berjarak {km} km", "Kaabah sejauh {km} km", "Kâbe {km} km uzakta"),
    "holySitesMap": ("Holy sites map", "خريطة المشاعر", "مقدس مقامات کا نقشہ", "Peta tempat suci", "Peta tempat suci", "Kutsal mekânlar haritası"),
    "map": ("Map", "الخريطة", "نقشہ", "Peta", "Peta", "Harita"),
    "showMap": ("Show map", "عرض الخريطة", "نقشہ دکھائیں", "Tampilkan peta", "Tunjuk peta", "Haritayı göster"),
    "showList": ("Show list", "عرض القائمة", "فہرست دکھائیں", "Tampilkan daftar", "Tunjuk senarai", "Listeyi göster"),
    "all": ("All", "الكل", "سب", "Semua", "Semua", "Tümü"),
    "ptHolySite": ("Holy site", "مشعر", "مقدس مقام", "Tempat suci", "Tempat suci", "Kutsal mekân"),
    "ptGate": ("Haram gates", "أبواب الحرم", "حرم کے دروازے", "Pintu masjid", "Pintu masjid", "Harem kapıları"),
    "ptLostFound": ("Lost and found", "المفقودات", "گمشدہ اشیاء", "Barang hilang", "Barang hilang", "Kayıp eşya"),
    "ptGathering": ("Gathering point", "نقطة تجمع", "اجتماع کی جگہ", "Titik kumpul", "Titik berkumpul", "Toplanma noktası"),
    "ptHotel": ("Hotel", "فندق", "ہوٹل", "Hotel", "Hotel", "Otel"),
    "ptToilet": ("Toilets and wudu", "دورات المياه والوضوء", "بیت الخلا اور وضو", "Toilet dan wudhu", "Tandas dan wuduk", "Tuvalet ve abdest"),
    "ptShopping": ("Shopping", "تسوق", "خریداری", "Belanja", "Membeli-belah", "Alışveriş"),
    "shoppingPlaces": ("Places to buy gifts and dates", "أماكن شراء الهدايا والتمور", "تحفے اور کھجوریں خریدنے کی جگہیں", "Tempat beli oleh-oleh dan kurma", "Tempat beli cenderamata dan kurma", "Hediye ve hurma alınacak yerler"),
    "shopOnline": ("Shop online", "تسوق عبر التطبيق", "آن لائن خریدیں", "Belanja online", "Beli dalam talian", "Çevrimiçi alışveriş"),
    "languagesSpoken": ("Speaks: {languages}", "اللغات: {languages}", "زبانیں: {languages}", "Bahasa: {languages}", "Bahasa: {languages}", "Konuşulan diller: {languages}"),
    "walkHere": ("Walk here", "المشي إلى هنا", "یہاں پیدل جائیں", "Jalan ke sini", "Berjalan ke sini", "Buraya yürü"),
    "walkingDirections": ("Walking directions", "اتجاهات المشي", "پیدل راستہ", "Petunjuk jalan kaki", "Arah berjalan kaki", "Yürüyüş yol tarifi"),
    "metresMinutes": ("{metres} m · about {minutes} min", "{metres} م · نحو {minutes} دقيقة", "{metres} میٹر · تقریباً {minutes} منٹ", "{metres} m · sekitar {minutes} menit", "{metres} m · kira-kira {minutes} minit", "{metres} m · yaklaşık {minutes} dk"),
    "stepFree": ("Step-free, wheelchair friendly", "بلا درج، مناسب للكراسي المتحركة", "بغیر سیڑھیوں کے، وہیل چیئر کے لیے موزوں", "Tanpa tangga, ramah kursi roda", "Tanpa tangga, mesra kerusi roda", "Basamaksız, tekerlekli sandalyeye uygun"),
    "hasSteps": ("Has steps", "يوجد درج", "سیڑھیاں ہیں", "Ada tangga", "Ada tangga", "Basamak var"),
    "noRoutes": ("No walking routes for this city yet", "لا توجد مسارات مشي لهذه المدينة بعد", "اس شہر کے لیے ابھی کوئی پیدل راستہ نہیں", "Belum ada rute jalan kaki untuk kota ini", "Belum ada laluan berjalan untuk bandar ini", "Bu şehir için henüz yürüyüş rotası yok"),
    "mapPackSaved": ("Places and routes are saved on your phone and work without internet.", "الأماكن والمسارات محفوظة على جوالك وتعمل دون إنترنت.", "مقامات اور راستے آپ کے فون پر محفوظ ہیں اور انٹرنیٹ کے بغیر چلتے ہیں۔", "Tempat dan rute tersimpan di ponsel dan bisa dipakai tanpa internet.", "Tempat dan laluan disimpan di telefon dan berfungsi tanpa internet.", "Yerler ve rotalar telefonunuza kaydedilir, internetsiz çalışır."),
    "voiceOn": ("Voice on", "تشغيل الصوت", "آواز آن", "Suara aktif", "Suara hidup", "Sesi aç"),
    "voiceOff": ("Voice off", "إيقاف الصوت", "آواز بند", "Suara mati", "Suara mati", "Sesi kapat"),
    "previous": ("Previous", "السابق", "پچھلا", "Sebelumnya", "Sebelumnya", "Önceki"),
    "next": ("Next", "التالي", "اگلا", "Berikutnya", "Seterusnya", "Sonraki"),
    "start": ("Start", "ابدأ", "شروع کریں", "Mulai", "Mula", "Başla"),
    "repeat": ("Repeat", "إعادة", "دہرائیں", "Ulangi", "Ulang", "Tekrarla"),
    "notFound": ("Not found", "غير موجود", "نہیں ملا", "Tidak ditemukan", "Tidak dijumpai", "Bulunamadı"),

    # ── Lost Companion ──
    "lostLocating": ("Finding your location…", "جارٍ تحديد موقعك…", "آپ کا مقام معلوم کیا جا رہا ہے…", "Mencari lokasi Anda…", "Mencari lokasi anda…", "Konumunuz bulunuyor…"),
    "lostSent": ("Your group has been told. Help is coming.", "تم إبلاغ مجموعتك. المساعدة في الطريق.", "آپ کے گروپ کو اطلاع دے دی گئی۔ مدد آ رہی ہے۔", "Rombongan Anda sudah diberi tahu. Bantuan sedang datang.", "Kumpulan anda telah dimaklumkan. Bantuan sedang datang.", "Grubunuza haber verildi. Yardım geliyor."),
    "lostQueued": ("No internet. Send the SMS so your group gets your location.", "لا يوجد إنترنت. أرسل الرسالة النصية لتصل مجموعتك إلى موقعك.", "انٹرنیٹ نہیں ہے۔ SMS بھیجیں تاکہ آپ کے گروپ کو مقام مل جائے۔", "Tidak ada internet. Kirim SMS agar rombongan menerima lokasi Anda.", "Tiada internet. Hantar SMS supaya kumpulan menerima lokasi anda.", "İnternet yok. Grubunuz konumunuzu alsın diye SMS'i gönderin."),
    "lostFailed": ("Couldn't send the alert. Send the SMS or call your group.", "تعذر إرسال التنبيه. أرسل رسالة نصية أو اتصل بمجموعتك.", "الرٹ نہیں بھیجا جا سکا۔ SMS بھیجیں یا گروپ کو کال کریں۔", "Peringatan gagal dikirim. Kirim SMS atau telepon rombongan Anda.", "Amaran gagal dihantar. Hantar SMS atau panggil kumpulan anda.", "Uyarı gönderilemedi. SMS gönderin veya grubunuzu arayın."),
    "lostStay": ("Stay where you are if it is safe. Moving makes it harder to find you.", "ابقَ في مكانك إن كان آمناً. التنقل يصعّب العثور عليك.", "اگر محفوظ ہو تو وہیں رہیں۔ چلنے سے آپ کو ڈھونڈنا مشکل ہوتا ہے۔", "Tetap di tempat jika aman. Berpindah membuat Anda lebih sulit ditemukan.", "Kekal di tempat jika selamat. Bergerak menyukarkan anda ditemui.", "Güvenliyse olduğunuz yerde kalın. Hareket etmek sizi bulmayı zorlaştırır."),
    "lostShowStaff": ("Show this screen to Haram staff or a guard.", "اعرض هذه الشاشة على موظفي الحرم أو رجل الأمن.", "یہ اسکرین حرم کے عملے یا گارڈ کو دکھائیں۔", "Tunjukkan layar ini kepada petugas atau penjaga Masjidil Haram.", "Tunjukkan skrin ini kepada petugas atau pengawal Masjidil Haram.", "Bu ekranı Harem görevlilerine veya güvenliğe gösterin."),
    "lostSendSms": ("Send my location by SMS", "أرسل موقعي برسالة نصية", "SMS سے اپنا مقام بھیجیں", "Kirim lokasi saya lewat SMS", "Hantar lokasi saya melalui SMS", "Konumumu SMS ile gönder"),
    "lostSmsTemplate": ("%name% is lost and needs help. Location: %map%", "%name% تائه ويحتاج مساعدة. الموقع: %map%", "%name% گم ہو گئے ہیں اور مدد چاہیے۔ مقام: %map%", "%name% tersesat dan butuh bantuan. Lokasi: %map%", "%name% sesat dan perlukan bantuan. Lokasi: %map%", "%name% kayboldu ve yardıma ihtiyacı var. Konum: %map%"),
    "lostNoGroup": ("You are not in a travel group. Join one in Profile so someone is told.", "لست في مجموعة سفر. انضم إلى واحدة من حسابي ليُبلَّغ أحد.", "آپ کسی سفری گروپ میں نہیں۔ پروفائل میں گروپ میں شامل ہوں تاکہ کسی کو اطلاع ہو۔", "Anda belum masuk rombongan. Gabung di Profil agar ada yang diberi tahu.", "Anda belum menyertai kumpulan. Sertai di Profil supaya ada yang dimaklumkan.", "Bir seyahat grubunda değilsiniz. Birine haber gitsin diye Profil'den bir gruba katılın."),
    "yourLocation": ("Your location", "موقعك", "آپ کا مقام", "Lokasi Anda", "Lokasi anda", "Konumunuz"),
    "nearestLostAndFound": ("Nearest lost and found", "أقرب مكتب مفقودات", "قریب ترین گمشدہ اشیاء کا دفتر", "Kantor barang hilang terdekat", "Pejabat barang hilang terdekat", "En yakın kayıp eşya bürosu"),
    "imFound": ("I'm with my group now", "أنا مع مجموعتي الآن", "میں اب اپنے گروپ کے ساتھ ہوں", "Saya sudah bersama rombongan", "Saya sudah bersama kumpulan", "Artık grubumlayım"),
    "findName": ("Find {name}", "ابحث عن {name}", "{name} کو ڈھونڈیں", "Cari {name}", "Cari {name}", "{name} kişisini bul"),
    "findNearby": ("Find nearby", "البحث القريب", "قریب ڈھونڈیں", "Cari di dekat", "Cari berdekatan", "Yakında bul"),
    "finderHint": ("Walk slowly and watch the circle. Red means you are getting closer.", "امشِ ببطء وراقب الدائرة. الأحمر يعني أنك تقترب.", "آہستہ چلیں اور دائرہ دیکھیں۔ سرخ کا مطلب ہے آپ قریب آ رہے ہیں۔", "Berjalanlah perlahan dan lihat lingkaran. Merah berarti Anda makin dekat.", "Berjalan perlahan dan lihat bulatan. Merah bermakna anda semakin dekat.", "Yavaş yürüyün ve daireyi izleyin. Kırmızı yaklaştığınız anlamına gelir."),
    "finderSearching": ("Searching…", "جارٍ البحث…", "تلاش جاری ہے…", "Mencari…", "Mencari…", "Aranıyor…"),
    "finderWarmer": ("Warmer", "تقترب", "قریب", "Makin dekat", "Semakin dekat", "Yaklaşıyorsun"),
    "finderColder": ("Colder", "تبتعد", "دور", "Makin jauh", "Semakin jauh", "Uzaklaşıyorsun"),
    "finderSame": ("Nearby", "قريب", "آس پاس", "Di dekat", "Berdekatan", "Yakında"),
    "finderAbout": ("About {metres} m away", "على بعد نحو {metres} م", "تقریباً {metres} میٹر دور", "Sekitar {metres} m", "Kira-kira {metres} m", "Yaklaşık {metres} m uzakta"),
    "finderNote": ("Bluetooth works up to about 30–50 m and needs no internet. Crowds weaken the signal.", "يعمل البلوتوث حتى نحو 30–50 م دون إنترنت. الزحام يضعف الإشارة.", "بلوٹوتھ تقریباً 30–50 میٹر تک بغیر انٹرنیٹ کام کرتا ہے۔ ہجوم سگنل کمزور کرتا ہے۔", "Bluetooth bekerja hingga sekitar 30–50 m tanpa internet. Keramaian melemahkan sinyal.", "Bluetooth berfungsi sehingga kira-kira 30–50 m tanpa internet. Orang ramai melemahkan isyarat.", "Bluetooth internetsiz yaklaşık 30–50 m'ye kadar çalışır. Kalabalık sinyali zayıflatır."),
    "finderPermission": ("Allow Bluetooth and location in your phone settings to use the finder.", "اسمح بالبلوتوث والموقع من إعدادات جوالك لاستخدام البحث.", "تلاش استعمال کرنے کے لیے فون کی ترتیبات میں بلوٹوتھ اور لوکیشن کی اجازت دیں۔", "Izinkan Bluetooth dan lokasi di pengaturan ponsel untuk memakai pencari.", "Benarkan Bluetooth dan lokasi dalam tetapan telefon untuk guna pencari.", "Bulucuyu kullanmak için telefon ayarlarından Bluetooth ve konuma izin verin."),
    "finderBluetoothOff": ("Turn on Bluetooth to search.", "شغّل البلوتوث للبحث.", "تلاش کے لیے بلوٹوتھ آن کریں۔", "Nyalakan Bluetooth untuk mencari.", "Hidupkan Bluetooth untuk mencari.", "Aramak için Bluetooth'u açın."),
    "finderNoMember": ("This person is not in your travel group.", "هذا الشخص ليس في مجموعة سفرك.", "یہ شخص آپ کے سفری گروپ میں نہیں۔", "Orang ini tidak ada di rombongan Anda.", "Orang ini tiada dalam kumpulan anda.", "Bu kişi seyahat grubunuzda değil."),

    # ── Group ──
    "travelGroup": ("Travel group", "مجموعة السفر", "سفری گروپ", "Rombongan", "Kumpulan perjalanan", "Seyahat grubu"),
    "groupIntro": ("Join your family or group so you can find each other if someone gets lost.", "انضم إلى عائلتك أو مجموعتك لتجدوا بعضكم إن تاه أحد.", "اپنے خاندان یا گروپ میں شامل ہوں تاکہ کوئی گم ہو تو ایک دوسرے کو ڈھونڈ سکیں۔", "Gabung dengan keluarga atau rombongan agar bisa saling menemukan jika ada yang tersesat.", "Sertai keluarga atau kumpulan anda supaya boleh saling mencari jika ada yang sesat.", "Biri kaybolursa birbirinizi bulabilmek için ailenizin veya grubunuzun grubuna katılın."),
    "joinGroup": ("Join a group", "الانضمام إلى مجموعة", "گروپ میں شامل ہوں", "Gabung rombongan", "Sertai kumpulan", "Gruba katıl"),
    "joinAnotherGroup": ("Join another group", "الانضمام إلى مجموعة أخرى", "دوسرے گروپ میں شامل ہوں", "Gabung rombongan lain", "Sertai kumpulan lain", "Başka gruba katıl"),
    "createGroup": ("Create a group", "إنشاء مجموعة", "گروپ بنائیں", "Buat rombongan", "Cipta kumpulan", "Grup oluştur"),
    "groupName": ("Group name", "اسم المجموعة", "گروپ کا نام", "Nama rombongan", "Nama kumpulan", "Grup adı"),
    "myFamily": ("My family", "عائلتي", "میرا خاندان", "Keluarga saya", "Keluarga saya", "Ailem"),
    "joinCode": ("Join code", "رمز الانضمام", "شمولیت کا کوڈ", "Kode gabung", "Kod sertai", "Katılım kodu"),
    "join": ("Join", "انضمام", "شامل ہوں", "Gabung", "Sertai", "Katıl"),
    "create": ("Create", "إنشاء", "بنائیں", "Buat", "Cipta", "Oluştur"),
    "scanQr": ("Scan QR code", "مسح رمز QR", "QR کوڈ اسکین کریں", "Pindai kode QR", "Imbas kod QR", "QR kodu tara"),
    "inviteToGroup": ("Invite to the group", "دعوة إلى المجموعة", "گروپ میں مدعو کریں", "Undang ke rombongan", "Jemput ke kumpulan", "Gruba davet et"),
    "inviteHint": ("Ask them to open Rafeeq › Profile › Travel group and scan this code.", "اطلب منهم فتح رفيق › حسابي › مجموعة السفر ومسح هذا الرمز.", "ان سے کہیں رفیق › پروفائل › سفری گروپ کھول کر یہ کوڈ اسکین کریں۔", "Minta mereka membuka Rafeeq › Profil › Rombongan lalu pindai kode ini.", "Minta mereka buka Rafeeq › Profil › Kumpulan perjalanan dan imbas kod ini.", "Rafeeq › Profil › Seyahat grubu'nu açıp bu kodu taramalarını isteyin."),
    "alertFrom": ("{name} pressed “I'm lost” {age}", "{name} ضغط «أنا تائه» {age}", "{name} نے “میں گم ہو گیا ہوں” دبایا {age}", "{name} menekan “Saya tersesat” {age}", "{name} menekan “Saya sesat” {age}", "{name} “Kayboldum”a bastı, {age}"),
    "imComing": ("I'm coming", "أنا قادم", "میں آ رہا ہوں", "Saya datang", "Saya datang", "Geliyorum"),
    "markFound": ("Found", "تم العثور عليه", "مل گیا", "Sudah ditemukan", "Sudah dijumpai", "Bulundu"),
    "leader": ("Leader", "القائد", "قائد", "Ketua", "Ketua", "Lider"),
    "you": ("(you)", "(أنت)", "(آپ)", "(Anda)", "(anda)", "(siz)"),
    "lastSeen": ("last seen {age}", "آخر ظهور {age}", "آخری بار {age}", "terakhir terlihat {age}", "kali terakhir dilihat {age}", "son görülme {age}"),
    "notSharing": ("not sharing location", "لا يشارك الموقع", "مقام شیئر نہیں کر رہے", "tidak berbagi lokasi", "tidak berkongsi lokasi", "konum paylaşmıyor"),
    "justNow": ("just now", "الآن", "ابھی", "baru saja", "baru sahaja", "az önce"),
    "minutesAgo": ("{count, plural, =1{1 min ago} other{{count} min ago}}", "قبل {count} دقيقة", "{count} منٹ پہلے", "{count} menit lalu", "{count} minit lalu", "{count} dk önce"),

    # ── Profile ──
    "myNeeds": ("My needs (shared with providers when I book)", "احتياجاتي (تُشارك مع مقدمي الخدمة عند الحجز)", "میری ضروریات (بکنگ پر فراہم کنندگان کو بتائی جاتی ہیں)", "Kebutuhan saya (dibagikan ke penyedia saat memesan)", "Keperluan saya (dikongsi dengan penyedia semasa menempah)", "İhtiyaçlarım (rezervasyonda hizmet verenlerle paylaşılır)"),
    "needWheelchair": ("Uses a wheelchair", "يستخدم كرسياً متحركاً", "وہیل چیئر استعمال کرتے ہیں", "Memakai kursi roda", "Menggunakan kerusi roda", "Tekerlekli sandalye kullanıyor"),
    "needWalker": ("Uses a walker or cane", "يستخدم مشاية أو عصا", "واکر یا چھڑی استعمال کرتے ہیں", "Memakai alat bantu jalan", "Menggunakan alat bantu jalan", "Yürüteç veya baston kullanıyor"),
    "needHearing": ("Hard of hearing", "ضعف السمع", "کم سنائی دیتا ہے", "Gangguan pendengaran", "Masalah pendengaran", "İşitme güçlüğü"),
    "needLowVision": ("Low vision", "ضعف البصر", "کم نظر", "Penglihatan lemah", "Penglihatan terhad", "Az görüyor"),
    "needBlind": ("Blind", "كفيف", "نابینا", "Tunanetra", "Buta", "Görme engelli"),
    "needMemory": ("Memory loss", "ضعف الذاكرة", "یادداشت کی کمزوری", "Mudah lupa", "Masalah ingatan", "Hafıza kaybı"),
    "needOther": ("Other needs", "احتياجات أخرى", "دیگر ضروریات", "Kebutuhan lain", "Keperluan lain", "Diğer ihtiyaçlar"),
    "shareLocation": ("Share my location with my group", "مشاركة موقعي مع مجموعتي", "اپنا مقام گروپ سے شیئر کریں", "Bagikan lokasi ke rombongan", "Kongsi lokasi dengan kumpulan", "Konumumu grubumla paylaş"),
    "shareLocationHint": ("So they can find you if you get lost", "ليتمكنوا من إيجادك إن تهت", "تاکہ آپ گم ہوں تو وہ آپ کو ڈھونڈ سکیں", "Agar mereka bisa menemukan Anda jika tersesat", "Supaya mereka boleh mencari anda jika sesat", "Kaybolursanız sizi bulabilmeleri için"),
    "locationConsent": ("Rafeeq will record your location every few minutes and share it only with your travel group. It is deleted 7 days after your trip. You can turn this off at any time, which deletes what was stored.", "سيسجل رفيق موقعك كل بضع دقائق ويشاركه مع مجموعة سفرك فقط. يُحذف بعد 7 أيام من انتهاء رحلتك. يمكنك إيقافه في أي وقت فيُحذف ما خُزّن.", "رفیق ہر چند منٹ بعد آپ کا مقام محفوظ کرے گا اور صرف آپ کے سفری گروپ کو دکھائے گا۔ سفر کے 7 دن بعد حذف ہو جاتا ہے۔ آپ کسی بھی وقت بند کر سکتے ہیں، جس سے محفوظ ڈیٹا حذف ہو جائے گا۔", "Rafeeq akan merekam lokasi Anda setiap beberapa menit dan hanya membagikannya ke rombongan. Data dihapus 7 hari setelah perjalanan. Anda bisa mematikannya kapan saja, dan data yang tersimpan akan dihapus.", "Rafeeq akan merekod lokasi anda setiap beberapa minit dan hanya berkongsi dengan kumpulan perjalanan anda. Ia dipadam 7 hari selepas perjalanan. Anda boleh mematikannya bila-bila masa, dan data yang disimpan akan dipadam.", "Rafeeq birkaç dakikada bir konumunuzu kaydeder ve yalnızca seyahat grubunuzla paylaşır. Seyahatinizden 7 gün sonra silinir. İstediğiniz zaman kapatabilirsiniz; kaydedilenler silinir."),
    "agree": ("I agree", "أوافق", "میں متفق ہوں", "Saya setuju", "Saya setuju", "Kabul ediyorum"),
    "notNow": ("Not now", "ليس الآن", "ابھی نہیں", "Nanti saja", "Bukan sekarang", "Şimdi değil"),
    "locationPermissionNeeded": ("Allow location for Rafeeq in your phone settings.", "اسمح لرفيق بالوصول إلى الموقع من إعدادات جوالك.", "فون کی ترتیبات میں رفیق کو لوکیشن کی اجازت دیں۔", "Izinkan lokasi untuk Rafeeq di pengaturan ponsel.", "Benarkan lokasi untuk Rafeeq dalam tetapan telefon.", "Telefon ayarlarından Rafeeq'e konum izni verin."),
    "emergencyContacts": ("Emergency contacts", "جهات اتصال الطوارئ", "ہنگامی رابطے", "Kontak darurat", "Kenalan kecemasan", "Acil durum kişileri"),
    "emergencyContactsHint": ("They get an SMS with your location if you press “I'm lost”.", "يتلقون رسالة نصية بموقعك إذا ضغطت «أنا تائه».", "اگر آپ “میں گم ہو گیا ہوں” دبائیں تو انہیں آپ کے مقام کا SMS ملے گا۔", "Mereka menerima SMS berisi lokasi Anda jika Anda menekan “Saya tersesat”.", "Mereka menerima SMS lokasi anda jika anda menekan “Saya sesat”.", "“Kayboldum”a basarsanız konumunuzla SMS alırlar."),
    "noContacts": ("No emergency contacts yet", "لا توجد جهات اتصال طوارئ بعد", "ابھی کوئی ہنگامی رابطہ نہیں", "Belum ada kontak darurat", "Belum ada kenalan kecemasan", "Henüz acil durum kişisi yok"),
    "addContact": ("Add contact", "إضافة جهة اتصال", "رابطہ شامل کریں", "Tambah kontak", "Tambah kenalan", "Kişi ekle"),
    "name": ("Name", "الاسم", "نام", "Nama", "Nama", "Ad"),
    "relation": ("Relation (optional)", "صلة القرابة (اختياري)", "رشتہ (اختیاری)", "Hubungan (opsional)", "Hubungan (pilihan)", "Yakınlık (isteğe bağlı)"),
    "trackerTag": ("Tracker tag", "جهاز التتبع", "ٹریکر ٹیگ", "Tag pelacak", "Tag penjejak", "Takip etiketi"),
    "tagIntro": ("A tracker tag (Apple AirTag or a Google Find My Device tag) helps find someone who doesn't use a phone. It is found by the family member who sets it up.", "يساعد جهاز التتبع (AirTag من آبل أو جهاز Find My Device من جوجل) في إيجاد من لا يستخدم جوالاً. يجده فرد العائلة الذي أعدّه.", "ٹریکر ٹیگ (ایپل AirTag یا گوگل Find My Device ٹیگ) ان لوگوں کو ڈھونڈنے میں مدد دیتا ہے جو فون استعمال نہیں کرتے۔ اسے وہی رشتہ دار ڈھونڈتا ہے جس نے سیٹ کیا۔", "Tag pelacak (Apple AirTag atau tag Google Find My Device) membantu menemukan orang yang tidak memakai ponsel. Tag ditemukan oleh anggota keluarga yang memasangnya.", "Tag penjejak (Apple AirTag atau tag Google Find My Device) membantu mencari orang yang tidak menggunakan telefon. Ia dijejak oleh ahli keluarga yang menyediakannya.", "Takip etiketi (Apple AirTag veya Google Find My Device etiketi), telefon kullanmayan birini bulmaya yardım eder. Etiketi kuran aile üyesi tarafından bulunur."),
    "tagStep1": ("On the family member's phone, open Find My (iPhone) or Find My Device (Android).", "على جوال فرد العائلة افتح تطبيق Find My (آيفون) أو Find My Device (أندرويد).", "رشتہ دار کے فون پر Find My (آئی فون) یا Find My Device (اینڈرائیڈ) کھولیں۔", "Di ponsel anggota keluarga, buka Find My (iPhone) atau Find My Device (Android).", "Di telefon ahli keluarga, buka Find My (iPhone) atau Find My Device (Android).", "Aile üyesinin telefonunda Find My (iPhone) veya Find My Device (Android) uygulamasını açın."),
    "tagStep2": ("Hold the tag near the phone and follow the steps to add it.", "قرّب الجهاز من الجوال واتبع الخطوات لإضافته.", "ٹیگ کو فون کے قریب رکھیں اور شامل کرنے کے مراحل پر عمل کریں۔", "Dekatkan tag ke ponsel dan ikuti langkah untuk menambahkannya.", "Dekatkan tag ke telefon dan ikut langkah untuk menambahnya.", "Etiketi telefona yaklaştırın ve eklemek için adımları izleyin."),
    "tagStep3": ("Put the tag in a pocket, bag or on a lanyard the pilgrim always carries.", "ضع الجهاز في جيب أو حقيبة أو علاّقة يحملها الحاج دائماً.", "ٹیگ کو جیب، بیگ یا ڈوری میں رکھیں جو حاجی ہمیشہ ساتھ رکھے۔", "Taruh tag di saku, tas, atau tali leher yang selalu dibawa jemaah.", "Letakkan tag dalam poket, beg atau tali leher yang sentiasa dibawa jemaah.", "Etiketi hacının her zaman taşıdığı cebe, çantaya veya boyun askısına koyun."),
    "tagStep4": ("Write below which tag this is, so your group knows who carries it.", "اكتب أدناه اسم الجهاز لتعرف مجموعتك من يحمله.", "نیچے لکھیں کہ یہ کون سا ٹیگ ہے تاکہ گروپ کو معلوم ہو کون لے کر چل رہا ہے۔", "Tulis di bawah tag yang mana, agar rombongan tahu siapa yang membawanya.", "Tulis di bawah tag yang mana, supaya kumpulan tahu siapa membawanya.", "Grubunuz kimin taşıdığını bilsin diye bunun hangi etiket olduğunu aşağıya yazın."),
    "tagPrivacy": ("Rafeeq never sees the tag's location; only the person who set it up can.", "لا يرى رفيق موقع الجهاز أبداً؛ يراه فقط من أعدّه.", "رفیق کبھی ٹیگ کا مقام نہیں دیکھتا؛ صرف سیٹ کرنے والا دیکھ سکتا ہے۔", "Rafeeq tidak pernah melihat lokasi tag; hanya pemasangnya yang bisa.", "Rafeeq tidak pernah melihat lokasi tag; hanya yang menyediakannya boleh.", "Rafeeq etiketin konumunu asla görmez; yalnızca kuran kişi görebilir."),
    "rentTag": ("Rent a tag, delivered to your hotel", "استأجر جهازاً يُوصَل إلى فندقك", "ٹیگ کرائے پر لیں، ہوٹل پر پہنچایا جائے گا", "Sewa tag, diantar ke hotel", "Sewa tag, dihantar ke hotel", "Otelinize teslim edilen etiket kiralayın"),
    "tagRecord": ("Which tag do you carry?", "أي جهاز تحمل؟", "آپ کون سا ٹیگ رکھتے ہیں؟", "Tag mana yang Anda bawa?", "Tag mana yang anda bawa?", "Hangi etiketi taşıyorsunuz?"),
    "tagLabel": ("Tag name", "اسم الجهاز", "ٹیگ کا نام", "Nama tag", "Nama tag", "Etiket adı"),
    "help": ("Help", "المساعدة", "مدد", "Bantuan", "Bantuan", "Yardım"),
    "helpArticles": ("Questions and answers", "أسئلة وأجوبة", "سوالات و جوابات", "Tanya jawab", "Soal jawab", "Sorular ve cevaplar"),
    "emergency911": ("Emergency (police, fire, ambulance): 911", "الطوارئ (شرطة، دفاع مدني، إسعاف): 911", "ایمرجنسی (پولیس، فائر، ایمبولینس): 911", "Darurat (polisi, pemadam, ambulans): 911", "Kecemasan (polis, bomba, ambulans): 911", "Acil durum (polis, itfaiye, ambulans): 911"),
    "ambulance997": ("Red Crescent ambulance: 997", "إسعاف الهلال الأحمر: 997", "ہلال احمر ایمبولینس: 997", "Ambulans Bulan Sabit Merah: 997", "Ambulans Bulan Sabit Merah: 997", "Kızılay ambulansı: 997"),
    "downloadMyData": ("Download my data", "تنزيل بياناتي", "اپنا ڈیٹا ڈاؤن لوڈ کریں", "Unduh data saya", "Muat turun data saya", "Verilerimi indir"),
    "dataCopied": ("Your data was copied. Paste it into a note or email to keep it.", "نُسخت بياناتك. الصقها في ملاحظة أو بريد للاحتفاظ بها.", "آپ کا ڈیٹا کاپی ہو گیا۔ محفوظ رکھنے کے لیے نوٹ یا ای میل میں پیسٹ کریں۔", "Data Anda disalin. Tempel ke catatan atau email untuk menyimpannya.", "Data anda telah disalin. Tampal ke nota atau e-mel untuk menyimpannya.", "Verileriniz kopyalandı. Saklamak için bir nota veya e-postaya yapıştırın."),
    "deleteAccount": ("Delete my account", "حذف حسابي", "اپنا اکاؤنٹ حذف کریں", "Hapus akun saya", "Padam akaun saya", "Hesabımı sil"),
    "deleteAccountWarning": ("Your profile, locations, contacts and groups are deleted. Paid bookings are kept without your name for invoices. This can't be undone.", "يُحذف ملفك ومواقعك وجهات اتصالك ومجموعاتك. تبقى الحجوزات المدفوعة دون اسمك لأغراض الفواتير. لا يمكن التراجع.", "آپ کی پروفائل، مقامات، رابطے اور گروپ حذف ہو جائیں گے۔ ادا شدہ بکنگز انوائس کے لیے آپ کے نام کے بغیر رکھی جائیں گی۔ یہ واپس نہیں ہو سکتا۔", "Profil, lokasi, kontak, dan rombongan Anda dihapus. Pesanan berbayar disimpan tanpa nama Anda untuk faktur. Tidak bisa dibatalkan.", "Profil, lokasi, kenalan dan kumpulan anda dipadam. Tempahan berbayar disimpan tanpa nama anda untuk invois. Ini tidak boleh dibatalkan.", "Profiliniz, konumlarınız, kişileriniz ve gruplarınız silinir. Ödenmiş rezervasyonlar faturalar için adınız olmadan saklanır. Bu geri alınamaz."),
    "signOut": ("Sign out", "تسجيل الخروج", "سائن آؤٹ", "Keluar", "Log keluar", "Çıkış yap"),

    # ── Staff mode ──
    "staffMode": ("Staff mode", "وضع الموظفين", "اسٹاف موڈ", "Mode petugas", "Mod kakitangan", "Personel modu"),
    "todaysJobs": ("Today's jobs", "مهام اليوم", "آج کے کام", "Tugas hari ini", "Tugasan hari ini", "Bugünün işleri"),
    "noJobsToday": ("No jobs today", "لا توجد مهام اليوم", "آج کوئی کام نہیں", "Tidak ada tugas hari ini", "Tiada tugasan hari ini", "Bugün iş yok"),
    "job": ("Job", "المهمة", "کام", "Tugas", "Tugasan", "İş"),
    "hasNeeds": ("Pilgrim needs help (see job)", "يحتاج الحاج مساعدة (انظر المهمة)", "حاجی کو مدد چاہیے (کام دیکھیں)", "Jemaah butuh bantuan (lihat tugas)", "Jemaah perlukan bantuan (lihat tugasan)", "Hacının yardıma ihtiyacı var (işe bakın)"),
    "pilgrimNeeds": ("Pilgrim's needs", "احتياجات الحاج", "حاجی کی ضروریات", "Kebutuhan jemaah", "Keperluan jemaah", "Hacının ihtiyaçları"),
    "speaks": ("Speaks {language}", "يتحدث {language}", "{language} بولتے ہیں", "Berbahasa {language}", "Bertutur {language}", "{language} konuşuyor"),
    "pickup": ("Pick-up", "الاستلام", "لینے کی جگہ", "Penjemputan", "Ambil", "Alış"),
    "dropoff": ("Drop-off", "التوصيل", "چھوڑنے کی جگہ", "Pengantaran", "Hantar", "Bırakış"),
    "navigate": ("Navigate", "الملاحة", "راستہ", "Navigasi", "Navigasi", "Yol tarifi"),
    "sharingLocationWithPilgrim": ("The pilgrim can see your location while this job is active.", "يرى الحاج موقعك طالما المهمة نشطة.", "یہ کام جاری رہنے تک حاجی آپ کا مقام دیکھ سکتا ہے۔", "Jemaah bisa melihat lokasi Anda selama tugas ini aktif.", "Jemaah boleh melihat lokasi anda semasa tugasan ini aktif.", "Bu iş sürerken hacı konumunuzu görebilir."),
    "startJob": ("Start job", "بدء المهمة", "کام شروع کریں", "Mulai tugas", "Mulakan tugasan", "İşe başla"),
    "completeJob": ("Complete job", "إنهاء المهمة", "کام مکمل کریں", "Selesaikan tugas", "Selesaikan tugasan", "İşi tamamla"),
    "completeJobConfirm": ("Mark this job as completed?", "هل تريد تعليم المهمة كمكتملة؟", "کیا یہ کام مکمل نشان زد کریں؟", "Tandai tugas ini selesai?", "Tandakan tugasan ini selesai?", "Bu iş tamamlandı olarak işaretlensin mi?"),
    "scanBags": ("Scan bags", "مسح الحقائب", "بیگ اسکین کریں", "Pindai koper", "Imbas beg", "Bavul tara"),
    "handoverPoint": ("Where is the handover?", "أين يتم التسليم؟", "حوالگی کہاں ہو رہی ہے؟", "Di mana serah terima?", "Di mana serahan?", "Teslim nerede?"),
    "scanAt": ("Handover: {place}", "التسليم: {place}", "حوالگی: {place}", "Serah terima: {place}", "Serahan: {place}", "Teslim: {place}"),
    "bagLabelOptional": ("Bag description (optional)", "وصف الحقيبة (اختياري)", "بیگ کی تفصیل (اختیاری)", "Keterangan koper (opsional)", "Keterangan beg (pilihan)", "Bavul açıklaması (isteğe bağlı)"),
    "bagLabelHint": ("e.g. Blue suitcase", "مثل: حقيبة زرقاء", "مثلاً نیلا سوٹ کیس", "mis. Koper biru", "cth. Beg biru", "ör. Mavi bavul"),
    "typeTagCode": ("Type the tag code", "اكتب رمز الملصق", "ٹیگ کوڈ ٹائپ کریں", "Ketik kode tag", "Taip kod tag", "Etiket kodunu yazın"),
    "invalidTag": ("That is not a Rafeeq tag code (RFQ-XXXXXX)", "هذا ليس رمز ملصق رفيق (RFQ-XXXXXX)", "یہ رفیق ٹیگ کوڈ نہیں (RFQ-XXXXXX)", "Itu bukan kode tag Rafeeq (RFQ-XXXXXX)", "Itu bukan kod tag Rafeeq (RFQ-XXXXXX)", "Bu bir Rafeeq etiket kodu değil (RFQ-XXXXXX)"),
    "torch": ("Torch", "الكشاف", "ٹارچ", "Senter", "Lampu suluh", "Fener"),
    "scansWaiting": ("{count, plural, =1{1 scan waiting for network} other{{count} scans waiting for network}}", "{count} مسح بانتظار الشبكة", "{count} اسکین نیٹ ورک کے انتظار میں", "{count} pindaian menunggu jaringan", "{count} imbasan menunggu rangkaian", "{count} tarama ağ bekliyor"),
    "waiting": ("Waiting", "بالانتظار", "انتظار", "Menunggu", "Menunggu", "Bekliyor"),
    "sent": ("Sent", "أُرسل", "بھیج دیا", "Terkirim", "Dihantar", "Gönderildi"),

    # ── Common ──
    "ok": ("OK", "حسناً", "ٹھیک ہے", "OK", "OK", "Tamam"),
    "cancel": ("Cancel", "إلغاء", "منسوخ", "Batal", "Batal", "İptal"),
    "confirm": ("Confirm", "تأكيد", "تصدیق", "Konfirmasi", "Sahkan", "Onayla"),
    "save": ("Save", "حفظ", "محفوظ کریں", "Simpan", "Simpan", "Kaydet"),
    "saved": ("Saved", "تم الحفظ", "محفوظ ہو گیا", "Tersimpan", "Disimpan", "Kaydedildi"),
    "delete": ("Delete", "حذف", "حذف کریں", "Hapus", "Padam", "Sil"),
    "close": ("Close", "إغلاق", "بند کریں", "Tutup", "Tutup", "Kapat"),
    "back": ("Back", "رجوع", "واپس", "Kembali", "Kembali", "Geri"),
    "send": ("Send", "إرسال", "بھیجیں", "Kirim", "Hantar", "Gönder"),
    "retry": ("Try again", "إعادة المحاولة", "دوبارہ کوشش کریں", "Coba lagi", "Cuba lagi", "Tekrar dene"),
    "required": ("Required", "مطلوب", "ضروری", "Wajib", "Wajib", "Zorunlu"),
    "waitingToSend": ("{count, plural, =1{1 item waiting for network} other{{count} items waiting for network}}", "{count} بانتظار الشبكة", "{count} نیٹ ورک کے انتظار میں", "{count} menunggu jaringan", "{count} menunggu rangkaian", "{count} öğe ağ bekliyor"),
    "updatedAgo": ("{minutes, plural, =0{Saved on your phone · updated just now} =1{Saved on your phone · updated 1 min ago} other{Saved on your phone · updated {minutes} min ago}}", "محفوظ على جوالك · آخر تحديث قبل {minutes} دقيقة", "آپ کے فون پر محفوظ · {minutes} منٹ پہلے اپ ڈیٹ", "Tersimpan di ponsel · diperbarui {minutes} menit lalu", "Disimpan di telefon · dikemas kini {minutes} minit lalu", "Telefonunuzda kayıtlı · {minutes} dk önce güncellendi"),

    # ── Errors ──
    "errOffline": ("No internet connection. Showing what is saved on your phone.", "لا يوجد اتصال بالإنترنت. نعرض المحفوظ على جوالك.", "انٹرنیٹ کنکشن نہیں۔ آپ کے فون پر محفوظ معلومات دکھائی جا رہی ہیں۔", "Tidak ada koneksi internet. Menampilkan data di ponsel Anda.", "Tiada sambungan internet. Menunjukkan data di telefon anda.", "İnternet bağlantısı yok. Telefonunuzdaki kayıtlar gösteriliyor."),
    "errWrongCode": ("Wrong code. Check the SMS and try again.", "الرمز غير صحيح. تحقق من الرسالة وحاول مجدداً.", "غلط کوڈ۔ SMS دیکھ کر دوبارہ کوشش کریں۔", "Kode salah. Periksa SMS dan coba lagi.", "Kod salah. Semak SMS dan cuba lagi.", "Kod yanlış. SMS'i kontrol edip tekrar deneyin."),
    "errCodeExpired": ("The code has expired. Ask for a new one.", "انتهت صلاحية الرمز. اطلب رمزاً جديداً.", "کوڈ کی میعاد ختم ہو گئی۔ نیا کوڈ منگوائیں۔", "Kode kedaluwarsa. Minta kode baru.", "Kod telah tamat tempoh. Minta kod baharu.", "Kodun süresi doldu. Yeni kod isteyin."),
    "errTooMany": ("Too many tries. Wait a few minutes and try again.", "محاولات كثيرة. انتظر بضع دقائق ثم حاول.", "بہت زیادہ کوششیں۔ چند منٹ انتظار کر کے دوبارہ کوشش کریں۔", "Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.", "Terlalu banyak cubaan. Tunggu beberapa minit dan cuba lagi.", "Çok fazla deneme. Birkaç dakika bekleyip tekrar deneyin."),
    "errPhone": ("Enter the number with the country code, starting with +", "أدخل الرقم مع رمز الدولة، يبدأ بـ +", "ملک کے کوڈ کے ساتھ نمبر درج کریں، + سے شروع", "Masukkan nomor dengan kode negara, diawali +", "Masukkan nombor dengan kod negara, bermula dengan +", "Numarayı ülke koduyla, + ile başlayarak girin"),
    "errSlotFull": ("That time has just been taken. Choose another.", "حُجز هذا الموعد للتو. اختر موعداً آخر.", "یہ وقت ابھی کسی نے لے لیا۔ دوسرا منتخب کریں۔", "Waktu itu baru saja diambil. Pilih yang lain.", "Masa itu baru sahaja diambil. Pilih yang lain.", "Bu saat az önce alındı. Başka bir saat seçin."),
    "errHoldExpired": ("The 10-minute hold ended. Choose the time again.", "انتهت مهلة الحجز المؤقت (10 دقائق). اختر الموعد مجدداً.", "10 منٹ کا وقت ختم ہو گیا۔ دوبارہ وقت منتخب کریں۔", "Waktu tahan 10 menit habis. Pilih waktu lagi.", "Tempoh tahan 10 minit tamat. Pilih masa semula.", "10 dakikalık ayırma bitti. Saati yeniden seçin."),
    "errCannotCancel": ("This booking can no longer be cancelled. Use “Report a problem”.", "لم يعد بالإمكان إلغاء هذا الحجز. استخدم «الإبلاغ عن مشكلة».", "یہ بکنگ اب منسوخ نہیں ہو سکتی۔ “مسئلہ بتائیں” استعمال کریں۔", "Pesanan ini tidak bisa dibatalkan lagi. Gunakan “Laporkan masalah”.", "Tempahan ini tidak boleh dibatalkan lagi. Guna “Laporkan masalah”.", "Bu rezervasyon artık iptal edilemez. “Sorun bildir”i kullanın."),
    "errTestCard": ("Use a test card: 4111 1111 1111 1111", "استخدم بطاقة تجريبية: 4111 1111 1111 1111", "ٹیسٹ کارڈ استعمال کریں: 4111 1111 1111 1111", "Gunakan kartu uji: 4111 1111 1111 1111", "Guna kad ujian: 4111 1111 1111 1111", "Test kartı kullanın: 4111 1111 1111 1111"),
    "errOutOfStock": ("Not enough in stock. Lower the quantity.", "الكمية غير متوفرة. قلّل العدد.", "اسٹاک کافی نہیں۔ تعداد کم کریں۔", "Stok tidak cukup. Kurangi jumlah.", "Stok tidak mencukupi. Kurangkan kuantiti.", "Stok yetersiz. Adedi azaltın."),
    "errCountry": ("Some items can't be shipped to that country.", "بعض المنتجات لا يمكن شحنها إلى تلك الدولة.", "کچھ اشیاء اس ملک میں نہیں بھیجی جا سکتیں۔", "Beberapa barang tidak bisa dikirim ke negara itu.", "Sesetengah barang tidak boleh dihantar ke negara itu.", "Bazı ürünler o ülkeye gönderilemiyor."),
    "errNoHotel": ("Choose your hotel in Profile first.", "اختر فندقك من حسابي أولاً.", "پہلے پروفائل میں اپنا ہوٹل منتخب کریں۔", "Pilih hotel Anda di Profil dulu.", "Pilih hotel anda di Profil dahulu.", "Önce Profil'de otelinizi seçin."),
    "errOneShop": ("An order can only have items from one shop.", "يمكن أن يحتوي الطلب على منتجات من متجر واحد فقط.", "ایک آرڈر میں صرف ایک دکان کی چیزیں ہو سکتی ہیں۔", "Satu belanja hanya boleh berisi barang dari satu toko.", "Satu pesanan hanya boleh mengandungi barang dari satu kedai.", "Bir siparişte yalnızca tek mağazanın ürünleri olabilir."),
    "errNoConsent": ("Turn on “Share my location” in Profile first.", "فعّل «مشاركة موقعي» من حسابي أولاً.", "پہلے پروفائل میں “مقام شیئر کریں” آن کریں۔", "Aktifkan “Bagikan lokasi” di Profil dulu.", "Hidupkan “Kongsi lokasi” di Profil dahulu.", "Önce Profil'de “Konumumu paylaş”ı açın."),
    "errNoGroup": ("Join a travel group first.", "انضم إلى مجموعة سفر أولاً.", "پہلے کسی سفری گروپ میں شامل ہوں۔", "Gabung rombongan dulu.", "Sertai kumpulan perjalanan dahulu.", "Önce bir seyahat grubuna katılın."),
    "errGroupCode": ("No group with that code. Check it and try again.", "لا توجد مجموعة بهذا الرمز. تحقق وحاول مجدداً.", "اس کوڈ کا کوئی گروپ نہیں۔ چیک کر کے دوبارہ کوشش کریں۔", "Tidak ada rombongan dengan kode itu. Periksa dan coba lagi.", "Tiada kumpulan dengan kod itu. Semak dan cuba lagi.", "Bu kodla grup yok. Kontrol edip tekrar deneyin."),
    "errReviewed": ("You have already reviewed this.", "لقد قيّمت هذا من قبل.", "آپ پہلے ہی اس پر تبصرہ کر چکے ہیں۔", "Anda sudah memberi ulasan.", "Anda sudah memberi ulasan.", "Bunu zaten değerlendirdiniz."),
    "errGeneric": ("Something went wrong ({code}). Please try again.", "حدث خطأ ({code}). حاول مجدداً.", "کچھ غلط ہو گیا ({code})۔ دوبارہ کوشش کریں۔", "Terjadi kesalahan ({code}). Coba lagi.", "Ralat berlaku ({code}). Sila cuba lagi.", "Bir sorun oluştu ({code}). Lütfen tekrar deneyin."),
}

PARAM_RE = re.compile(r"\{(\w+)(?:,|\})")


def placeholders(msg: str) -> list[str]:
    names = []
    for m in PARAM_RE.finditer(msg):
        n = m.group(1)
        if n not in names:
            names.append(n)
    return names


def main() -> int:
    here = os.path.dirname(os.path.abspath(__file__))
    out_dir = os.path.join(here, "..", "lib", "l10n")
    errors = []
    for key, vals in S.items():
        if len(vals) != len(LANGS):
            errors.append(f"{key}: has {len(vals)} languages, needs {len(LANGS)}")
            continue
        base = set(placeholders(vals[0]))
        for lang, v in zip(LANGS[1:], vals[1:]):
            if set(placeholders(v)) != base:
                errors.append(f"{key} [{lang}]: placeholders {placeholders(v)} != en {sorted(base)}")
    if errors:
        print("\n".join(errors), file=sys.stderr)
        return 1

    for i, lang in enumerate(LANGS):
        arb = {"@@locale": lang}
        for key in sorted(S):
            arb[key] = S[key][i]
            if lang == "en":
                ph = placeholders(S[key][0])
                if ph:
                    arb[f"@{key}"] = {"placeholders": {p: {"type": "int" if p in INT_PARAMS else "String"} for p in ph}}
        with open(os.path.join(out_dir, f"app_{lang}.arb"), "w", encoding="utf-8") as f:
            json.dump(arb, f, ensure_ascii=False, indent=2)
            f.write("\n")
    print(f"Wrote {len(S)} strings × {len(LANGS)} languages to lib/l10n/")
    return 0


if __name__ == "__main__":
    sys.exit(main())
