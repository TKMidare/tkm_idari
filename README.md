# TKM İdari İşler

Araç filosu ve telefon hatlarını yönetmek için giriş korumalı web uygulaması.
Arayüz: React + Vite. Veritabanı ve kimlik doğrulama: Supabase. Yayın: GitHub Pages.

## Özellikler

- E-posta + şifre ile giriş; 30 dakika işlem yapılmazsa oturum kapanır
- Araçlar ve Telefon Hatları: ekleme, düzenleme, silme, arama, sıralama, durum filtresi
- Excel'den toplu aktarma (şablonlu, satır satır hata raporu) ve Excel'e indirme
- Özet sayfası: süresi geçen / 30 gün içinde bitecek muayene, sigorta, kasko ve taahhütler
- Değişiklik Geçmişi: kim, neyi, ne zaman ekledi / değiştirdi / sildi

## Kurulum

### 1. Supabase

1. [supabase.com](https://supabase.com) üzerinde bir proje oluşturun.
2. **SQL Editor**'de [`supabase/schema.sql`](supabase/schema.sql) dosyasının tamamını çalıştırın.
3. **Authentication → Sign In / Providers**: **Allow new users to sign up** seçeneğini **kapatın**.
   (Sitede kayıt sayfası yoktur; bu ayar API üzerinden hesap açılmasını da engeller.)
4. Aynı sayfada en az şifre uzunluğunu 10 yapın.
5. **Authentication → Users → Add user** ile kullanıcıları ekleyin (**Auto Confirm User** işaretli).
   Kullanıcılar şifrelerini siteden "Şifre Değiştir" ile değiştirebilir.
6. **Project Settings → API** sayfasından proje adresini ve `anon` / `publishable` anahtarını not edin.

> `service_role` / `secret` anahtarı hiçbir zaman siteye, depoya veya `.env` dosyasına konmamalıdır.

### 2. Bilgisayarda çalıştırma

```bash
cp .env.example .env   # ardından .env içindeki iki değeri doldurun
npm install
npm run dev
```

### 3. GitHub Pages'e yayınlama

1. Projeyi bir GitHub deposuna gönderin (`main` dalı).
2. **Settings → Secrets and variables → Actions → Variables** altında iki değişken ekleyin:
   `VITE_SUPABASE_URL` ve `VITE_SUPABASE_ANON_KEY`.
3. **Settings → Pages → Source**: **GitHub Actions** seçin.
4. `main` dalına yapılan her gönderimde site otomatik derlenip yayınlanır
   ([`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)).

## Güvenlik

- Verilere erişim tarayıcıda değil **veritabanında** denetlenir (RLS): giriş yapmamış
  hiçbir istek tablolara erişemez. `anon` anahtarının sayfa kaynağında görünmesi normaldir;
  tek başına hiçbir veriye erişim sağlamaz.
- Değişiklik geçmişi yalnızca veritabanı tetikleyicisi tarafından yazılır; kullanıcılar
  geçmişi değiştiremez veya silemez.
- Tüm alanlar veritabanında da doğrulanır (biçim, uzunluk, izin verilen değerler).
- Yayın derlemesi sıkı bir Content-Security-Policy içerir: yalnızca sitenin kendi
  betikleri çalışır, veri yalnızca Supabase projenize gider.
- Site başka bir sayfanın içine gömülü (iframe) açıldığında çalışmaz.

## Yeni alan eklemek

Alanlar tek yerde tanımlıdır: [`src/lib/fields.ts`](src/lib/fields.ts). Yeni bir alan için
oraya bir satır, veritabanına da aynı adla bir sütun ekleyin; liste, form, Excel ve
geçmiş sayfaları kendiliğinden güncellenir.
